package com.todo.app.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.todo.app.entity.GoogleCalendarConnection;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface GoogleCalendarConnectionRepository extends JpaRepository<GoogleCalendarConnection, Long> {

    Optional<GoogleCalendarConnection> findByUserId(Long userId);

    Optional<GoogleCalendarConnection> findByChannelId(String channelId);

    // Channels that are about to expire (or were never created) and need renewing
    List<GoogleCalendarConnection> findByChannelExpiresAtBeforeOrChannelIdIsNull(Instant threshold);
}
