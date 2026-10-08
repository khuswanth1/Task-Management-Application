package com.todo.app.service;

import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Objects;

import com.todo.app.entity.Task;
import com.todo.app.repository.TaskRepository;

import org.springframework.transaction.annotation.Transactional;

@Service
public class TaskService {

    private final TaskRepository repo;
    private final com.todo.app.repository.UserRepository userRepository;
    private final EmailService emailService;
    private final GoogleCalendarService calendarService;
    private final WebPushService webPushService;

    @org.springframework.beans.factory.annotation.Value("${FRONTEND_URL:http://localhost:5173}")
    private String frontendUrl;

    public TaskService(TaskRepository repo, com.todo.app.repository.UserRepository userRepository, EmailService emailService,
                       GoogleCalendarService calendarService, WebPushService webPushService) {
        this.repo = repo;
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.calendarService = calendarService;
        this.webPushService = webPushService;
    }

    /**
     * Drag-and-drop swap: the two tasks exchange priorities (Low <-> High, etc.).
     * Sends ONE notification to the user's devices via Web Push (each device's push-service
     * endpoint is POSTed to, webhook-style); falls back to email when no device is subscribed.
     */
    @Transactional
    public List<Task> swapPriority(Long sourceId, Long targetId) {
        Task source = repo.findById(sourceId).orElseThrow(() -> new RuntimeException("Task not found"));
        Task target = repo.findById(targetId).orElseThrow(() -> new RuntimeException("Task not found"));
        if (!Objects.equals(source.getUserId(), target.getUserId())) {
            throw new RuntimeException("Tasks belong to different users");
        }
        if (!Objects.equals(source.getParentTaskId(), target.getParentTaskId())) {
            throw new RuntimeException("Only tasks at the same level (main/main or sub/sub of one task) can be swapped");
        }

        String sourcePriority = Objects.toString(source.getPriority(), "Medium");
        String targetPriority = Objects.toString(target.getPriority(), "Medium");
        if (sourcePriority.equals(targetPriority)) return List.of(source, target);

        source.setPriority(targetPriority);
        target.setPriority(sourcePriority);
        repo.saveAll(List.of(source, target));

        // Event colour follows priority
        calendarService.syncTask(source.getId());
        calendarService.syncTask(target.getId());

        if (source.getUserId() != null) {
            String kind = source.getParentTaskId() != null ? "Sub-task priorities swapped" : "Task priorities swapped";
            userRepository.findById(source.getUserId()).ifPresent(user -> webPushService.notifyUserByEmail(
                    user.getEmail(),
                    "🔀 " + kind,
                    "\"" + source.getTitle() + "\" " + sourcePriority + " → " + targetPriority + " · \""
                            + target.getTitle() + "\" " + targetPriority + " → " + sourcePriority,
                    frontendUrl + "/"));
        }
        return List.of(source, target);
    }

    public Task create(Task t) {
        if (t.getTitle() == null || t.getTitle().isBlank()) {
            throw new RuntimeException("Task title cannot be empty");
        }

        if (t.getStatus() == null) {
            t.setStatus("TODO");
        }
        t.setGoogleEventId(null); // owned by GoogleCalendarService, never set by clients

        Task savedTask = repo.save(t);

        // ✅ Mirror to Google Calendar (async; no-op if the user hasn't connected a calendar)
        calendarService.syncTask(savedTask.getId());

        // ✅ Notify User about newly added task (ON CREATE)
        if (savedTask.getUserId() != null) {
            userRepository.findById(savedTask.getUserId()).ifPresent(user -> {
                emailService.sendEmail(
                    user.getEmail(),
                    "🚀 Mission Initiated: " + savedTask.getTitle(),
                    "Hello " + user.getName() + ",\n\nA new mission has been added to your log: \"" + savedTask.getTitle() + "\".\n\nStrategic success is expected. Go get 'em! 🎯"
                );
            });
        }

        return savedTask;
    }

    public List<Task> get(Long userId) {
        return repo.findByUserId(userId).stream()
                .filter(t -> !t.isArchived())
                .collect(java.util.stream.Collectors.toList());
    }

    public Task update(Long id, Task updatedTask) {
        Task task = repo.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        String oldStatus = task.getStatus();
        String oldPriority = task.getPriority();
        List<Object> before = details(task);

        if (updatedTask.getTitle() != null) task.setTitle(updatedTask.getTitle());
        if (updatedTask.getDescription() != null) task.setDescription(updatedTask.getDescription());
        if (updatedTask.getDueTime() != null) task.setDueTime(updatedTask.getDueTime());
        if (updatedTask.getStatus() != null) task.setStatus(updatedTask.getStatus());
        if (updatedTask.getPriority() != null) task.setPriority(updatedTask.getPriority());
        if (updatedTask.getParentTaskId() != null) task.setParentTaskId(updatedTask.getParentTaskId());
        if (updatedTask.getPosition() != null) task.setPosition(updatedTask.getPosition()); // drag-and-drop order

        // Handle remindAt updates and reset reminderSent status
        if (updatedTask.getRemindAt() != null) {
            if (task.getRemindAt() == null || !updatedTask.getRemindAt().isEqual(task.getRemindAt())) {
                task.setRemindAt(updatedTask.getRemindAt());
                task.setReminderSent(false);
            }
        } else {
            task.setRemindAt(null);
            task.setReminderSent(false);
        }
        // Repeat-reminder config ("Total repetitions" / "Gap") — also shown on the Google Calendar event
        if (updatedTask.getReminderInterval() != null) task.setReminderInterval(updatedTask.getReminderInterval());
        if (updatedTask.getReminderCount() != null) task.setReminderCount(updatedTask.getReminderCount());
        if (task.getRemindAt() == null) {
            task.setReminderInterval(null);
            task.setReminderCount(null);
        }

        Task savedTask = repo.save(task);

        // Pure reorder (drag-and-drop without a priority change): no email, nothing to sync
        List<Object> after = details(savedTask);
        if (before.equals(after)) return savedTask;
        before.set(PRIORITY_INDEX, null);
        after.set(PRIORITY_INDEX, null);
        boolean onlyPriorityChanged = before.equals(after);

        calendarService.syncTask(savedTask.getId());
        if (savedTask.getParentTaskId() == null) calendarService.syncSubtasks(savedTask.getId());
        boolean statusChangedToDone = "DONE".equals(savedTask.getStatus()) && !"DONE".equals(oldStatus);

        if (savedTask.getUserId() != null) {
            userRepository.findById(savedTask.getUserId()).ifPresent(user -> {
                if (onlyPriorityChanged) {
                    // Device notification (Web Push), email only if no device is subscribed
                    webPushService.notifyUserByEmail(
                        user.getEmail(),
                        "⚡ Priority changed: " + savedTask.getTitle(),
                        "\"" + savedTask.getTitle() + "\" " + Objects.toString(oldPriority, "Medium") + " → " + savedTask.getPriority(),
                        frontendUrl + "/"
                    );
                } else if (statusChangedToDone) {
                    emailService.sendEmail(
                        user.getEmail(),
                        "Mission Accomplished: " + savedTask.getTitle(),
                        "Congratulations " + user.getName() + ",\n\nThe mission \"" + savedTask.getTitle() + "\" has been successfully completed.\n\nGreat work."
                    );
                } else {
                    emailService.sendEmail(
                        user.getEmail(),
                        "Mission Updated: " + savedTask.getTitle(),
                        "Hello " + user.getName() + ",\n\nThe parameters for your mission \"" + savedTask.getTitle() + "\" have been updated.\n\nStatus: " + savedTask.getStatus() + "\nPriority: " + savedTask.getPriority()
                    );
                }
            });
        }

        return savedTask;
    }

    private static final int PRIORITY_INDEX = 4;

    /** The fields a user would call "the task's details" (everything except its drag-and-drop position). */
    private static List<Object> details(Task t) {
        return new java.util.ArrayList<>(java.util.Arrays.asList(
                t.getTitle(), t.getDescription(), t.getDueTime(), t.getStatus(), t.getPriority(),
                t.getParentTaskId(), t.getRemindAt(), t.getReminderCount(), t.getReminderInterval()));
    }

    @Transactional
    public void delete(Long id) {
        Task task = repo.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found"));
        task.setArchived(true);
        repo.save(task);
        List<String> eventIds = new java.util.ArrayList<>();
        if (task.getGoogleEventId() != null) eventIds.add(task.getGoogleEventId());

        // Cascade Archive: Set archived=true for all milestones/subtasks belonging to this task
        List<Task> subtasks = repo.findByParentTaskId(id);
        if (subtasks != null && !subtasks.isEmpty()) {
            for (Task sub : subtasks) {
                sub.setArchived(true);
                if (sub.getGoogleEventId() != null) eventIds.add(sub.getGoogleEventId());
            }
            repo.saveAll(subtasks);
        }

        if (task.getUserId() != null) calendarService.removeEvents(task.getUserId(), eventIds);
    }

    @Transactional
    public void deleteBulk(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return;
        for (Long id : ids) {
            repo.findById(id).ifPresent(task -> {
                task.setArchived(true);
                repo.save(task);
                List<String> eventIds = new java.util.ArrayList<>();
                if (task.getGoogleEventId() != null) eventIds.add(task.getGoogleEventId());

                List<Task> subtasks = repo.findByParentTaskId(id);
                if (subtasks != null && !subtasks.isEmpty()) {
                    for (Task sub : subtasks) {
                        sub.setArchived(true);
                        if (sub.getGoogleEventId() != null) eventIds.add(sub.getGoogleEventId());
                    }
                    repo.saveAll(subtasks);
                }

                if (task.getUserId() != null) calendarService.removeEvents(task.getUserId(), eventIds);
            });
        }
    }

    @org.springframework.transaction.annotation.Transactional
    public void clearAll(Long userId) {
        List<Task> userTasks = repo.findByUserId(userId);
        if (userTasks != null && !userTasks.isEmpty()) {
            List<String> eventIds = userTasks.stream()
                    .map(Task::getGoogleEventId)
                    .filter(java.util.Objects::nonNull)
                    .collect(java.util.stream.Collectors.toList());
            repo.deleteAll(userTasks);
            calendarService.removeEvents(userId, eventIds);
        }
    }
}