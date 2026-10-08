// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA-2qvZ7aSkD1B704a7xIQjlOnHVUIx-aY",
  authDomain: "todo-app-e34f5.firebaseapp.com",
  projectId: "todo-app-e34f5",
  storageBucket: "todo-app-e34f5.firebasestorage.app",
  messagingSenderId: "262967842543",
  appId: "1:262967842543:web:592b289a80d6c59e91ed1a",
});

const messaging = firebase.messaging();

// Professional Background Handler
messaging.onBackgroundMessage((payload) => {
  console.log('📬 [SW] Background Message:', payload);
  
  // If the browser/SDK automatically handles the notification payload, skip manual display to prevent duplicates
  if (payload.notification) {
    console.log('🔔 Notification handled automatically by SDK.');
    return;
  }

  const title = payload.data?.title || 'Mission Update';
  const notificationOptions = {
    body: payload.data?.body || 'You have a new update in your dashboard.',
    icon: payload.data?.icon || '/logo192.png',
    badge: '/logo192.png',
    image: payload.data?.image, // Large image support
    vibrate: [200, 100, 200],
    silent: false,
    data: {
      url: payload.data?.url || '/dashboard'
    },
    tag: 'mission-update', // Groups notifications
    renotify: true,
    requireInteraction: true, // Professional standard for mission-critical apps
    actions: [
      {
        action: 'open_url',
        title: 'View Update',
        icon: '/logo192.png'
      },
      {
        action: 'close',
        title: 'Dismiss'
      }
    ]
  };

  return self.registration.showNotification(title, notificationOptions);
});

// Professional Click Handling
self.addEventListener('notificationclick', (event) => {
  console.log('Notification Clicked:', event.notification.tag);
  
  event.notification.close();

  if (event.action === 'close') return;

  const urlToOpen = event.notification.data?.url || '/dashboard';
  const absoluteUrl = new URL(urlToOpen, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === absoluteUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(absoluteUrl);
      }
    })
  );
});

// VAPID Web Push Handler
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    // Only handle VAPID payload if it parsed as a valid JSON and has title/body
    if (data && (data.title || data.body)) {
      // Tell one open app tab (focused first) so it plays the user's chosen notification sound
      const notifyTab = self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((tabs) => {
        const tab = tabs.find((c) => c.focused) || tabs[0];
        if (tab) tab.postMessage({ type: 'push-received', event: data.event || 'push', title: data.title });
      });
      event.waitUntil(Promise.all([notifyTab,
        self.registration.showNotification(data.title || "Task Reminder", {
          body: data.body || "Your task is due!",
          icon: '/logo192.png',
          badge: '/logo192.png',
          vibrate: [200, 100, 200],
          silent: false,
          data: { url: data.url || '/dashboard' },
          actions: [
            {
              action: 'open_url',
              title: 'View Update'
            },
            {
              action: 'close',
              title: 'Dismiss'
            }
          ]
        })
      ]));
    }
  } catch (err) {
    // If payload is not JSON, it could be an FCM internal push message. Do not print errors to keep console clean.
    console.log("Non-JSON push event data received, likely handled by FCM SDK.");
  }
});

