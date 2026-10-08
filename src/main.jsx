import "./apiBase"; // must run first: routes API calls to the backend when hosted separately
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { Toaster } from "react-hot-toast";
import { I18nProvider } from "./i18n/I18nContext";


if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (let registration of registrations) {
      if (registration.active && 
          !registration.active.scriptURL.includes('firebase-messaging-sw.js')) {
        registration.unregister();
      }
    }
  });

  navigator.serviceWorker.register('/firebase-messaging-sw.js')
    .then(registration => {
      console.log('Service Worker registered with scope:', registration.scope);
    })
    .catch(error => {
      console.error('Service Worker registration failed:', error);
    });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <I18nProvider>
    <Toaster position="top-right" reverseOrder={false} />
    <App />
  </I18nProvider>
);
