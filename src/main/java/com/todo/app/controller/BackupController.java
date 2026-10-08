package com.todo.app.controller;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.todo.app.entity.Task;
import com.todo.app.entity.User;
import com.todo.app.repository.TaskRepository;
import com.todo.app.service.GoogleCalendarService;
import com.todo.app.repository.UserRepository;
import com.todo.app.util.JwtUtil;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/backup")
@CrossOrigin(origins = "*")
@Tag(name = "Backup API", description = "Export and import user data backups")
public class BackupController {

    private final UserRepository userRepository;
    private final TaskRepository taskRepository;
    private final GoogleCalendarService calendarService;

    public BackupController(UserRepository userRepository, TaskRepository taskRepository,
                            GoogleCalendarService calendarService) {
        this.userRepository = userRepository;
        this.taskRepository = taskRepository;
        this.calendarService = calendarService;
    }

    @GetMapping("/export")
    @Operation(summary = "Export User Data", description = "Exports the user's profile, theme settings, and all tasks as a JSON backup file")
    public ResponseEntity<Map<String, Object>> exportData(
            @RequestHeader(value = "Authorization", required = false) String token) {

        if (token == null || !token.startsWith("Bearer ")) {
            throw new RuntimeException("Missing or invalid Authorization header");
        }
        String email = JwtUtil.validate(token.replace("Bearer ", ""));
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<Task> allUserTasks = taskRepository.findByUserId(user.getId());
        List<Task> activeTasks = allUserTasks.stream().filter(t -> !t.isArchived()).toList();
        List<Task> archivedTasks = allUserTasks.stream().filter(Task::isArchived).toList();

        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("name", user.getName());
        profile.put("email", user.getEmail());
        profile.put("username", user.getUsername());
        profile.put("mobile", user.getMobile());
        profile.put("age", user.getAge());
        profile.put("gender", user.getGender());
        profile.put("dob", user.getDob());

        Map<String, Object> themeSettings = new LinkedHashMap<>();
        themeSettings.put("primaryColor", user.getPrimaryColor());
        themeSettings.put("bgColor", user.getBgColor());
        themeSettings.put("sidebarColor", user.getSidebarColor());
        themeSettings.put("cardColor", user.getCardColor());
        themeSettings.put("headingColor", user.getHeadingColor());
        themeSettings.put("textColor", user.getTextColor());
        themeSettings.put("buttonBgColor", user.getButtonBgColor());
        themeSettings.put("buttonTextColor", user.getButtonTextColor());
        themeSettings.put("fontSize", user.getFontSize());
        themeSettings.put("fontFamily", user.getFontFamily());
        themeSettings.put("borderRadius", user.getBorderRadius());
        themeSettings.put("enableFontFamily", user.getEnableFontFamily());
        themeSettings.put("enableFontSize", user.getEnableFontSize());
        themeSettings.put("enableBorderRadius", user.getEnableBorderRadius());
        themeSettings.put("enableColors", user.getEnableColors());

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalTasks", activeTasks.size());
        stats.put("completedTasks", activeTasks.stream().filter(t -> "DONE".equals(t.getStatus())).count());
        stats.put("pendingTasks", activeTasks.stream().filter(t -> "TODO".equals(t.getStatus())).count());
        stats.put("inProgressTasks", activeTasks.stream().filter(t -> "IN_PROGRESS".equals(t.getStatus())).count());
        stats.put("archivedTasks", archivedTasks.size());

        Map<String, Object> backup = new LinkedHashMap<>();
        backup.put("backupVersion", "1.0");
        backup.put("exportedAt", Instant.now().toString());
        backup.put("appName", "Todo Pro");
        backup.put("profile", profile);
        backup.put("themeSettings", themeSettings);
        backup.put("stats", stats);
        backup.put("tasks", activeTasks);
        backup.put("archivedTasks", archivedTasks);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=todo_backup_" + System.currentTimeMillis() + ".json")
                .contentType(MediaType.APPLICATION_JSON)
                .body(backup);
    }

    @PostMapping("/import")
    @Operation(summary = "Import User Data", description = "Restores tasks from a previously exported JSON backup file")
    public ResponseEntity<Map<String, Object>> importData(
            @RequestHeader(value = "Authorization", required = false) String token,
            @RequestBody Map<String, Object> backupData) {

        if (token == null || !token.startsWith("Bearer ")) {
            throw new RuntimeException("Missing or invalid Authorization header");
        }
        String email = JwtUtil.validate(token.replace("Bearer ", ""));
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());

        int tasksImported = 0;

        // Map to keep track of old parent ID -> new parent ID mapping
        Map<Long, Long> parentIdMap = new HashMap<>();

        // 1. Process parent tasks first
        Object tasksObj = backupData.get("tasks");
        if (tasksObj instanceof List<?> tasksList) {
            for (Object taskObj : tasksList) {
                try {
                    Task task = mapper.convertValue(taskObj, Task.class);
                    Long oldId = task.getId();
                    
                    // Only import parents here
                    if (task.getParentTaskId() == null || task.getParentTaskId() == 0) {
                        task.setId(null);
                        task.setUserId(user.getId());
                        task.setGoogleEventId(null); // re-linked by the calendar sync below
                        Task savedParent = taskRepository.save(task);
                        tasksImported++;
                        if (oldId != null) {
                            parentIdMap.put(oldId, savedParent.getId());
                        }
                    }
                } catch (Exception e) {
                    // ignore
                }
            }
        }

        // 2. Process subtasks (both active and archived)
        List<Object> allTasksAndArchived = new ArrayList<>();
        if (tasksObj instanceof List<?> tasksList) {
            allTasksAndArchived.addAll(tasksList);
        }
        Object archivedObj = backupData.get("archivedTasks");
        if (archivedObj instanceof List<?> archivedList) {
            allTasksAndArchived.addAll(archivedList);
        }

        for (Object taskObj : allTasksAndArchived) {
            try {
                Task task = mapper.convertValue(taskObj, Task.class);
                if (task.getParentTaskId() != null && task.getParentTaskId() > 0) {
                    // Update parent task ID to the newly generated ID
                    Long newParentId = parentIdMap.get(task.getParentTaskId());
                    if (newParentId != null) {
                        task.setId(null);
                        task.setUserId(user.getId());
                        task.setGoogleEventId(null); // re-linked by the calendar sync below
                        task.setParentTaskId(newParentId);
                        taskRepository.save(task);
                        tasksImported++;
                    }
                }
            } catch (Exception e) {
                // ignore
            }
        }

        // 3. Process archived parent tasks
        if (archivedObj instanceof List<?> archivedList) {
            for (Object taskObj : archivedList) {
                try {
                    Task task = mapper.convertValue(taskObj, Task.class);
                    Long oldId = task.getId();
                    
                    // Only import parent tasks
                    if (task.getParentTaskId() == null || task.getParentTaskId() == 0) {
                        task.setId(null);
                        task.setUserId(user.getId());
                        task.setGoogleEventId(null); // re-linked by the calendar sync below
                        task.setArchived(true);
                        Task savedParent = taskRepository.save(task);
                        tasksImported++;
                        if (oldId != null) {
                            parentIdMap.put(oldId, savedParent.getId());
                        }
                    }
                } catch (Exception e) {
                    // ignore
                }
            }
        }

        // Mirror restored main tasks and sub-tasks to Google Calendar (no-op if not connected)
        if (tasksImported > 0) calendarService.pushAllTasksAsync(user.getId());

        Object themeObj = backupData.get("themeSettings");
        if (themeObj instanceof Map<?, ?> themeMap) {
            if (themeMap.get("primaryColor") != null) user.setPrimaryColor((String) themeMap.get("primaryColor"));
            if (themeMap.get("bgColor") != null) user.setBgColor((String) themeMap.get("bgColor"));
            if (themeMap.get("sidebarColor") != null) user.setSidebarColor((String) themeMap.get("sidebarColor"));
            if (themeMap.get("cardColor") != null) user.setCardColor((String) themeMap.get("cardColor"));
            if (themeMap.get("headingColor") != null) user.setHeadingColor((String) themeMap.get("headingColor"));
            if (themeMap.get("textColor") != null) user.setTextColor((String) themeMap.get("textColor"));
            if (themeMap.get("buttonBgColor") != null) user.setButtonBgColor((String) themeMap.get("buttonBgColor"));
            if (themeMap.get("buttonTextColor") != null) user.setButtonTextColor((String) themeMap.get("buttonTextColor"));
            if (themeMap.get("fontSize") != null) user.setFontSize((String) themeMap.get("fontSize"));
            if (themeMap.get("fontFamily") != null) user.setFontFamily((String) themeMap.get("fontFamily"));
            if (themeMap.get("borderRadius") != null) user.setBorderRadius((String) themeMap.get("borderRadius"));
            userRepository.save(user);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "Backup imported successfully");
        result.put("tasksImported", tasksImported);

        return ResponseEntity.ok(result);
    }
}
