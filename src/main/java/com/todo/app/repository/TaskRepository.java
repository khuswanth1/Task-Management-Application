package com.todo.app.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.todo.app.entity.Task;
import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Long> {
    List<Task> findByUserId(Long userId);
    List<Task> findByParentTaskId(Long parentTaskId);
    List<Task> findByStatusNot(String status);
    List<Task> findByRemindAtBeforeAndReminderSentFalse(java.time.LocalDateTime now);
    java.util.Optional<Task> findByUserIdAndGoogleEventId(Long userId, String googleEventId);
    List<Task> findByUserIdAndGoogleEventIdIsNotNull(Long userId);

    // Targeted write so a background calendar sync never overwrites a concurrent user edit
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("update Task t set t.googleEventId = :eventId where t.id = :id")
    int updateGoogleEventId(@org.springframework.data.repository.query.Param("id") Long id,
                            @org.springframework.data.repository.query.Param("eventId") String eventId);
}