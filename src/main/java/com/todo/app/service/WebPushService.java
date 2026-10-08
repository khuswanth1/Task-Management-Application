package com.todo.app.service;

import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Subscription;
import nl.martijndwars.webpush.Utils;
import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import com.todo.app.entity.PushSubscription;
import com.todo.app.entity.Task;
import com.todo.app.entity.User;
import com.todo.app.repository.PushSubscriptionRepository;
import com.todo.app.repository.UserRepository;

import java.security.Security;
import java.util.List;
import java.util.Optional;

@Service
public class WebPushService {

    // Where notification clicks open the app (Render: the static site URL)
    private static final String FRONTEND_URL = System.getenv().getOrDefault("FRONTEND_URL", "http://localhost:5173");

    @Value("${vapid.public:}")
    private String vapidPublic;

    @Value("${vapid.private:}")
    private String vapidPrivate;

    @Value("${vapid.subject:mailto:admin@yourapp.com}")
    private String vapidSubject;

    private final PushSubscriptionRepository subRepo;
    private final UserRepository userRepo;
    private final EmailService emailService;
    private PushService pushService;

    public WebPushService(PushSubscriptionRepository subRepo, UserRepository userRepo, EmailService emailService) {
        this.subRepo = subRepo;
        this.userRepo = userRepo;
        this.emailService = emailService;
    }

    @PostConstruct
    void init() {
        try {
            Security.addProvider(new BouncyCastleProvider());
            if (vapidPublic != null && !vapidPublic.isBlank() && !vapidPublic.contains("YOUR_VAPID") &&
                vapidPrivate != null && !vapidPrivate.isBlank() && !vapidPrivate.contains("YOUR_VAPID")) {
                
                pushService = new PushService()
                        .setPublicKey(Utils.loadPublicKey(vapidPublic))
                        .setPrivateKey(Utils.loadPrivateKey(vapidPrivate))
                        .setSubject(vapidSubject);
                System.out.println("✅ PushService initialized with configured VAPID keys.");
            } else {
                System.err.println("⚠️ VAPID keys not configured. PushService initialization skipped.");
            }
        } catch (Exception e) {
            System.err.println("❌ Error initializing PushService: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /** Push to every connected device. If none succeed, fall back to email. */
    public void notifyUser(Task task) {
        if (task.getUserId() == null) {
            System.err.println("⚠️ Task " + task.getId() + " has no userId associated.");
            return;
        }

        Optional<User> userOpt = userRepo.findById(task.getUserId());
        if (userOpt.isEmpty()) {
            System.err.println("❌ User not found for ID: " + task.getUserId());
            return;
        }

        User user = userOpt.get();
        List<PushSubscription> subs = subRepo.findByUser(user);

        boolean deliveredToDevice = false;
        
        if (pushService != null && !subs.isEmpty()) {
            for (PushSubscription s : subs) {
                if (sendPush(s, "Task Reminder", "Your task '" + task.getTitle() + "' is due!", FRONTEND_URL + "/")) {
                    deliveredToDevice = true;
                }
            }
        }

        // Unconnected device (no subscription, or all expired) -> email
        if (!deliveredToDevice) {
            System.out.println("📧 Fallback: Sending email reminder to " + user.getEmail() + " for task: " + task.getTitle());
            sendEmailReminder(user.getEmail(), task);
        }
    }

    /** Push to every connected device of user found by email. If none succeed, fall back to email. */
    @org.springframework.scheduling.annotation.Async
    public void notifyUserByEmail(String email, String title, String body, String link) {
        Optional<User> userOpt = userRepo.findByEmail(email);
        if (userOpt.isEmpty()) {
            System.err.println("❌ User not found for email: " + email);
            return;
        }

        User user = userOpt.get();
        List<PushSubscription> subs = subRepo.findByUser(user);

        boolean deliveredToDevice = false;

        if (pushService != null && !subs.isEmpty()) {
            for (PushSubscription s : subs) {
                if (sendPush(s, title, body, link)) {
                    deliveredToDevice = true;
                }
            }
        }

        if (!deliveredToDevice) {
            System.out.println("📧 Fallback: Sending email reminder to " + email);
            emailService.sendEmail(email, title, body + "\n\nView details: " + link);
        }
    }

    private boolean sendPush(PushSubscription s, String title, String body, String url) {
        try {
            String payload = """
                {"title":"%s","body":"%s","url":"%s"}
                """.formatted(title.replace("\"", "'"), body.replace("\"", "'"), url);

            Subscription sub = new Subscription(
                    s.getEndpoint(),
                    new Subscription.Keys(s.getP256dh(), s.getAuth()));

            HttpResponse response = pushService.send(new Notification(sub, payload));
            int status = response.getStatusLine().getStatusCode();

            if (status == 404 || status == 410) {  // subscription gone/expired
                System.out.println("🗑️ Web Push Subscription gone (status " + status + "). Removing endpoint: " + s.getEndpoint());
                subRepo.deleteByEndpoint(s.getEndpoint());
                return false;
            }
            return status >= 200 && status < 300;
        } catch (Exception e) {
            System.err.println("❌ Error sending Web Push: " + e.getMessage());
            return false;
        }
    }

    private void sendEmailReminder(String to, Task task) {
        emailService.sendEmail(
                to,
                "Reminder: " + task.getTitle(),
                "Hello,\n\nYour task is due.\n\nTask: " + task.getTitle()
                + "\nDescription: " + (task.getDescription() != null ? task.getDescription() : "")
                + "\nDue Time: " + task.getDueTime()
        );
    }
}
