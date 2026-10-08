package com.todo.app.service;

import com.todo.app.entity.GoogleCalendarConnection;
import com.todo.app.entity.Task;
import com.todo.app.repository.GoogleCalendarConnectionRepository;
import com.todo.app.repository.TaskRepository;
import com.todo.app.repository.UserRepository;
import com.todo.app.util.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Two-way sync between tasks and Google Calendar.
 *
 *  Task -> Calendar: whenever a task with a due time is created/updated/archived, its event
 *                    is upserted/deleted (async, so a Google outage never blocks task CRUD).
 *  Calendar -> Task: Google POSTs a push notification to /api/calendar/google/webhook; we then
 *                    pull the changed events with the incremental sync token and copy title /
 *                    time changes back onto the linked task.
 *
 * All task due times are stored as UTC LocalDateTime (the frontend sends ISO strings in UTC).
 */
@Service
public class GoogleCalendarService {

    private static final Logger log = LoggerFactory.getLogger(GoogleCalendarService.class);

    private static final long STATE_TTL_MILLIS = 10 * 60 * 1000;          // OAuth state valid 10 min
    private static final long CHANNEL_TTL_SECONDS = 7 * 24 * 60 * 60;     // ask Google for a 7-day channel
    private static final Duration RENEW_BEFORE = Duration.ofHours(24);
    private static final Duration EVENT_LENGTH = Duration.ofMinutes(30);
    private static final String EVENT_ID_PREFIX = "todotask";              // base32hex-safe (a-v, 0-9)
    private static final DateTimeFormatter RFC3339_UTC = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'");

    private final GoogleCalendarConnectionRepository connections;
    private final TaskRepository tasks;
    private final GoogleCalendarClient client;
    private final UserRepository users;
    private final WebPushService webPushService;
    private final SecureRandom random = new SecureRandom();
    private final Map<Long, Object> syncLocks = new ConcurrentHashMap<>();

    @Value("${google.calendar.webhook-url:}")
    private String webhookUrl;

    @Value("${FRONTEND_URL:http://localhost:5173}")
    private String frontendUrl;

    public GoogleCalendarService(GoogleCalendarConnectionRepository connections, TaskRepository tasks,
                                 GoogleCalendarClient client, UserRepository users, WebPushService webPushService) {
        this.connections = connections;
        this.tasks = tasks;
        this.client = client;
        this.users = users;
        this.webPushService = webPushService;
    }

    public boolean isConfigured() {
        return client.isConfigured();
    }

    // ----------------- CONNECT / DISCONNECT -----------------

    public String buildAuthUrl(Long userId, String timeZone) {
        if (!isConfigured()) throw new IllegalStateException("Google Calendar integration is not configured on the server");
        String tz = validZoneOrUtc(timeZone);
        String state = JwtUtil.generate("gcal|" + userId + "|" + tz, STATE_TTL_MILLIS);
        return client.buildAuthUrl(state);
    }

    /** OAuth callback: exchanges the code, stores tokens, returns the userId the state was issued for. */
    public Long completeConnection(String code, String state) {
        String[] parts = JwtUtil.validate(state).split("\\|");
        if (parts.length != 3 || !"gcal".equals(parts[0])) throw new IllegalArgumentException("Invalid OAuth state");
        Long userId = Long.valueOf(parts[1]);

        Map<String, Object> tokenResponse = client.exchangeCode(code);
        GoogleCalendarConnection conn = connections.findByUserId(userId).orElseGet(GoogleCalendarConnection::new);

        String refreshToken = (String) tokenResponse.get("refresh_token");
        if (refreshToken == null && conn.getRefreshToken() == null) {
            throw new IllegalStateException("Google did not return a refresh token");
        }
        if (refreshToken != null) conn.setRefreshToken(refreshToken);

        conn.setUserId(userId);
        conn.setTimeZone(parts[2]);
        applyAccessToken(conn, tokenResponse);
        conn.setConnectedAt(Instant.now());
        try {
            conn.setGoogleEmail((String) client.userInfo(conn.getAccessToken()).get("email"));
        } catch (Exception e) {
            log.warn("Could not read Google account email for user {}: {}", userId, e.getMessage());
        }
        connections.save(conn);
        return userId;
    }

    /** Runs after connecting: takes the initial sync token, opens the webhook channel, pushes existing tasks. */
    @Async
    public void initializeAfterConnect(Long userId) {
        connections.findByUserId(userId).ifPresent(conn -> {
            try {
                synchronized (lockFor(userId)) {
                    String token = accessToken(conn);
                    conn.setSyncToken(client.listEvents(token, conn.getCalendarId(), null).nextSyncToken());
                    conn.setLastSyncedAt(Instant.now());
                    connections.save(conn);
                }
                startWatch(conn);
            } catch (Exception e) {
                log.error("Google Calendar initial setup failed for user {}", userId, e);
            }
            pushAllTasks(userId);
        });
    }

    public void disconnect(Long userId) {
        connections.findByUserId(userId).ifPresent(conn -> {
            try {
                String token = accessToken(conn);
                if (conn.getChannelId() != null) client.stopChannel(token, conn.getChannelId(), conn.getChannelResourceId());
            } catch (Exception e) {
                log.warn("Could not stop Google Calendar channel for user {}: {}", userId, e.getMessage());
            }
            try {
                client.revoke(conn.getRefreshToken());
            } catch (Exception e) {
                log.warn("Could not revoke Google token for user {}: {}", userId, e.getMessage());
            }
            unlinkLocally(conn);
        });
    }

    public Map<String, Object> status(Long userId) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("configured", isConfigured());
        s.put("webhookConfigured", !webhookUrl.isBlank());
        Optional<GoogleCalendarConnection> conn = connections.findByUserId(userId);
        s.put("connected", conn.isPresent());
        conn.ifPresent(c -> {
            s.put("googleEmail", c.getGoogleEmail());
            s.put("calendarId", c.getCalendarId());
            s.put("timeZone", c.getTimeZone());
            s.put("connectedAt", c.getConnectedAt());
            s.put("lastSyncedAt", c.getLastSyncedAt());
            s.put("webhookActive", c.getChannelExpiresAt() != null && c.getChannelExpiresAt().isAfter(Instant.now()));
            s.put("webhookExpiresAt", c.getChannelExpiresAt());
        });
        return s;
    }

    // ----------------- TASK -> CALENDAR -----------------

    /**
     * Upserts (or removes) the calendar event for a task. Safe to call for any task.
     * When this links the task to a calendar event for the first time, the user is notified.
     */
    @Async
    public void syncTask(Long taskId) {
        tasks.findById(taskId).ifPresent(task -> {
            String eventLink = syncTaskNow(task);
            if (eventLink != null) notifyAddedToCalendar(task, eventLink);
        });
    }

    /**
     * Re-syncs a main task's sub-tasks: their events show the main task's title and,
     * when they have no due time of their own, sit at the main task's due time.
     */
    @Async
    public void syncSubtasks(Long parentTaskId) {
        syncSubtasksNow(parentTaskId);
    }

    private void syncSubtasksNow(Long parentTaskId) {
        for (Task sub : tasks.findByParentTaskId(parentTaskId)) {
            String eventLink = syncTaskNow(sub);
            if (eventLink != null) notifyAddedToCalendar(sub, eventLink);
        }
    }

    /** Deletes calendar events for tasks that were archived or removed. */
    @Async
    public void removeEvents(Long userId, Collection<String> eventIds) {
        if (eventIds == null || eventIds.isEmpty()) return;
        connections.findByUserId(userId).ifPresent(conn -> {
            try {
                String token = accessToken(conn);
                for (String eventId : eventIds) client.deleteEvent(token, conn.getCalendarId(), eventId);
            } catch (Exception e) {
                log.error("Failed to delete Google Calendar events for user {}", userId, e);
            }
        });
    }

    @Async
    public void pushAllTasksAsync(Long userId) {
        pushAllTasks(userId);
    }

    /** Bulk push (initial connect / "Sync now"): one summary notification instead of one per task. */
    private void pushAllTasks(Long userId) {
        if (connections.findByUserId(userId).isEmpty()) return;
        int added = 0;
        for (Task task : tasks.findByUserId(userId)) {
            if (!task.isArchived() && effectiveDueTime(task) != null && syncTaskNow(task) != null) added++;
        }
        if (added > 0) {
            notifyUser(userId, "📅 Tasks added to Google Calendar",
                    added + (added == 1 ? " task was" : " tasks were") + " added to your Google Calendar.",
                    frontendUrl + "/");
        }
    }

    /**
     * Syncs one task. Returns the event's Google Calendar link when the task was newly
     * linked to an event by this call, otherwise null (updated, removed, skipped or failed).
     */
    private String syncTaskNow(Task task) {
        if (task.getUserId() == null) return null;
        Optional<GoogleCalendarConnection> maybeConn = connections.findByUserId(task.getUserId());
        if (maybeConn.isEmpty()) return null;
        GoogleCalendarConnection conn = maybeConn.get();

        try {
            String token = accessToken(conn);
            if (task.isArchived() || effectiveDueTime(task) == null) {
                if (task.getGoogleEventId() != null) {
                    client.deleteEvent(token, conn.getCalendarId(), task.getGoogleEventId());
                    tasks.updateGoogleEventId(task.getId(), null);
                }
                return null;
            }
            String eventId = EVENT_ID_PREFIX + task.getId();
            Map<String, Object> event = client.upsertEvent(token, conn.getCalendarId(), eventId, toEvent(task, conn));
            if (eventId.equals(task.getGoogleEventId())) return null;
            tasks.updateGoogleEventId(task.getId(), eventId);
            Object htmlLink = event != null ? event.get("htmlLink") : null;
            return htmlLink != null ? htmlLink.toString() : "https://calendar.google.com/calendar";
        } catch (Exception e) {
            log.error("Failed to sync task {} to Google Calendar", task.getId(), e);
            return null;
        }
    }

    private void notifyAddedToCalendar(Task task, String eventLink) {
        ZoneId zone = ZoneId.of(connections.findByUserId(task.getUserId())
                .map(GoogleCalendarConnection::getTimeZone).map(GoogleCalendarService::validZoneOrUtc).orElse("UTC"));
        String when = effectiveDueTime(task).atOffset(ZoneOffset.UTC).atZoneSameInstant(zone)
                .format(DateTimeFormatter.ofPattern("EEE, d MMM yyyy 'at' h:mm a", Locale.ENGLISH));
        String kind = task.getParentTaskId() != null ? "Sub-task \"" : "\"";
        notifyUser(task.getUserId(), "📅 Added to Google Calendar: " + task.getTitle(),
                kind + task.getTitle() + "\" is now on your Google Calendar for " + when + " (" + zone.getId() + ").",
                eventLink);
    }

    private Optional<Task> parentOf(Task task) {
        return task.getParentTaskId() == null ? Optional.empty() : tasks.findById(task.getParentTaskId());
    }

    /** A sub-task without its own due time is placed on the calendar at its main task's due time. */
    private LocalDateTime effectiveDueTime(Task task) {
        if (task.getDueTime() != null) return task.getDueTime();
        return parentOf(task).map(Task::getDueTime).orElse(null);
    }

    /** Web push to the user's devices; WebPushService falls back to email when none are reachable. */
    private void notifyUser(Long userId, String title, String body, String link) {
        try {
            users.findById(userId).ifPresent(user -> webPushService.notifyUserByEmail(user.getEmail(), title, body, link));
        } catch (Exception e) {
            log.warn("Could not send calendar notification to user {}: {}", userId, e.getMessage());
        }
    }

    private Map<String, Object> toEvent(Task task, GoogleCalendarConnection conn) {
        String zone = conn.getTimeZone() != null ? conn.getTimeZone() : "UTC";
        LocalDateTime start = effectiveDueTime(task);
        Optional<Task> parent = parentOf(task);

        String deadline = start.atOffset(ZoneOffset.UTC).atZoneSameInstant(ZoneId.of(validZoneOrUtc(zone)))
                .format(DateTimeFormatter.ofPattern("EEE, d MMM yyyy 'at' h:mm a", Locale.ENGLISH));

        // Everything entered in the "Create New Task" form, in the same order
        StringBuilder description = new StringBuilder();
        if (task.getDescription() != null && !task.getDescription().isBlank()) {
            description.append(task.getDescription()).append("\n\n");
        }
        description.append("Priority: ").append(Objects.toString(task.getPriority(), "-")).append('\n');
        description.append("Deadline: ").append(deadline)
                   .append(task.getDueTime() == null ? " (from main task)" : "").append('\n');
        description.append("Reminders: ").append(reminderSummary(task)).append('\n');
        description.append("Placement: ").append(parent.map(p -> "Sub-task of \"" + p.getTitle() + "\"")
                                                       .orElse("Main Dashboard (Standalone Task)")).append('\n');
        description.append("Status: ").append(Objects.toString(task.getStatus(), "TODO")).append("\n\n");
        description.append("Synced from your Todo app: ").append(frontendUrl).append("/");

        Map<String, Object> event = new LinkedHashMap<>();
        event.put("summary", parent.isPresent() ? "↳ " + task.getTitle() : task.getTitle());
        event.put("description", description.toString());
        event.put("start", Map.of("dateTime", RFC3339_UTC.format(start), "timeZone", zone));
        event.put("end", Map.of("dateTime", RFC3339_UTC.format(start.plus(EVENT_LENGTH)), "timeZone", zone));
        event.put("status", "confirmed"); // also restores the event if the user deleted it earlier
        event.put("colorId", colorFor(task));
        event.put("extendedProperties", Map.of("private", Map.of("todoTaskId", String.valueOf(task.getId()))));
        event.put("reminders", calendarReminders(task));
        return event;
    }

    private static String reminderSummary(Task task) {
        Integer count = task.getReminderCount();
        Integer interval = task.getReminderInterval();
        if (interval == null || interval <= 0) return "No reminders";
        int times = count == null || count <= 0 ? 1 : count;
        return times + (times == 1 ? " time" : " times") + ", every " + formatMinutes(interval);
    }

    /**
     * Mirrors the task's reminder config as Google Calendar pop-ups: one at the deadline plus
     * one every "gap" minutes before it, up to the repetition count (Google allows 5 overrides).
     */
    private static Map<String, Object> calendarReminders(Task task) {
        Integer interval = task.getReminderInterval();
        if (interval == null || interval <= 0) return Map.of("useDefault", true);
        int times = task.getReminderCount() == null || task.getReminderCount() <= 0 ? 1 : task.getReminderCount();
        List<Map<String, Object>> overrides = new ArrayList<>();
        overrides.add(Map.of("method", "popup", "minutes", 0));
        for (int i = 1; i <= times && overrides.size() < 5; i++) {
            int minutes = interval * i;
            if (minutes > 40320) break; // Google's max: 4 weeks
            overrides.add(Map.of("method", "popup", "minutes", minutes));
        }
        return Map.of("useDefault", false, "overrides", overrides);
    }

    private static String formatMinutes(int minutes) {
        if (minutes % 60 != 0) return minutes + (minutes == 1 ? " minute" : " minutes");
        int hours = minutes / 60;
        return hours + (hours == 1 ? " hour" : " hours");
    }

    private static String colorFor(Task task) {
        if ("DONE".equals(task.getStatus())) return "8";                // graphite
        String p = task.getPriority() == null ? "" : task.getPriority().toLowerCase(Locale.ROOT);
        return switch (p) {
            case "high" -> "11";   // tomato
            case "low" -> "2";     // sage
            default -> "5";        // banana
        };
    }

    // ----------------- CALENDAR -> TASK (WEBHOOK) -----------------

    /**
     * Handles a Google push notification. Google only says "something changed", so we pull
     * the delta with the sync token. The webhook controller always answers 200 immediately.
     */
    @Async
    public void handleNotification(String channelId, String channelToken, String resourceState) {
        if (channelId == null) return;
        Optional<GoogleCalendarConnection> maybeConn = connections.findByChannelId(channelId);
        if (maybeConn.isEmpty()) {
            log.info("Ignoring Google Calendar notification for unknown channel {}", channelId);
            return;
        }
        GoogleCalendarConnection conn = maybeConn.get();
        if (!constantTimeEquals(conn.getChannelToken(), channelToken)) {
            log.warn("Rejected Google Calendar notification with bad token for channel {}", channelId);
            return;
        }
        if ("sync".equals(resourceState)) return; // handshake sent right after watch() — nothing changed yet

        try {
            pullChanges(conn.getUserId());
        } catch (Exception e) {
            log.error("Failed to process Google Calendar changes for user {}", conn.getUserId(), e);
        }
    }

    private void pullChanges(Long userId) {
        synchronized (lockFor(userId)) {
            // Re-read inside the lock so we always use the latest sync token
            GoogleCalendarConnection conn = connections.findByUserId(userId).orElse(null);
            if (conn == null) return;
            String token = accessToken(conn);

            GoogleCalendarClient.EventPage page;
            try {
                page = client.listEvents(token, conn.getCalendarId(), conn.getSyncToken());
            } catch (GoogleCalendarClient.SyncTokenExpiredException e) {
                log.info("Sync token expired for user {}, doing a full resync", userId);
                page = client.listEvents(token, conn.getCalendarId(), null);
            }

            for (Map<String, Object> event : page.items()) applyEventToTask(userId, event);

            conn.setSyncToken(page.nextSyncToken());
            conn.setLastSyncedAt(Instant.now());
            connections.save(conn);
        }
    }

    @SuppressWarnings("unchecked")
    private void applyEventToTask(Long userId, Map<String, Object> event) {
        String eventId = (String) event.get("id");
        if (eventId == null) return;
        Task task = tasks.findByUserIdAndGoogleEventId(userId, eventId).orElse(null);
        if (task == null || task.isArchived()) return; // not one of ours

        // Deleted in Google Calendar: keep the task, just unlink it
        if ("cancelled".equals(event.get("status"))) {
            tasks.updateGoogleEventId(task.getId(), null);
            return;
        }

        boolean changed = false;

        String summary = (String) event.get("summary");
        if (summary != null && task.getParentTaskId() != null && summary.startsWith("↳ ")) {
            summary = summary.substring(2); // sub-task marker added by toEvent
        }
        if (summary != null && !summary.isBlank() && !summary.equals(task.getTitle())) {
            task.setTitle(summary);
            changed = true;
        }

        Object start = event.get("start");
        if (start instanceof Map<?, ?> startMap && startMap.get("dateTime") instanceof String dateTime) {
            LocalDateTime newDue = OffsetDateTime.parse(dateTime).withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime();
            LocalDateTime oldDue = effectiveDueTime(task);
            if (oldDue == null || !newDue.equals(oldDue.truncatedTo(ChronoUnit.SECONDS))) {
                // Keep a pending reminder at the same offset from the due time
                if (oldDue != null && task.getRemindAt() != null && !task.isReminderSent()) {
                    task.setRemindAt(task.getRemindAt().plus(Duration.between(oldDue, newDue)));
                }
                task.setDueTime(newDue);
                changed = true;
            }
        }

        if (changed) {
            // Saved straight through the repository (not TaskService) so it doesn't echo back to Google
            tasks.save(task);
            log.info("Updated task {} from Google Calendar event {}", task.getId(), eventId);
            syncSubtasksNow(task.getId());
        }
    }

    // ----------------- WEBHOOK CHANNEL LIFECYCLE -----------------

    private void startWatch(GoogleCalendarConnection conn) {
        if (webhookUrl.isBlank()) {
            log.info("google.calendar.webhook-url not set — Calendar -> Task sync via webhooks is disabled");
            return;
        }
        String token = accessToken(conn);
        String oldChannelId = conn.getChannelId();
        String oldResourceId = conn.getChannelResourceId();

        String channelId = UUID.randomUUID().toString();
        String channelToken = randomToken();
        Map<String, Object> resp = client.watchEvents(token, conn.getCalendarId(), channelId, channelToken,
                webhookUrl, CHANNEL_TTL_SECONDS);

        conn.setChannelId(channelId);
        conn.setChannelToken(channelToken);
        conn.setChannelResourceId((String) resp.get("resourceId"));
        Object expiration = resp.get("expiration");
        conn.setChannelExpiresAt(expiration != null
                ? Instant.ofEpochMilli(Long.parseLong(expiration.toString()))
                : Instant.now().plusSeconds(CHANNEL_TTL_SECONDS));
        connections.save(conn);
        log.info("Google Calendar webhook channel {} active for user {} until {}", channelId, conn.getUserId(), conn.getChannelExpiresAt());

        if (oldChannelId != null && oldResourceId != null) {
            try {
                client.stopChannel(token, oldChannelId, oldResourceId);
            } catch (Exception e) {
                log.warn("Could not stop old channel {}: {}", oldChannelId, e.getMessage());
            }
        }
    }

    /** Google channels expire (max ~7 days); renew each one a day before it lapses. */
    @Scheduled(fixedDelay = 60 * 60 * 1000, initialDelay = 2 * 60 * 1000)
    public void renewWebhookChannels() {
        if (webhookUrl.isBlank() || !isConfigured()) return;
        for (GoogleCalendarConnection conn : connections.findByChannelExpiresAtBeforeOrChannelIdIsNull(Instant.now().plus(RENEW_BEFORE))) {
            try {
                startWatch(conn);
            } catch (Exception e) {
                log.error("Failed to renew Google Calendar channel for user {}", conn.getUserId(), e);
            }
        }
    }

    // ----------------- TOKENS -----------------

    private String accessToken(GoogleCalendarConnection conn) {
        if (conn.getAccessToken() != null && conn.getAccessTokenExpiresAt() != null
                && conn.getAccessTokenExpiresAt().isAfter(Instant.now().plusSeconds(60))) {
            return conn.getAccessToken();
        }
        try {
            applyAccessToken(conn, client.refreshAccessToken(conn.getRefreshToken()));
            connections.save(conn);
            return conn.getAccessToken();
        } catch (HttpClientErrorException e) {
            if (e.getResponseBodyAsString().contains("invalid_grant")) {
                // User revoked access from their Google account — drop the connection
                log.warn("Google access revoked for user {}, disconnecting calendar", conn.getUserId());
                unlinkLocally(conn);
            }
            throw e;
        }
    }

    private static void applyAccessToken(GoogleCalendarConnection conn, Map<String, Object> tokenResponse) {
        conn.setAccessToken((String) tokenResponse.get("access_token"));
        Object expiresIn = tokenResponse.get("expires_in");
        long seconds = expiresIn instanceof Number n ? n.longValue() : 3600;
        conn.setAccessTokenExpiresAt(Instant.now().plusSeconds(seconds));
    }

    private void unlinkLocally(GoogleCalendarConnection conn) {
        for (Task task : tasks.findByUserIdAndGoogleEventIdIsNotNull(conn.getUserId())) {
            tasks.updateGoogleEventId(task.getId(), null);
        }
        connections.delete(conn);
    }

    // ----------------- HELPERS -----------------

    private Object lockFor(Long userId) {
        return syncLocks.computeIfAbsent(userId, k -> new Object());
    }

    private String randomToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static boolean constantTimeEquals(String expected, String actual) {
        if (expected == null || actual == null) return false;
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), actual.getBytes(StandardCharsets.UTF_8));
    }

    private static String validZoneOrUtc(String zone) {
        if (zone == null || zone.isBlank() || zone.contains("|")) return "UTC";
        try {
            return ZoneId.of(zone).getId();
        } catch (DateTimeException e) {
            return "UTC";
        }
    }
}
