import React, { useEffect, useState, useCallback } from "react";
import Header from "../components/Header";
import toast from "react-hot-toast";
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  Add as AddIcon,
  AccessTime as AccessTimeIcon,
  Assignment as AssignmentIcon,
  Subtitles as SubtitlesIcon,
  FiberManualRecord as FiberManualRecordIcon,
  AddCircle as AddCircleIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  TrendingUp as TrendingUpIcon,
  Layers as LayersIcon,
  Save as SaveIcon,
  SwapHoriz as SwapHorizIcon,
  DragIndicator as DragIndicatorIcon,
  SubdirectoryArrowRight as SubdirectoryIcon,
  Notifications as NotificationsIcon,
  Check as CheckIcon
} from "@mui/icons-material";
import Settings from "./Settings";
import PushNotificationButton from "../components/PushNotificationButton";
import ProfileEditModal from "../components/ProfileEditModal";
import { enableNotifications, playAlertSound } from "../utils/webPush";
import { playNotificationSound } from "../utils/sound";
import { useI18n } from "../i18n/I18nContext";
import MultilingualInput from "../components/MultilingualInput";

export default function Dashboard({ token, setToken, theme, setTheme, isSystemDark, user, onProfileUpdate }) {
  const { t } = useI18n();
  const [tasks, setTasks] = useState([]);
  // Title suggestions: most recent task titles first (any language)
  const recentTitles = [...tasks].sort((a, b) => (b.id || 0) - (a.id || 0)).map(x => x.title).filter(Boolean).slice(0, 20);
  const timesOptions = Array.from({ length: 10 }, (_, i) => i + 1);
  const intervalOptions = [5, 10, 15, 30, 60, 120, 720, 1440];
  const intervalLabel = (m) => (m < 60 ? t('form.minutes', { n: m }) : m === 60 ? t('form.hour') : t('form.hours', { n: m / 60 }));
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [showSettings, setShowSettings] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('tab');
  });

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // UI State
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [activeParentId, setActiveParentId] = useState(null);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [sortMode, setSortMode] = useState("default"); // "default", "low", "medium", "high"

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "Medium",
    dueTime: "",
    status: "TODO",
    parentTaskId: null,
    remindAt: "",
    reminderCount: "",
    reminderInterval: ""
  });

  const [subTaskForm, setSubTaskForm] = useState({
    title: "",
    description: "",
    priority: "Low",
    dueTime: "",
    remindAt: "",
    reminderCount: "",
    reminderInterval: ""
  });

  const [selectedTaskIds, setSelectedTaskIds] = useState([]);

  // Notification State (Tracks multiple alert levels for each task)
  const [notifiedTasks, setNotifiedTasks] = useState({}); // { taskId: [levels_triggered] }

  // Notification Permission State
  const [notifStatus, setNotifStatus] = useState("default");
  const [isVapidSubscribed, setIsVapidSubscribed] = useState(
    localStorage.getItem("vapid_subscribed") === "true"
  );

  useEffect(() => {
    if ("Notification" in window) {
      setNotifStatus(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (token && "Notification" in window && Notification.permission === "granted") {
      enableNotifications(token).then(success => {
        if (success) {
          setIsVapidSubscribed(true);
          localStorage.setItem("vapid_subscribed", "true");
          console.log("Automatically synced VAPID subscription in background.");
        }
      });
    }
  }, [token]);

  const requestNotifPermission = () => {
    if ("Notification" in window) {
      Notification.requestPermission().then(status => {
        setNotifStatus(status);
      });
    }
  };

  const handleEnableReminders = async () => {
    const success = await enableNotifications(token);
    if (success) {
      playAlertSound();
      setNotifStatus("granted");
      setIsVapidSubscribed(true);
      localStorage.setItem("vapid_subscribed", "true");
      toast.success("Web Push reminders enabled on this device!");
    } else {
      toast.error("Failed to enable reminders.");
    }
  };


  // Send Email Notification (Calls Backend)
  const triggerEmailNotification = async (task, subjectOverride, messageOverride) => {
    if (!user || !user.email) {
      console.warn("Skipping email notification: No user email available.");
      return;
    }

    const subject = subjectOverride || `Urgent: Mission "${task.title}" Deadline`;
    const message = messageOverride || `Hello ${user.name}, your mission "${task.title}" is scheduled to conclude soon (${task.dueTime ? parseBackendDate(task.dueTime).toLocaleString() : 'N/A'}). Please ensure all objectives are met.`;

    console.log(`Triggering email notification for task: ${task.title} to ${user.email}`);
    try {
      const res = await fetch("/auth/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({
          to: user.email,
          subject: subject,
          message: message
        })
      });

      if (!res.ok) {
        const errorData = await res.text();
        console.error("Email notification endpoint returned error:", errorData);
      } else {
        console.log("Email notification request sent to backend successfully.");
      }
    } catch (err) {
      console.error("Email notification fetch failed:", err);
    }
  };

  // Send Push Notification (Calls Backend)
  const triggerPushNotification = useCallback(async (task, level) => {
    const currentPermission = "Notification" in window ? Notification.permission : "default";
    if (currentPermission !== "granted" || !user?.deviceToken) return;

    const titles = {
      overdue: "MISSION OVERDUE",
      critical: "CRITICAL ALERT",
      active: "SYSTEM TEST"
    };

    const images = {
      overdue: "https://cdn-icons-png.flaticon.com/512/595/595067.png", // Red Warning
      critical: "https://cdn-icons-png.flaticon.com/512/564/564619.png", // Amber Alert
      active: "https://cdn-icons-png.flaticon.com/512/190/190411.png" // Green Success
    };

    const title = titles[level] || "Mission Update";
    const message = level === "active" ? "Your device is now synced with the strategic command center." : `Task "${task.title}" is ${level}. Take immediate action.`;
    const image = images[level];

    try {
      playAlertSound();
      await fetch("/auth/send-push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({
          email: user.email,
          title,
          message,
          image,
          link: "http://localhost:5173/dashboard"
        })
      });
      console.log("Rich push notification request sent to backend.");
    } catch (err) {
      console.error("Push notification fetch failed:", err);
    }
  }, [user, token]);


  const fetchTasks = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/tasks?userId=${user.id}`, {
        headers: { Authorization: "Bearer " + token }
      });
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      console.error("Error fetching tasks", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, token]);

  // Google Calendar connection status, for the "Connect Google Calendar" banner
  const [calendarStatus, setCalendarStatus] = useState(null);
  const [calendarDismissed, setCalendarDismissed] = useState(() => {
    try { return sessionStorage.getItem("gcal-banner-dismissed") === "1"; } catch { return false; }
  });

  useEffect(() => {
    if (!token) return;
    fetch("/api/calendar/google/status", { headers: { Authorization: "Bearer " + token } })
      .then(res => (res.ok ? res.json() : null))
      .then(setCalendarStatus)
      .catch(() => setCalendarStatus(null));
  }, [token]);

  const connectGoogleCalendar = async () => {
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch(`/api/calendar/google/auth-url?timeZone=${encodeURIComponent(timeZone)}`, {
        headers: { Authorization: "Bearer " + token }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Failed to start Google sign-in");
      window.location.href = data.url;
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Tasks only reach Google Calendar once it is connected — tell the user right after they save one
  const calendarHint = useCallback(async (hasDeadline) => {
    if (!hasDeadline) return;
    try {
      const res = await fetch("/api/calendar/google/status", { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) return;
      const status = await res.json();
      if (status.connected) {
        toast.success("Sent to Google Calendar 📅", { id: "gcal-hint" });
      } else if (status.configured) {
        toast("Connect Google Calendar in Settings → Google Calendar to see this task there.", { id: "gcal-hint", icon: "📅", duration: 6000 });
      }
    } catch {
      // status is best-effort; never block task saving
    }
  }, [token]);

  const handleCreateOrUpdate = async (e) => {
    if (e) e.preventDefault();
    const isEdit = !!editingTask;
    const url = isEdit ? `/tasks/${editingTask.id}` : "/tasks";
    const method = isEdit ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({
          ...form,
          userId: user.id,
          dueTime: form.dueTime ? new Date(form.dueTime).toISOString() : null,
          remindAt: form.reminderInterval
            ? (isEdit && editingTask.reminderInterval === parseInt(form.reminderInterval)
                ? (editingTask.remindAt ? new Date(editingTask.remindAt).toISOString() : new Date(Date.now() + parseInt(form.reminderInterval) * 60 * 1000).toISOString())
                : new Date(Date.now() + parseInt(form.reminderInterval) * 60 * 1000).toISOString())
            : null,
          reminderCount: form.reminderCount ? parseInt(form.reminderCount) : null,
          reminderInterval: form.reminderInterval ? parseInt(form.reminderInterval) : null
        })
      });

      if (res.ok) {
        // Send email for both creation and modification
        triggerEmailNotification(
          { title: form.title, dueTime: form.dueTime },
          isEdit ? `Mission Updated: ${form.title}` : `Mission Initiated: ${form.title}`,
          isEdit
            ? `Hello ${user.name}, the parameters for your mission "${form.title}" have been updated.`
            : `Hello ${user.name}, a new mission has been added to your log: "${form.title}".`
        );
        if (!isEdit) playNotificationSound("taskCreated");
        calendarHint(!!form.dueTime);
        resetForms();
        fetchTasks();
      }
    } catch (err) {
      console.error("Error saving task", err);
    }
  };

  const resetForms = () => {
    setForm({ title: "", description: "", priority: "Medium", dueTime: "", status: "TODO", parentTaskId: null, remindAt: "", reminderCount: "", reminderInterval: "" });
    setSubTaskForm({ title: "", description: "", priority: "Low", dueTime: "", remindAt: "", reminderCount: "", reminderInterval: "" });
    setShowAddForm(false);
    setEditingTask(null);
    setActiveParentId(null);
  };

  const updatePriority = async (task, newPriority) => {
    // Optimistic UI Update: Update priority instantly in local state
    setTasks(prevTasks =>
      prevTasks.map(t => (t.id === task.id ? { ...t, priority: newPriority } : t))
    );

    try {
      await fetch(`/tasks/${task.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({ ...task, priority: newPriority })
      });
      fetchTasks();
    } catch (err) {
      console.error("Error updating priority", err);
    }
  };

  const toggleStatus = async (task) => {
    const newStatus = task.status === "DONE" ? "TODO" : "DONE";

    const completedTimestamp = newStatus === "DONE" ? new Date().toISOString() : null;

    // Optimistic UI Update: Update status instantly in local state
    setTasks(prevTasks =>
      prevTasks.map(t => {
        if (t.id === task.id) {
          return {
            ...t,
            status: newStatus,
            completedAt: completedTimestamp
          };
        }
        return t;
      })
    );

    if (newStatus === "DONE") {
      triggerPushNotification(task, "completed");

      // 🔊 Sound when marking as DONE (configurable in Settings → Sounds)
      playNotificationSound("taskDone");

      if (Notification.permission === "granted") {
        new Notification("Mission Accomplished", {
          body: `Mission "${task.title}" has been successfully completed.`,
          icon: "/logo192.png",
          silent: false // ensure native sound may also play if OS supports it
        });
      }
    }

    try {
      await fetch(`/tasks/${task.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({ ...task, status: newStatus, completedAt: completedTimestamp })
      });

      fetchTasks();
    } catch (err) {
      console.error("Error updating status", err);
    }
  };

  const moveTask = async (taskId, newParentId, newPos = null, newPriority = null) => {
    if (!taskId) return;
    try {
      // Include the task's existing remindAt so this partial update doesn't
      // trip the backend's "no remindAt in payload -> clear the reminder" logic.
      // `tasks` is a flat list containing both main tasks and subtasks.
      const existing = tasks.find(t => t.id === taskId);
      const config = {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({
          parentTaskId: newParentId,
          position: newPos,
          remindAt: existing?.remindAt ?? null,
          ...(newPriority ? { priority: newPriority } : {})
        })
      };
      await fetch(`/tasks/${taskId}`, config);
    } catch (err) {
      console.error("Critical movement failure:", err);
    }
  };

  const addSubTask = async (e) => {
    if (e) e.preventDefault();
    if (!subTaskForm.title) return;

    try {
      const res = await fetch("/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({
          title: subTaskForm.title,
          description: subTaskForm.description,
          priority: subTaskForm.priority,
          dueTime: subTaskForm.dueTime ? new Date(subTaskForm.dueTime).toISOString() : null,
          userId: user.id,
          parentTaskId: activeParentId,
          status: "TODO",
          remindAt: subTaskForm.reminderInterval ? new Date(Date.now() + parseInt(subTaskForm.reminderInterval) * 60 * 1000).toISOString() : null,
          reminderCount: subTaskForm.reminderCount ? parseInt(subTaskForm.reminderCount) : null,
          reminderInterval: subTaskForm.reminderInterval ? parseInt(subTaskForm.reminderInterval) : null
        })
      });

      if (res.ok) {
        triggerEmailNotification(
          { title: subTaskForm.title, dueTime: subTaskForm.dueTime },
          `Milestone Added: ${subTaskForm.title}`,
          `Hello ${user.name}, a new milestone objective has been added to your mission log: "${subTaskForm.title}".`
        );
        // A sub-task without its own deadline goes on the calendar at its main task's deadline
        calendarHint(!!subTaskForm.dueTime || !!tasks.find(t => t.id === activeParentId)?.dueTime);
        resetForms();
        fetchTasks();
      }
    } catch (err) {
      console.error("Error adding subtask", err);
    }
  };

  const deleteTask = async (id) => {
    try {
      await fetch(`/tasks/${id}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token }
      });
      // Remove from selected list if present
      setSelectedTaskIds(prev => prev.filter(selectedId => selectedId !== id));
      fetchTasks();
    } catch (err) {
      console.error("Error deleting task", err);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTaskIds.length === 0) return;
    try {
      const res = await fetch("/tasks/bulk", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(selectedTaskIds)
      });
      if (res.ok) {
        setSelectedTaskIds([]);
        fetchTasks();
      }
    } catch (err) {
      console.error("Error bulk deleting tasks", err);
    }
  };

  const parseBackendDate = (dateStr) => {
    if (!dateStr) return null;
    const normalizedStr = (dateStr.endsWith("Z") || dateStr.match(/[+-]\d{2}:\d{2}$/)) ? dateStr : dateStr + "Z";
    return new Date(normalizedStr);
  };

  const formatDateForInput = (dateStr) => {
    if (!dateStr) return "";
    const date = parseBackendDate(dateStr);
    if (!date || isNaN(date.getTime())) return "";
    const pad = (num) => String(num).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const startEdit = (task) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority || "Medium",
      dueTime: formatDateForInput(task.dueTime),
      status: task.status || "TODO",
      parentTaskId: task.parentTaskId,
      remindAt: formatDateForInput(task.remindAt),
      reminderCount: task.reminderCount || "",
      reminderInterval: task.reminderInterval || ""
    });
    setShowAddForm(true);
  };

  useEffect(() => {
    if (user) fetchTasks();
  }, [user, fetchTasks]);

  // Color & Sort System
  const priorityOrder = { High: 3, Medium: 2, Low: 1 };

  const priorityStyles = {
    High: {
      border: "border-l-[6px] border-l-rose-500",
      badge: "bg-rose-100 text-rose-700 border-rose-200",
      dot: "bg-rose-500",
      card: "bg-rose-50/30",
      shadow: "hover:shadow-rose-100"
    },
    Medium: {
      border: "border-l-[6px] border-l-amber-500",
      badge: "bg-amber-100 text-amber-700 border-amber-200",
      dot: "bg-amber-500",
      card: "bg-amber-50/30",
      shadow: "hover:shadow-amber-100"
    },
    Low: {
      border: "border-l-[6px] border-l-emerald-500",
      badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
      dot: "bg-emerald-500",
      card: "bg-emerald-50/30",
      shadow: "hover:shadow-emerald-100"
    }
  };

  const handleDragStart = (e, taskId, isMain) => {
    e.stopPropagation(); // ✅ FIX
    setDraggedTaskId(taskId);
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.setData("isMain", isMain.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, targetId) => {
    e.preventDefault();
    e.stopPropagation(); // ✅ FIX

    if (draggedTaskId && draggedTaskId !== targetId) {
      setDropTargetId(targetId);
    }
  };

  const handleDrop = async (e, targetId, targetIsMain = false) => {
    e.preventDefault();
    e.stopPropagation(); // ✅ FIX

    const sourceId = parseInt(e.dataTransfer.getData("taskId"));
    const sourceIsMain = e.dataTransfer.getData("isMain") === "true";

    if (!sourceId || sourceId === targetId) return;

    const sourceTask = tasks.find(t => t.id === sourceId);
    const targetTask = tasks.find(t => t.id === targetId);

    if (!sourceTask || !targetTask) return;

      let currentList = [];
      let parentId = null;

      if (sourceIsMain && targetIsMain) {
        currentList = sortedTasks.filter(t => t.parentTaskId === null);
      } else if (!sourceIsMain && !targetIsMain && sourceTask.parentTaskId === targetTask.parentTaskId) {
        currentList = sortedTasks.filter(t => t.parentTaskId === sourceTask.parentTaskId);
        parentId = sourceTask.parentTaskId;
      } else {
        return; // Invalid drop
      }

      // Reorder array
      const sIndex = currentList.findIndex(t => t.id === sourceId);
      const tIndex = currentList.findIndex(t => t.id === targetId);
      if (sIndex === -1 || tIndex === -1) return;

      // Dropping onto a task of another priority SWAPS their priorities
      // (drag a Low task onto a High one -> dragged becomes High, the High one becomes Low).
      // Works for main tasks and sub-tasks.
      const sourcePriority = sourceTask.priority || "Medium";
      const targetPriority = targetTask.priority || "Medium";
      const swap = sourcePriority !== targetPriority;
      const newPriorityFor = (id) => {
        if (!swap) return null;
        if (id === sourceId) return targetPriority;
        if (id === targetId) return sourcePriority;
        return null;
      };

      // Swap the two tasks' places in the list
      currentList[sIndex] = targetTask;
      currentList[tIndex] = sourceTask;

      // Positions are renumbered 0, 10, 20… in the new order; only changed ones are saved
      const updates = currentList
        .map((t, i) => ({ id: t.id, position: i * 10, priority: newPriorityFor(t.id), oldPosition: t.position }))
        .filter(u => u.position !== u.oldPosition || u.priority);

      // Optimistic Update
      setTasks(prevTasks => prevTasks.map(t => {
        const u = updates.find(x => x.id === t.id);
        return u ? { ...t, position: u.position, ...(u.priority ? { priority: u.priority } : {}) } : t;
      }));
      setDropTargetId(null);
      if (swap) {
        toast.success(`Swapped priority: "${sourceTask.title}" ${sourcePriority} → ${targetPriority}, "${targetTask.title}" ${targetPriority} → ${sourcePriority}`);
      }

      try {
        // Order first (no priority in these updates), then one swap call so the backend
        // sends a single device notification for the pair
        await Promise.all(updates.map(u => moveTask(u.id, parentId, u.position)));
        if (swap) {
          const res = await fetch("/tasks/swap-priority", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
            body: JSON.stringify({ sourceId, targetId })
          });
          if (!res.ok) toast.error("Could not swap priorities.");
        }
        fetchTasks();
      } catch (err) {
        console.error("Swap failed:", err);
        fetchTasks();
      }
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDropTargetId(null);
  };
  const handleDropOnDashboard = (e) => {
    if (e.target === e.currentTarget) {
      const sourceId = parseInt(e.dataTransfer.getData("taskId"));
      const sourceIsMain = e.dataTransfer.getData("isMain") === "true";
      // Promote subtask to standalone mission
      if (sourceId && !sourceIsMain) moveTask(sourceId, null, -1).then(fetchTasks);
    }
  };

  // Sorting and Grouping
  const sortedTasks = [...tasks].filter(t => {
    if (t.status === "DONE") {
      if (!t.completedAt) return true; // Keep completed tasks if they lack a completedAt timestamp
      const completedTime = parseBackendDate(t.completedAt).getTime();
      if (isNaN(completedTime)) return true; // Keep if the timestamp is an invalid date format
      if ((now - completedTime) > 10 * 60 * 1000) {
        return false;
      }
    }
    
    return true;
  }).sort((a, b) => {
    const posA = a.position !== null && a.position !== undefined ? a.position : 9999;
    const posB = b.position !== null && b.position !== undefined ? b.position : 9999;
    
    const prioA = a.priority || "Medium";
    const prioB = b.priority || "Medium";

    if (sortMode === "default") {
      // Default: Priority High->Low, then Position
      const prioDiff = priorityOrder[prioB] - priorityOrder[prioA];
      if (prioDiff !== 0) return prioDiff;
      return posA - posB;
    }
    
    // For specific priority selections, put that priority at the top
    const isASearchPrio = prioA.toLowerCase() === sortMode;
    const isBSearchPrio = prioB.toLowerCase() === sortMode;
    
    if (isASearchPrio && !isBSearchPrio) return -1;
    if (!isASearchPrio && isBSearchPrio) return 1;
    
    // Otherwise fallback to natural priority, then position
    const prioDiff = priorityOrder[prioB] - priorityOrder[prioA];
    if (prioDiff !== 0) return prioDiff;
    return posA - posB;
  });

  const mainTasks = sortedTasks
    .filter((t) => t.parentTaskId === null)
    .filter((t) => {
      const q = searchQuery.toLowerCase();
      const titleMatch = t.title.toLowerCase().includes(q);
      const descMatch = t.description?.toLowerCase().includes(q);

      // If the parent matches, show it.
      if (titleMatch || descMatch) return true;

      // Also show the parent if any of its children match
      const children = sortedTasks.filter(sub => sub.parentTaskId === t.id);
      return children.some(sub =>
        sub.title.toLowerCase().includes(q) ||
        sub.description?.toLowerCase().includes(q)
      );
    });

  const getSubTasks = (parentId) =>
    sortedTasks
      .filter((t) => t.parentTaskId === parentId)
      .filter(t => {
        const q = searchQuery.toLowerCase();
        // If the query is empty, show all subtasks
        if (!q) return true;

        // Otherwise, show subtask if it matches OR if parent matched (handled by parent logic)
        return t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q);
      });

  return (
    <main
      className={`min-h-screen font-sans pb-24 transition-colors duration-500
        ${theme === 'dark' || (theme === 'system' && isSystemDark)
          ? 'bg-slate-950 text-slate-100'
          : 'bg-[#f8fafc] text-slate-900'
        }`}
      style={user?.logoImage ? {
        // Fit / position / darken come from Settings → Theme → Background (CSS variables)
        backgroundImage: `linear-gradient(rgba(0,0,0,var(--bg-dim,0)), rgba(0,0,0,var(--bg-dim,0))), url(${user.logoImage})`,
        backgroundSize: 'var(--bg-size, cover)',
        backgroundPosition: 'var(--bg-position, center)',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'var(--bg-repeat, no-repeat)'
      } : {}}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDropOnDashboard}
    >
      <Header
        user={user}
        setToken={setToken}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onEditProfile={() => setShowEditProfile(true)}
        theme={theme}
        setTheme={setTheme}
        isSystemDark={isSystemDark}
        onOpenSettings={() => setShowSettings(true)}
        onGoHome={() => setShowSettings(false)}
      />
      <PushNotificationButton token={token} onTokenSaved={onProfileUpdate} permission={notifStatus} />

      {showSettings ? (
        <Settings user={user} token={token} setToken={setToken} theme={theme} setTheme={setTheme} isSystemDark={isSystemDark} onProfileUpdate={onProfileUpdate} onReset={fetchTasks} onClose={() => {
          setShowSettings(false);
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('tab');
          window.history.pushState({}, '', newUrl);
        }} />
      ) : (
        <div className="max-w-7xl mx-auto px-3 md:px-6 mt-8 pointer-events-none children:pointer-events-auto">
        <div className="pointer-events-auto">
          {/* GOOGLE CALENDAR SETUP BANNER (shown until the calendar is connected) */}
          {calendarStatus?.configured && !calendarStatus.connected && !calendarDismissed && (
            <div className={`mb-6 p-4 rounded-3xl border flex flex-col sm:flex-row sm:items-center gap-3
              ${theme === 'dark' || (theme === 'system' && isSystemDark)
                ? 'bg-indigo-950/40 border-indigo-900 text-slate-200'
                : 'bg-indigo-50 border-indigo-100 text-slate-700'}`}>
              <span className="text-2xl" aria-hidden="true">📅</span>
              <div className="flex-1 text-sm">
                <b>{t('cal.bannerTitle')}</b> {t('cal.bannerText')}
              </div>
              <div className="flex gap-2">
                <button onClick={connectGoogleCalendar}
                  className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold">
                  {t('cal.connect')}
                </button>
                <button onClick={() => { setCalendarDismissed(true); try { sessionStorage.setItem("gcal-banner-dismissed", "1"); } catch { /* ignore */ } }}
                  className="px-3 py-2 rounded-2xl text-sm font-bold opacity-70 hover:opacity-100" aria-label="Dismiss">
                  {t('cal.later')}
                </button>
              </div>
            </div>
          )}

          {/* STATS BAR & NOTIFICATIONS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: t('stats.active'), val: mainTasks.filter(t => !t.dueTime || parseBackendDate(t.dueTime) >= new Date()).length, icon: <LayersIcon />, color: "text-indigo-600 bg-indigo-50" },
              { label: t('stats.critical'), val: tasks.filter(t => t.priority === "High" && (!t.dueTime || parseBackendDate(t.dueTime) >= new Date())).length, icon: <ErrorIcon />, color: "text-rose-600 bg-rose-50" },
              { label: t('stats.completed'), val: tasks.filter(t => t.dueTime && parseBackendDate(t.dueTime) < new Date()).length, icon: <CheckCircleIcon />, color: "text-emerald-600 bg-emerald-50" },
            ].map((stat, i) => (
              <div key={i} className={`p-4 rounded-3xl shadow-sm flex items-center gap-4 border transition-all duration-300 hover:shadow-md
                ${theme === 'dark' || (theme === 'system' && isSystemDark)
                  ? 'bg-slate-900 border-slate-800 shadow-black/20'
                  : 'bg-white border-slate-100 shadow-slate-200/50'
                }`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${stat.color} shadow-inner`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-slate-400 text-[10px] font-black tracking-[0.2em] leading-none mb-1.5">{stat.label}</p>
                  <h4 className={`text-2xl font-black leading-none ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'text-white' : 'text-slate-800'}`}>{stat.val}</h4>
                </div>
              </div>
            ))}
          </div>

          {/* HEADER SECTION */}
          <div className="flex justify-between items-center mb-4">
            <h2 className={`text-3xl font-black tracking-tight ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'text-white' : 'text-slate-800'}`}>{t('board.title')}</h2>
            <div className="flex items-center gap-3">


              <div className="relative group hidden sm:block">
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value)}
                  className={`appearance-none px-4 py-3 pr-9 rounded-xl border text-xs font-bold tracking-wide shadow-sm focus:outline-none transition-all duration-300 cursor-pointer hover:shadow-md
                    ${theme === "dark" || (theme === 'system' && isSystemDark)
                      ? "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750"
                      : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                    }`}
                >
                  <option value="default">{t('sort.label')}</option>
                  <option value="low">{t('priority.Low')}</option>
                  <option value="medium">{t('priority.Medium')}</option>
                  <option value="high">{t('priority.High')}</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
              
              {!isVapidSubscribed && (
                <button
                  onClick={handleEnableReminders}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95 text-xs bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200/20"
                >
                  <NotificationsIcon fontSize="small" /> {t('btn.enableReminders')}
                </button>
              )}
              {selectedTaskIds.length > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95 text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-rose-200/20"
                >
                  <DeleteIcon fontSize="small" /> {t('btn.delete', { n: selectedTaskIds.length })}
                </button>
              )}
              <button
                onClick={() => { setEditingTask(null); setForm({ title: "", description: "", priority: "Medium", dueTime: "", status: "TODO", parentTaskId: null, remindAt: "", reminderCount: "", reminderInterval: "" }); setShowAddForm(true); }}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95 text-xs
                  ${theme === 'dark' || (theme === 'system' && isSystemDark)
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/20'
                    : 'bg-slate-900 hover:bg-indigo-600 text-white shadow-slate-200'
                  }`}
              >
                <AddIcon fontSize="small" /> {t('btn.newTask')}
              </button>
            </div>
          </div>
        </div>

        {/* COMPREHENSIVE EDIT/CREATE MODAL */}
        {showAddForm && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[200] flex items-center justify-center p-8 sm:p-8 pointer-events-auto">
                        {/* <div className={`rounded-[2rem] shadow-2xl w-full max-w-2xl p-4 min-h-[75vh] sm:p-6 animate-in zoom-in-95 duration-200 border max-h-[150vh] overflow-y-auto scrollbar-hide */}

            <div className={`rounded-[2rem] shadow-2xl w-full max-w-2xl p-4 sm:p-6 animate-in zoom-in-150 duration-200 border max-h-[250vh] overflow-y-auto scrollbar-hide
              ${theme === 'dark' || (theme === 'system' && isSystemDark)
                ? 'bg-slate-900 border-slate-800 text-white'
                : 'bg-white border-white text-slate-800'
              }`}>
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center
                    ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}
                  `}>
                    {editingTask ? <EditIcon sx={{ fontSize: 24 }} /> : <AssignmentIcon sx={{ fontSize: 24 }} />}
                  </div>
                  <div>
                    <h2 className="text-xl font-black tracking-tight">
                      {editingTask ? t('form.editTitle') : t('form.createTitle')}
                    </h2>
                    <p className="text-slate-400 font-bold text-[10px]">{t('form.subtitle')}</p>
                  </div>
                </div>
                <button onClick={resetForms} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all
                  ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-800 text-slate-500 hover:bg-rose-500/20 hover:text-rose-400' : 'bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500'}
                `}>
                  <CloseIcon sx={{ fontSize: 20 }} />
                </button>
              </div>

              <form onSubmit={handleCreateOrUpdate} className="space-y-3">
                <div className={`flex gap-2 p-3 rounded-2xl border
                  ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}
                `}>
                  <MultilingualInput
                    required
                    value={form.title}
                    onValueChange={(v) => setForm(f => ({ ...f, title: v }))}
                    ideas={{ recent: recentTitles }}
                    className={`w-full rounded-xl px-4 py-3 font-black outline-none text-base shadow-sm border transition-all
                      ${theme === 'dark' || (theme === 'system' && isSystemDark)
                        ? 'bg-slate-800 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10'
                        : 'bg-white border-slate-200 text-slate-800 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5'}
                    `}
                    placeholder={t('form.titlePlaceholder')}
                  />
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className={`rounded-xl px-3 py-3 font-black outline-none text-[11px] shadow-sm border cursor-pointer transition-all
                      ${theme === 'dark' || (theme === 'system' && isSystemDark)
                        ? 'bg-slate-800 border-slate-700/50 text-slate-300 focus:border-indigo-500/50'
                        : 'bg-white border-slate-200 text-slate-600 focus:border-indigo-500/50'}
                    `}
                  >
                    <option value="High">🔴 {t('priority.High')}</option>
                    <option value="Medium">🟠 {t('priority.Medium')}</option>
                    <option value="Low">🟢 {t('priority.Low')}</option>
                  </select>
                </div>

                <div className={`p-3 rounded-2xl border space-y-1
                  ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}
                `}>
                  <label className="text-[8px] font-black text-slate-400 tracking-widest ml-2 flex items-center gap-2">
                    <AccessTimeIcon sx={{ fontSize: 12 }} /> {t('form.deadline')}
                  </label>
                  <input
                    type="datetime-local"
                    value={form.dueTime}
                    onChange={(e) => setForm({ ...form, dueTime: e.target.value })}
                    className={`w-full rounded-xl px-4 py-3 font-black outline-none text-xs shadow-sm border cursor-pointer transition-all
                      ${theme === 'dark' || (theme === 'system' && isSystemDark)
                        ? 'bg-slate-800 border-slate-700/50 text-slate-300 focus:border-indigo-500/50'
                        : 'bg-white border-slate-200 text-slate-600 focus:border-indigo-500/50'}
                    `}
                  />
                </div>

                <div className={`p-4 rounded-2xl border space-y-3
                  ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}
                `}>
                  <label className="text-[8px] font-black text-slate-400 tracking-widest ml-2 flex items-center gap-2">
                    <NotificationsIcon sx={{ fontSize: 12 }} /> {t('form.reminders')}
                  </label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[7.5px] font-black text-slate-400 tracking-wider ml-1">{t('form.repetitions')}</span>
                      <select
                        value={form.reminderCount}
                        onChange={(e) => setForm({ ...form, reminderCount: e.target.value })}
                        className={`w-full rounded-xl px-3 py-2.5 font-black outline-none text-xs shadow-sm border transition-all cursor-pointer
                          ${theme === 'dark' || (theme === 'system' && isSystemDark)
                            ? 'bg-slate-800 border-slate-700/50 text-slate-300 focus:border-indigo-500/50'
                            : 'bg-white border-slate-200 text-slate-600 focus:border-indigo-500/50'}
                        `}
                      >
                        <option value="">{t('form.noRepetition')}</option>
                        {timesOptions.map(n => <option key={n} value={n}>{n === 1 ? t('form.once') : t('form.times', { n })}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[7.5px] font-black text-slate-400 tracking-wider ml-1">{t('form.interval')}</span>
                      <select
                        value={form.reminderInterval}
                        onChange={(e) => setForm({ ...form, reminderInterval: e.target.value })}
                        className={`w-full rounded-xl px-3 py-2.5 font-black outline-none text-xs shadow-sm border transition-all cursor-pointer
                          ${theme === 'dark' || (theme === 'system' && isSystemDark)
                            ? 'bg-slate-800 border-slate-700/50 text-slate-300 focus:border-indigo-500/50'
                            : 'bg-white border-slate-200 text-slate-600 focus:border-indigo-500/50'}
                        `}
                      >
                        <option value="">{t('form.noReminders')}</option>
                        <option value="1">{t('form.minute')} ({t('form.testing')})</option>
                        {intervalOptions.map(m => <option key={m} value={m}>{intervalLabel(m)}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className={`p-3 rounded-2xl border space-y-1
                  ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}
                `}>
                  <label className="text-[8px] font-black text-slate-400 tracking-widest ml-2 flex items-center gap-2">
                    <SwapHorizIcon sx={{ fontSize: 12 }} /> {t('form.placement')}
                  </label>
                  <select
                    value={form.parentTaskId || ""}
                    onChange={(e) => setForm({ ...form, parentTaskId: e.target.value ? parseInt(e.target.value) : null })}
                    className={`w-full rounded-xl px-4 py-3 font-black outline-none text-xs shadow-sm border cursor-pointer transition-all
                      ${theme === 'dark' || (theme === 'system' && isSystemDark)
                        ? 'bg-slate-800 border-slate-700/50 text-slate-300 focus:border-indigo-500/50'
                        : 'bg-white border-slate-200 text-slate-800 focus:border-indigo-500/50'}
                    `}
                  >
                    <option value="">{t('form.standalone')}</option>
                    {mainTasks.filter(mt => mt.id !== editingTask?.id).map(mt => (
                      <option key={mt.id} value={mt.id}>{t('form.subtaskOf', { title: mt.title })}</option>
                    ))}
                  </select>
                </div>

                <div className={`p-3 rounded-2xl border space-y-1
                  ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}
                `}>
                  <label className="text-[8px] font-black text-slate-400 tracking-widest ml-2 flex items-center gap-2">
                    <SubtitlesIcon sx={{ fontSize: 12 }} /> {t('form.description')}
                  </label>
                  <MultilingualInput
                    as="textarea"
                    dropUp
                    rows="2"
                    value={form.description}
                    onValueChange={(v) => setForm(f => ({ ...f, description: v }))}
                    className={`w-full rounded-xl px-4 py-3 font-bold outline-none resize-none shadow-sm border text-xs transition-all
                      ${theme === 'dark' || (theme === 'system' && isSystemDark)
                        ? 'bg-slate-800 border-slate-700/50 text-slate-400 placeholder:text-slate-600 focus:border-indigo-500/50'
                        : 'bg-white border-slate-200 text-slate-500 focus:border-indigo-500/50'}
                    `}
                    placeholder={t('form.descPlaceholder')}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={resetForms}
                    className={`flex-1 font-black py-4 rounded-[1.5rem] shadow-lg transition-all active:scale-[0.98] text-sm border
                      ${theme === 'dark' || (theme === 'system' && isSystemDark)
                        ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    {t('btn.cancel')}
                  </button>
                  <button
                    type="submit"
                    className={`flex-[2] font-black py-4 rounded-[1.5rem] shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-base
                      ${theme === 'dark' || (theme === 'system' && isSystemDark)
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/40'
                        : 'bg-slate-900 hover:bg-indigo-600 text-white shadow-indigo-100'
                      }`}
                  >
                    {editingTask ? <SaveIcon sx={{ fontSize: 20 }} /> : <AddIcon sx={{ fontSize: 20 }} />}
                    {editingTask ? t('btn.updateTask') : t('btn.createTask')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MILESTONE CREATION MODAL */}
        {activeParentId && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[201] flex items-center justify-center p-4 pointer-events-auto">
            <div className={`rounded-[2rem] shadow-2xl w-full max-w-md p-7 animate-in zoom-in-95 duration-200 border max-h-[90vh] overflow-y-auto scrollbar-hide
              ${theme === 'dark' || (theme === 'system' && isSystemDark)
                ? 'bg-slate-900 border-slate-800 text-white'
                : 'bg-white border-white text-slate-800'
              }`}>
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center
                    ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}
                  `}>
                    <AddCircleIcon sx={{ fontSize: 24 }} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black tracking-tight">{t('sub.title')}</h2>
                    <p className="text-slate-400 font-bold text-[10px]">{t('sub.subtitle')}</p>
                  </div>
                </div>
                <button onClick={resetForms} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all
                  ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-800 text-slate-500 hover:bg-rose-500/20 hover:text-rose-400' : 'bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500'}
                `}>
                  <CloseIcon sx={{ fontSize: 20 }} />
                </button>
              </div>
              <form onSubmit={addSubTask} className="space-y-3">
                <div className={`p-3 rounded-2xl border space-y-1
                  ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}
                `}>
                  <label className="text-[8px] font-black text-slate-400 tracking-widest ml-2">{t('sub.name')}</label>
                  <MultilingualInput
                    autoFocus
                    required
                    placeholder={t('sub.namePlaceholder')}
                    value={subTaskForm.title}
                    onValueChange={(v) => setSubTaskForm(f => ({ ...f, title: v }))}
                    ideas={{ recent: recentTitles }}
                    className={`w-full rounded-xl px-4 py-3 font-black outline-none text-xs shadow-sm border transition-all
                      ${theme === 'dark' || (theme === 'system' && isSystemDark)
                        ? 'bg-slate-800 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10'
                        : 'bg-white border-slate-200 text-slate-800 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5'}
                    `}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className={`p-3 rounded-2xl border space-y-1
                    ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}
                  `}>
                    <label className="text-[8px] font-black text-slate-400 tracking-widest ml-2 flex items-center gap-2">
                      <FiberManualRecordIcon sx={{ fontSize: 10 }} /> {t('sub.urgency')}
                    </label>
                    <select
                      value={subTaskForm.priority}
                      onChange={(e) => setSubTaskForm({ ...subTaskForm, priority: e.target.value })}
                      className={`w-full rounded-xl px-4 py-3 font-black outline-none text-xs shadow-sm border cursor-pointer transition-all
                        ${theme === 'dark' || (theme === 'system' && isSystemDark)
                          ? 'bg-slate-800 border-slate-700/50 text-white focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10'
                          : 'bg-white border-slate-200 text-slate-600 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5'}
                      `}
                    >
                      <option value="High">🔴 {t('priority.High')}</option>
                      <option value="Medium">🟠 {t('priority.Medium')}</option>
                      <option value="Low">🟢 {t('priority.Low')}</option>
                    </select>
                  </div>

                  <div className={`p-3 rounded-2xl border space-y-1
                    ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}
                  `}>
                    <label className="text-[8px] font-black text-slate-400 tracking-widest ml-2 flex items-center gap-2">
                      <AccessTimeIcon sx={{ fontSize: 12 }} /> {t('sub.timeline')}
                    </label>
                    <input
                      type="datetime-local"
                      value={subTaskForm.dueTime}
                      onChange={(e) => setSubTaskForm({ ...subTaskForm, dueTime: e.target.value })}
                      className={`w-full rounded-xl px-4 py-3 font-black outline-none text-xs shadow-sm border cursor-pointer transition-all
                        ${theme === 'dark' || (theme === 'system' && isSystemDark)
                          ? 'bg-slate-800 border-slate-700/50 text-white focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10'
                          : 'bg-white border-slate-200 text-slate-600 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5'}
                      `}
                    />
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border space-y-3
                  ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}
                `}>
                  <label className="text-[8px] font-black text-slate-400 tracking-widest ml-2 flex items-center gap-2">
                    <NotificationsIcon sx={{ fontSize: 12 }} /> {t('form.reminders')}
                  </label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[7.5px] font-black text-slate-400 tracking-wider ml-1">{t('form.repetitions')}</span>
                      <select
                        value={subTaskForm.reminderCount}
                        onChange={(e) => setSubTaskForm({ ...subTaskForm, reminderCount: e.target.value })}
                        className={`w-full rounded-xl px-3 py-2.5 font-black outline-none text-xs shadow-sm border transition-all cursor-pointer
                          ${theme === 'dark' || (theme === 'system' && isSystemDark)
                            ? 'bg-slate-800 border-slate-700/50 text-white focus:border-indigo-500/50'
                            : 'bg-white border-slate-200 text-slate-600 focus:border-indigo-500/50'}
                        `}
                      >
                        <option value="">{t('form.noRepetition')}</option>
                        {timesOptions.map(n => <option key={n} value={n}>{n === 1 ? t('form.once') : t('form.times', { n })}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[7.5px] font-black text-slate-400 tracking-wider ml-1">{t('form.interval')}</span>
                      <select
                        value={subTaskForm.reminderInterval}
                        onChange={(e) => setSubTaskForm({ ...subTaskForm, reminderInterval: e.target.value })}
                        className={`w-full rounded-xl px-3 py-2.5 font-black outline-none text-xs shadow-sm border transition-all cursor-pointer
                          ${theme === 'dark' || (theme === 'system' && isSystemDark)
                            ? 'bg-slate-800 border-slate-700/50 text-white focus:border-indigo-500/50'
                            : 'bg-white border-slate-200 text-slate-600 focus:border-indigo-500/50'}
                        `}
                      >
                        <option value="">{t('form.noReminders')}</option>
                        <option value="1">{t('form.minute')} ({t('form.testing')})</option>
                        {intervalOptions.map(m => <option key={m} value={m}>{intervalLabel(m)}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className={`p-3 rounded-2xl border space-y-1
                  ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}
                `}>
                  <label className="text-[8px] font-black text-slate-400 tracking-widest ml-2 flex items-center gap-2">
                    <SubtitlesIcon sx={{ fontSize: 12 }} /> {t('sub.specs')}
                  </label>
                  <MultilingualInput
                    as="textarea"
                    dropUp
                    rows="2"
                    value={subTaskForm.description}
                    onValueChange={(v) => setSubTaskForm(f => ({ ...f, description: v }))}
                    className={`w-full rounded-xl px-4 py-3 font-bold outline-none resize-none shadow-sm border text-xs transition-all
                      ${theme === 'dark' || (theme === 'system' && isSystemDark)
                        ? 'bg-slate-800 border-slate-700/50 text-slate-300 placeholder:text-slate-500 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10'
                        : 'bg-white border-slate-200 text-slate-500 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5'}
                    `}
                    placeholder={t('sub.specsPlaceholder')}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={resetForms}
                    className={`flex-1 font-black py-4 rounded-[1.5rem] border shadow-sm transition-all active:scale-[0.98]
                      ${theme === 'dark' || (theme === 'system' && isSystemDark)
                        ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}
                    `}
                  >
                    {t('btn.cancel')}
                  </button>
                  <button
                    type="submit"
                    className={`flex-[2] font-black py-4 rounded-[1.5rem] shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-base
                      ${theme === 'dark' || (theme === 'system' && isSystemDark)
                        ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-900/20'
                        : 'bg-slate-900 text-white hover:bg-indigo-600 shadow-indigo-100'}
                    `}
                  >
                    <AddCircleIcon sx={{ fontSize: 20 }} /> {t('btn.addSubtask')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MISSION BOARDS */}
        <div className="grid grid-cols-1 gap-6 pointer-events-auto">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent"></div>
            </div>
          ) : (
            mainTasks.map((task) => {
              const styles = priorityStyles[task.priority] || priorityStyles.Medium;

              return (
                <div 
                  key={task.id} 
                  className={`transition-all duration-300 select-none ${draggedTaskId === task.id ? 'opacity-40 scale-95' : ''} ${dropTargetId === task.id ? 'border-t-4 border-indigo-500 pt-2' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id, true)}
                  onDragOver={(e) => handleDragOver(e, task.id)}
                  onDrop={(e) => handleDrop(e, task.id, true)}
                  onDragEnd={handleDragEnd}
                  onDragLeave={() => setDropTargetId(null)}
                >
                  <article
                    className={`p-4 md:p-6 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-500 border-2 ${styles.border} 
                      ${theme === 'dark' || (theme === 'system' && isSystemDark)
                        ? 'bg-slate-900 border-slate-800'
                        : `border-slate-100 ${styles.card}`
                      }`}
                  >
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={selectedTaskIds.includes(task.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTaskIds([...selectedTaskIds, task.id]);
                          } else {
                            setSelectedTaskIds(selectedTaskIds.filter(id => id !== task.id));
                          }
                        }}
                        className="w-5 h-5 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer pointer-events-auto shrink-0"
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1 space-y-4">
                            <div className="flex items-center gap-4">
                              <button
                                onClick={() => {
                                  const next = task.priority === "High" ? "Low" : task.priority === "Medium" ? "High" : "Medium";
                                  updatePriority(task, next);
                                }}
                                className={`px-3 py-1 rounded-xl text-[9px] font-black tracking-[0.2em] border flex items-center gap-2 transition-all hover:brightness-95 ${styles.badge}`}
                              >
                                <FiberManualRecordIcon sx={{ fontSize: 8 }} />
                                {task.priority}
                              </button>
                              <span className="flex items-center gap-2 text-slate-400 text-[10px] font-black tracking-[0.2em]">
                                <AccessTimeIcon sx={{ fontSize: 14 }} />
                                {task.dueTime ? parseBackendDate(task.dueTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "TBD"}
                              </span>
                              {task.dueTime && task.status !== "DONE" && (parseBackendDate(task.dueTime) - new Date()) < 3600000 && (parseBackendDate(task.dueTime) - new Date()) > 0 && (
                                <span className="animate-pulse px-2 py-0.5 bg-rose-500 text-white text-[8px] font-black rounded-full shadow-lg shadow-rose-200">
                                  DUE SOON
                                </span>
                              )}
                            </div>

                            <div
                              onClick={() => toggleStatus(task)}
                              className="pl-2 flex flex-col cursor-pointer group/title"
                            >
                              <h2 className={`text-2xl font-black transition-all 
                                ${(task.status === "DONE" || (task.dueTime && parseBackendDate(task.dueTime) < new Date()))
                                  ? "line-through decoration-red-500 decoration-[3px] text-slate-500"
                                  : theme === 'dark' || (theme === 'system' && isSystemDark) ? 'text-white hover:text-indigo-400' : 'text-slate-800 hover:text-indigo-600'
                                }`}>
                                {task.title}
                              </h2>
                              {task.description && (
                                <p className={`font-bold text-sm leading-relaxed mt-2 max-w-2xl transition-all 
                                  ${(task.status === "DONE" || (task.dueTime && parseBackendDate(task.dueTime) < new Date()))
                                    ? "line-through decoration-red-400 decoration-[1.5px] text-slate-500"
                                    : theme === 'dark' || (theme === 'system' && isSystemDark) ? 'text-slate-400' : 'text-slate-500'
                                  }`}>
                                  {task.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-row gap-2">
                            <button
                              onClick={() => setActiveParentId(task.id)}
                              className={`w-10 h-10 flex items-center justify-center rounded-xl shadow-sm border transition-all active:scale-90
                                ${theme === 'dark' || (theme === 'system' && isSystemDark)
                                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500 hover:text-white hover:border-indigo-400'
                                  : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-600 hover:text-white hover:border-indigo-500'}
                              `}
                              title="New Milestone"
                            >
                              <AddCircleIcon sx={{ fontSize: 20 }} />
                            </button>
                            <button
                              onClick={() => startEdit(task)}
                              className={`w-10 h-10 flex items-center justify-center rounded-xl shadow-sm border transition-all active:scale-90
                                ${theme === 'dark' || (theme === 'system' && isSystemDark)
                                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500 hover:text-white hover:border-blue-400'
                                  : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-600 hover:text-white hover:border-blue-500'}
                              `}
                              title="Edit Task"
                            >
                              <EditIcon sx={{ fontSize: 18 }} />
                            </button>
                            <button
                              onClick={() => deleteTask(task.id)}
                              className={`w-10 h-10 flex items-center justify-center rounded-xl shadow-sm border transition-all active:scale-90
                                ${theme === 'dark' || (theme === 'system' && isSystemDark)
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500 hover:text-white hover:border-rose-400'
                                  : 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-600 hover:text-white hover:border-rose-500'}
                              `}
                              title="Delete Task"
                            >
                              <DeleteIcon sx={{ fontSize: 18 }} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* MILESTONE LIST */}
                    {getSubTasks(task.id).length > 0 && (
                      <div className="mt-6 pt-4 border-t-2 border-white/50 space-y-3">
                        <div className="flex items-center gap-2 ml-2">
                          <div className="w-6 h-[2px] bg-slate-200"></div>
                          <h4 className="text-[9px] font-black text-slate-400 tracking-[0.3em] flex items-center gap-2">
                            <SubdirectoryIcon sx={{ fontSize: 14 }} /> Active Objectives
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-2">
                          {getSubTasks(task.id).map((sub) => {
                            const subS = priorityStyles[sub.priority] || priorityStyles.Low;

                            return (
                              <div
                                key={sub.id}
                                className={`flex flex-col p-4 rounded-2xl hover:shadow-lg transition-all duration-300 border shadow-sm border-white/50 group/sub select-none ${subS.card} ${draggedTaskId === sub.id ? 'opacity-40 scale-95' : ''} ${dropTargetId === sub.id ? 'border-t-4 border-indigo-500 pt-2' : ''}`}
                                draggable
                                onDragStart={(e) => handleDragStart(e, sub.id, false)}
                                onDragOver={(e) => handleDragOver(e, sub.id)}
                                onDrop={(e) => handleDrop(e, sub.id, false)}
                                onDragEnd={handleDragEnd}
                                onDragLeave={() => setDropTargetId(null)}
                              >
                                <div className="flex items-center gap-2.5 justify-between">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={selectedTaskIds.includes(sub.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedTaskIds([...selectedTaskIds, sub.id]);
                                        } else {
                                          setSelectedTaskIds(selectedTaskIds.filter(id => id !== sub.id));
                                        }
                                      }}
                                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer pointer-events-auto shrink-0"
                                    />
                                    <div className="flex items-center gap-3">
                                      <button
                                        onClick={() => {
                                          const next = sub.priority === "High" ? "Low" : sub.priority === "Medium" ? "High" : "Medium";
                                          updatePriority(sub, next);
                                        }}
                                        className={`w-3.5 h-3.5 rounded-full ${subS.dot} hover:scale-125 transition-transform cursor-pointer shadow-sm`}
                                      ></button>
                                      <div
                                        onClick={() => toggleStatus(sub)}
                                        className="flex flex-col cursor-pointer group/subtitle"
                                      >
                                        <span className={`font-black text-[13px] tracking-tight leading-none transition-all 
                                          ${(sub.status === "DONE" || (sub.dueTime && parseBackendDate(sub.dueTime) < new Date()))
                                            ? "line-through decoration-red-500 decoration-[2px] text-slate-500"
                                            : theme === 'dark' || (theme === 'system' && isSystemDark) ? 'text-slate-200 hover:text-indigo-400' : 'text-slate-700 hover:text-indigo-600'
                                          }`}>
                                          {sub.title}
                                        </span>
                                        {sub.description && (
                                          <span className={`text-[10px] font-bold mt-1 line-clamp-1 transition-all ${(sub.status === "DONE" || (sub.dueTime && parseBackendDate(sub.dueTime) < new Date())) ? "line-through decoration-red-400 decoration-[1px] text-slate-300" : "text-slate-400"}`}>
                                            {sub.description}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => startEdit(sub)}
                                      className={`w-8 h-8 flex items-center justify-center rounded-lg shadow-sm border transition-all active:scale-90
                                        ${theme === 'dark' || (theme === 'system' && isSystemDark)
                                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500 hover:text-white hover:border-blue-400'
                                          : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-600 hover:text-white hover:border-blue-500'}
                                      `}
                                      title="Edit Milestone"
                                    >
                                      <EditIcon sx={{ fontSize: 16 }} />
                                    </button>
                                    <button
                                      onClick={() => deleteTask(sub.id)}
                                      className={`w-8 h-8 flex items-center justify-center rounded-lg shadow-sm border transition-all active:scale-90
                                        ${theme === 'dark' || (theme === 'system' && isSystemDark)
                                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500 hover:text-white hover:border-rose-400'
                                          : 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-600 hover:text-white hover:border-rose-500'}
                                      `}
                                      title="Delete Milestone"
                                    >
                                      <DeleteIcon sx={{ fontSize: 16 }} />
                                    </button>
                                  </div>
                                </div>
                                <div className="mt-3 flex items-center justify-between ml-6">
                                  <div className="flex items-center gap-2 text-slate-400 text-[9px] font-black tracking-[0.2em]">
                                    <AccessTimeIcon sx={{ fontSize: 10 }} />
                                    {sub.dueTime ? parseBackendDate(sub.dueTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "No Deadline"}
                                  </div>
                                  {sub.dueTime && sub.status !== "DONE" && (parseBackendDate(sub.dueTime) - new Date()) < 3600000 && (parseBackendDate(sub.dueTime) - new Date()) > 0 && (
                                    <span className="animate-pulse px-1.5 py-0.5 bg-rose-500 text-white text-[7px] font-black rounded-full">
                                      SOON
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </article>
                </div>
              );
            })
          )}
        </div>


      </div>
      )}

      {showEditProfile && (
        <ProfileEditModal
          user={user}
          token={token}
          theme={theme}
          isSystemDark={isSystemDark}
          onClose={() => setShowEditProfile(false)}
          onComplete={() => {
            setShowEditProfile(false);
            onProfileUpdate();
            toast.success("Identity updated successfully");
          }}
        />
      )}
    </main>
  );
}