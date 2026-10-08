package com.todo.app.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.Instant;

/**
 * A user's link to their Google Calendar: OAuth tokens, the push-notification
 * (webhook) channel Google sends change events to, and the incremental sync token.
 */
@Entity
@Table(name = "google_calendar_connections")
public class GoogleCalendarConnection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private Long userId;

    private String googleEmail;

    @Column(nullable = false)
    private String calendarId = "primary";

    // IANA zone from the user's browser, used as the event's display time zone
    private String timeZone;

    @JsonIgnore
    @Column(nullable = false, length = 512)
    private String refreshToken;

    @JsonIgnore
    @Column(length = 2048)
    private String accessToken;

    private Instant accessTokenExpiresAt;

    // Push notification channel (events.watch)
    @Column(unique = true)
    private String channelId;
    @JsonIgnore
    private String channelResourceId;
    @JsonIgnore
    private String channelToken;
    private Instant channelExpiresAt;

    @JsonIgnore
    @Column(length = 1024)
    private String syncToken;

    private Instant connectedAt;
    private Instant lastSyncedAt;

    public Long getId() { return id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getGoogleEmail() { return googleEmail; }
    public void setGoogleEmail(String googleEmail) { this.googleEmail = googleEmail; }

    public String getCalendarId() { return calendarId; }
    public void setCalendarId(String calendarId) { this.calendarId = calendarId; }

    public String getTimeZone() { return timeZone; }
    public void setTimeZone(String timeZone) { this.timeZone = timeZone; }

    public String getRefreshToken() { return refreshToken; }
    public void setRefreshToken(String refreshToken) { this.refreshToken = refreshToken; }

    public String getAccessToken() { return accessToken; }
    public void setAccessToken(String accessToken) { this.accessToken = accessToken; }

    public Instant getAccessTokenExpiresAt() { return accessTokenExpiresAt; }
    public void setAccessTokenExpiresAt(Instant accessTokenExpiresAt) { this.accessTokenExpiresAt = accessTokenExpiresAt; }

    public String getChannelId() { return channelId; }
    public void setChannelId(String channelId) { this.channelId = channelId; }

    public String getChannelResourceId() { return channelResourceId; }
    public void setChannelResourceId(String channelResourceId) { this.channelResourceId = channelResourceId; }

    public String getChannelToken() { return channelToken; }
    public void setChannelToken(String channelToken) { this.channelToken = channelToken; }

    public Instant getChannelExpiresAt() { return channelExpiresAt; }
    public void setChannelExpiresAt(Instant channelExpiresAt) { this.channelExpiresAt = channelExpiresAt; }

    public String getSyncToken() { return syncToken; }
    public void setSyncToken(String syncToken) { this.syncToken = syncToken; }

    public Instant getConnectedAt() { return connectedAt; }
    public void setConnectedAt(Instant connectedAt) { this.connectedAt = connectedAt; }

    public Instant getLastSyncedAt() { return lastSyncedAt; }
    public void setLastSyncedAt(Instant lastSyncedAt) { this.lastSyncedAt = lastSyncedAt; }
}
