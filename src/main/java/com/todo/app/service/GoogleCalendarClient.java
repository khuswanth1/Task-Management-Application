package com.todo.app.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Thin REST wrapper around Google OAuth 2.0 and the Calendar v3 API.
 * Holds no state; GoogleCalendarService owns tokens and persistence.
 */
@Component
public class GoogleCalendarClient {

    public static final String SCOPE = "openid email https://www.googleapis.com/auth/calendar.events";

    private static final String AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
    private static final String TOKEN_URL = "https://oauth2.googleapis.com/token";
    private static final String REVOKE_URL = "https://oauth2.googleapis.com/revoke";
    private static final String USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
    private static final String API = "https://www.googleapis.com/calendar/v3";
    private static final ParameterizedTypeReference<Map<String, Object>> JSON = new ParameterizedTypeReference<>() {};

    // java.net.http-based factory: supports PATCH (HttpURLConnection does not)
    private final RestClient http = RestClient.builder()
            .requestFactory(new org.springframework.http.client.JdkClientHttpRequestFactory())
            .build();

    @Value("${google.calendar.client-id:}")
    private String clientId;

    @Value("${google.calendar.client-secret:}")
    private String clientSecret;

    @Value("${google.calendar.redirect-uri:}")
    private String redirectUri;

    public boolean isConfigured() {
        return !clientId.isBlank() && !clientSecret.isBlank() && !redirectUri.isBlank();
    }

    /** redirect_uri_mismatch means redirectUri is not an Authorized redirect URI of THIS client id. */
    @jakarta.annotation.PostConstruct
    void logConfig() {
        org.slf4j.LoggerFactory.getLogger(GoogleCalendarClient.class).info(
                "Google Calendar OAuth: configured={}, client_id={}, redirect_uri={}", isConfigured(), clientId, redirectUri);
    }

    public String buildAuthUrl(String state) {
        return UriComponentsBuilder.fromHttpUrl(AUTH_URL)
                .queryParam("client_id", clientId)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("response_type", "code")
                .queryParam("scope", SCOPE)
                .queryParam("access_type", "offline")   // we need a refresh token
                .queryParam("prompt", "consent")        // force refresh token even on re-connect
                .queryParam("include_granted_scopes", "true")
                .queryParam("state", state)
                .encode()
                .toUriString();
    }

    /** Exchanges the authorization code for tokens: access_token, refresh_token, expires_in. */
    public Map<String, Object> exchangeCode(String code) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("code", code);
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);
        form.add("redirect_uri", redirectUri);
        form.add("grant_type", "authorization_code");
        return postForm(TOKEN_URL, form);
    }

    public Map<String, Object> refreshAccessToken(String refreshToken) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("refresh_token", refreshToken);
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);
        form.add("grant_type", "refresh_token");
        return postForm(TOKEN_URL, form);
    }

    public void revoke(String token) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("token", token);
        postForm(REVOKE_URL, form);
    }

    public Map<String, Object> userInfo(String accessToken) {
        return http.get().uri(USERINFO_URL)
                .headers(h -> h.setBearerAuth(accessToken))
                .retrieve().body(JSON);
    }

    // ----------------- EVENTS -----------------

    /**
     * Creates the event with our deterministic id, or updates it if it already exists
     * (including restoring one the user deleted, since a PATCH with status=confirmed undeletes).
     */
    public Map<String, Object> upsertEvent(String accessToken, String calendarId, String eventId, Map<String, Object> event) {
        try {
            return http.patch().uri(eventUri(calendarId, eventId))
                    .headers(h -> h.setBearerAuth(accessToken))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(event)
                    .retrieve().body(JSON);
        } catch (HttpClientErrorException.NotFound e) {
            Map<String, Object> withId = new java.util.HashMap<>(event);
            withId.put("id", eventId);
            return http.post().uri(API + "/calendars/" + enc(calendarId) + "/events")
                    .headers(h -> h.setBearerAuth(accessToken))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(withId)
                    .retrieve().body(JSON);
        }
    }

    public void deleteEvent(String accessToken, String calendarId, String eventId) {
        try {
            http.delete().uri(eventUri(calendarId, eventId))
                    .headers(h -> h.setBearerAuth(accessToken))
                    .retrieve().toBodilessEntity();
        } catch (HttpClientErrorException e) {
            // Already gone (404) or already deleted (410) — the goal state is reached
            if (e.getStatusCode() != HttpStatus.NOT_FOUND && e.getStatusCode() != HttpStatus.GONE) throw e;
        }
    }

    /**
     * Lists changed events. With a null syncToken this is a full listing whose only purpose
     * is to obtain the first nextSyncToken. Throws SyncTokenExpiredException on HTTP 410.
     */
    public EventPage listEvents(String accessToken, String calendarId, String syncToken) {
        List<Map<String, Object>> items = new ArrayList<>();
        String pageToken = null;
        while (true) {
            UriComponentsBuilder uri = UriComponentsBuilder.fromHttpUrl(API + "/calendars/" + enc(calendarId) + "/events")
                    .queryParam("maxResults", 2500)
                    .queryParam("showDeleted", true)
                    .queryParam("singleEvents", true);
            if (syncToken != null) uri.queryParam("syncToken", syncToken);
            if (pageToken != null) uri.queryParam("pageToken", pageToken);

            Map<String, Object> page;
            try {
                page = http.get().uri(uri.build().encode().toUri())
                        .headers(h -> h.setBearerAuth(accessToken))
                        .retrieve().body(JSON);
            } catch (HttpClientErrorException e) {
                if (e.getStatusCode() == HttpStatus.GONE) throw new SyncTokenExpiredException();
                throw e;
            }

            Object pageItems = page.get("items");
            if (pageItems instanceof List<?> list) {
                for (Object o : list) {
                    if (o instanceof Map<?, ?> m) {
                        @SuppressWarnings("unchecked") Map<String, Object> event = (Map<String, Object>) m;
                        items.add(event);
                    }
                }
            }
            pageToken = (String) page.get("nextPageToken");
            if (pageToken == null) {
                return new EventPage(items, (String) page.get("nextSyncToken"));
            }
        }
    }

    // ----------------- PUSH NOTIFICATIONS (WEBHOOKS) -----------------

    /** Registers a webhook channel; returns resourceId and expiration (epoch millis as string). */
    public Map<String, Object> watchEvents(String accessToken, String calendarId, String channelId,
                                           String channelToken, String webhookUrl, long ttlSeconds) {
        Map<String, Object> body = Map.of(
                "id", channelId,
                "type", "web_hook",
                "address", webhookUrl,
                "token", channelToken,
                "params", Map.of("ttl", String.valueOf(ttlSeconds)));
        return http.post().uri(API + "/calendars/" + enc(calendarId) + "/events/watch")
                .headers(h -> h.setBearerAuth(accessToken))
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve().body(JSON);
    }

    public void stopChannel(String accessToken, String channelId, String resourceId) {
        try {
            http.post().uri(API + "/channels/stop")
                    .headers(h -> h.setBearerAuth(accessToken))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("id", channelId, "resourceId", resourceId))
                    .retrieve().toBodilessEntity();
        } catch (HttpClientErrorException.NotFound e) {
            // channel already expired
        }
    }

    // ----------------- HELPERS -----------------

    private Map<String, Object> postForm(String url, MultiValueMap<String, String> form) {
        return http.post().uri(url)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve().body(JSON);
    }

    private java.net.URI eventUri(String calendarId, String eventId) {
        return java.net.URI.create(API + "/calendars/" + enc(calendarId) + "/events/" + enc(eventId));
    }

    private static String enc(String segment) {
        return UriUtils.encodePathSegment(segment, StandardCharsets.UTF_8);
    }

    public record EventPage(List<Map<String, Object>> items, String nextSyncToken) {}

    public static class SyncTokenExpiredException extends RuntimeException {
        public SyncTokenExpiredException() { super("Google Calendar sync token expired (410)"); }
    }
}
