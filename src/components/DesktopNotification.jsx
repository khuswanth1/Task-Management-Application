import React, { useEffect } from "react";
import { Notifications as NotificationsIcon } from "@mui/icons-material";
import toast from "react-hot-toast";
import { playNotificationSound } from "../utils/sound";

const DesktopNotification = ({ title = "Hello World", body = "This is a native desktop notification." }) => {
  useEffect(() => {
    if (!("Notification" in window)) {
      console.log("Browser does not support desktop notification");
    } else if (Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }, []);

  const playSound = () => playNotificationSound("push");

  const showNotification = () => {
    playSound(); // Play sound immediately

    // 1. Native OS Alert (if supported/granted)
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "/logo192.png", silent: false });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          new Notification(title, { body, icon: "/logo192.png", silent: false });
        }
      });
    }

    // 2. In-App Pop Format (Toast)
    toast.custom((t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-white shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 border-l-8 border-emerald-500 overflow-hidden`}
        onClick={() => toast.dismiss(t.id)}
        style={{ cursor: 'pointer' }}
      >
        <div className="flex-1 w-0 p-5">
          <div className="flex items-start">
            <div className="flex-shrink-0 pt-0.5">
              <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center shadow-lg border border-emerald-50">
                <NotificationsIcon className="h-7 w-7 text-emerald-600" />
              </div>
            </div>
            <div className="ml-4 flex-1">
              <div className="flex justify-between items-center mb-1">
                <p className="text-xs font-black text-emerald-600 tracking-widest">System • Just Now</p>
              </div>
              <p className="text-sm font-black text-slate-900 leading-tight">{title}</p>
              <p className="mt-1 text-xs text-slate-500 font-medium leading-relaxed">{body}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col border-l border-gray-100 bg-gray-50/50">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toast.dismiss(t.id);
            }}
            className="flex-1 px-4 flex items-center justify-center text-xs font-black text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-all vertical-text"
            style={{ writingMode: 'vertical-rl' }}
          >
            Dismiss
          </button>
        </div>
      </div>
    ), { duration: 5000, position: 'top-right' });
  };

  return (
    <button
      onClick={showNotification}
      className="mt-2 flex items-center justify-center gap-1 w-full text-[9px] font-black bg-slate-800 text-white px-3 py-2 rounded-lg hover:bg-slate-700 transition-all tracking-widest"
    >
      <NotificationsIcon sx={{ fontSize: 14 }} /> Native Desktop Alert
    </button>
  );
};

export default DesktopNotification;
