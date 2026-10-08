import { playNotificationSound } from "./sound";

const VAPID_PUBLIC_KEY ="BEhnBs-FHnATTPJPxL_qiEcAHRMcOqmJRX0aZquqn5wpuo_-gQ3cbhYb-tYNLc9NHouAi_NFWYibY5cprEevrBM";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function enableNotifications(authToken) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    alert("Push notifications aren't supported on this browser.");
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    console.log("Service Worker registered:", registration);

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      alert("Notification permission denied.");
      return false;
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      console.log("No existing subscription found, creating new one...");
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    } else {
      console.log("Reusing existing push subscription.");
    }

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + authToken,
      },
      body: JSON.stringify(subscription),
    });

    if (res.ok) {
      console.log("Successfully subscribed to Web Push reminders.");
      return true;
    } else {
      console.error("Failed to register push subscription on backend.");
      return false;
    }
  } catch (err) {
    console.error("Error setting up push notifications:", err);
    return false;
  }
}

// Reminder/alert sound — tone, volume, mute and quiet hours come from Settings → Sounds
export function playAlertSound() {
  playNotificationSound("reminder");
}
