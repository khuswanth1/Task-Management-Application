import React, { useEffect, useState } from "react";
import { messaging } from "../firebase";
import { getToken, onMessage } from "firebase/messaging";
import toast from "react-hot-toast";
import { playNotificationSound } from "../utils/sound";

const VAPID_KEY = "BJ4bXhXOf_ZHWqC_aiEz505uAFcsWfJUBjArlPOD38aRPPn5s6MhRtlUbaI6XHSvB0NJDdealjWDR5SaXhiW7JA";

const PushNotificationButton = ({ token, onTokenSaved, permission }) => {
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!messaging || !token) return;

    const setupNotifications = async () => {
      try {
        if (Notification.permission === "default") {
          const result = await Notification.requestPermission();
          if (result !== "granted") {
            console.warn("🔔 Notifications blocked by user");
            return;
          }
        }

        if (Notification.permission === "granted") {
          const registration = await navigator.serviceWorker.ready;

          const fcmToken = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration,
          });

          if (fcmToken) {
            console.log("🚀 FCM Token Ready:", fcmToken);

            const res = await fetch("/auth/update-profile", {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + token,
              },
              body: JSON.stringify({ deviceToken: fcmToken }),
            });

            if (res.ok) {
              setIsSubscribed(true);
              if (onTokenSaved) onTokenSaved();
            }
          }
        }
      } catch (err) {
        console.error("❌ Notification Setup Error:", err);
      }
    };

    setupNotifications();

    // Foreground listener using react-hot-toast for "Professional" look
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log("Foreground Message:", payload);

      const title = payload.notification?.title || payload.data?.title || "Mission Update";
      const body = payload.notification?.body || payload.data?.body || "Strategic objectives have been updated.";
      const icon = payload.notification?.icon || "/logo192.png";
      const image = payload.notification?.image || payload.data?.image;

      // Sound follows Settings → Sounds (mute, tone, volume, quiet hours)
      playNotificationSound("push");

      // Trigger Rich Native Desktop Notification
      if (Notification.permission === "granted") {
        const notificationOptions = {
          body: body,
          icon: icon,
          badge: "/logo192.png",
          image: image,
          vibrate: [200, 100, 200],
          tag: 'todo-pro-notification',
          renotify: true,
          requireInteraction: true, // Keep it on screen until user acts
          silent: false, // Let the OS play its sound
          data: payload.data
        };

        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(title, notificationOptions);
          });
        } else {
          new Notification(title, notificationOptions);
        }
      }


    });

    return () => unsubscribe();
  }, [token, onTokenSaved, permission]);

  return null;
};

export default PushNotificationButton;