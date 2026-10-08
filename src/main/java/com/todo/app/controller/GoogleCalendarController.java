package com.todo.app.controller;

import com.todo.app.entity.User;
import com.todo.app.repository.UserRepository;
import com.todo.app.service.GoogleCalendarService;
import com.todo.app.util.JwtUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.util.Map;

@RestController
@RequestMapping("/api/calendar/google")
@CrossOrigin(origins = "*")
@Tag(name = "Google Calendar API", description = "Connect Google Calendar, sync tasks as events, and receive Google push notifications")
public class GoogleCalendarController {

    private static final Logger log = LoggerFactory.getLogger(GoogleCalendarController.class);

    private final GoogleCalendarService calendarService;
    private final UserRepository userRepository;

    @Value("${FRONTEND_URL:http://localhost:5173}")
    private String frontendUrl;

    public GoogleCalendarController(GoogleCalendarService calendarService, UserRepository userRepository) {
        this.calendarService = calendarService;
        this.userRepository = userRepository;
    }

    @Operation(summary = "Get the current user's Google Calendar connection status")
    @GetMapping("/status")
    public Map<String, Object> status(@RequestHeader(value = "Authorization", required = false) String auth) {
        return calendarService.status(currentUser(auth).getId());
    }

    @Operation(summary = "Get the Google consent URL to connect a calendar")
    @GetMapping("/auth-url")
    public Map<String, String> authUrl(@RequestHeader(value = "Authorization", required = false) String auth,
                                       @RequestParam(required = false) String timeZone) {
        User user = currentUser(auth);
        try {
            return Map.of("url", calendarService.buildAuthUrl(user.getId(), timeZone));
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage());
        }
    }

    @Operation(summary = "OAuth redirect target registered in Google Cloud Console")
    @GetMapping("/callback")
    public ResponseEntity<Void> callback(@RequestParam(required = false) String code,
                                         @RequestParam(required = false) String state,
                                         @RequestParam(required = false) String error) {
        String result;
        String reason = null;
        if (error != null || code == null || state == null) {
            result = "denied";
            reason = error;
        } else {
            try {
                Long userId = calendarService.completeConnection(code, state);
                calendarService.initializeAfterConnect(userId);
                result = "connected";
            } catch (Exception e) {
                log.error("Google Calendar OAuth callback failed", e);
                result = "error";
                reason = e.getClass().getSimpleName() + ": " + e.getMessage();
            }
        }
        String location = frontendUrl + "/?tab=calendar&calendar=" + result;
        if (reason != null) {
            String shortReason = reason.length() > 200 ? reason.substring(0, 200) : reason;
            location += "&reason=" + java.net.URLEncoder.encode(shortReason, java.nio.charset.StandardCharsets.UTF_8);
        }
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(location)).build();
    }

    @Operation(summary = "Push all of the user's tasks with a due time to Google Calendar")
    @PostMapping("/sync")
    public Map<String, String> syncAll(@RequestHeader(value = "Authorization", required = false) String auth) {
        calendarService.pushAllTasksAsync(currentUser(auth).getId());
        return Map.of("message", "Sync started");
    }

    @Operation(summary = "Disconnect Google Calendar (stops the webhook and revokes access)")
    @DeleteMapping("/connection")
    public Map<String, String> disconnect(@RequestHeader(value = "Authorization", required = false) String auth) {
        calendarService.disconnect(currentUser(auth).getId());
        return Map.of("message", "Google Calendar disconnected");
    }

    /**
     * Google Calendar push-notification receiver. Google sends no body — only X-Goog-* headers —
     * and retries on non-2xx, so we always acknowledge immediately and process asynchronously.
     */
    @Operation(summary = "Webhook endpoint Google Calendar calls when events change")
    @PostMapping("/webhook")
    public ResponseEntity<Void> webhook(@RequestHeader(value = "X-Goog-Channel-ID", required = false) String channelId,
                                        @RequestHeader(value = "X-Goog-Channel-Token", required = false) String channelToken,
                                        @RequestHeader(value = "X-Goog-Resource-State", required = false) String resourceState) {
        calendarService.handleNotification(channelId, channelToken, resourceState);
        return ResponseEntity.ok().build();
    }

    private User currentUser(String auth) {
        if (auth == null || !auth.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing or invalid Authorization header");
        }
        String email;
        try {
            email = JwtUtil.validate(auth.substring("Bearer ".length()));
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired token");
        }
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }
}
