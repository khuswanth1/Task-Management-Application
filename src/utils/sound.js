// Notification sound settings + player. Settings are per device (localStorage),
// since speakers/volume preferences differ between a phone and a desktop.

const SETTINGS_KEY = "todo_sound_settings";

export const SOUND_EVENTS = [
  { id: "reminder", label: "Task reminders & due alerts" },
  { id: "push", label: "Push notifications (priority swaps, calendar, updates)" },
  { id: "taskDone", label: "Task completed" },
  { id: "taskCreated", label: "Task created" },
];

export const TONES = [
  { id: "chime", label: "Chime" },
  { id: "bell", label: "Bell" },
  { id: "ding", label: "Ding" },
  { id: "pop", label: "Pop" },
  { id: "marimba", label: "Marimba" },
  { id: "alarm", label: "Alarm" },
  { id: "success", label: "Success" },
  { id: "custom", label: "Custom file" },
];

export const DEFAULT_SOUND_SETTINGS = {
  enabled: true,
  volume: 0.6,            // 0..1
  tone: "chime",          // default tone for every event
  customSound: null,      // data: URL of an uploaded audio file
  customSoundName: null,
  events: {
    reminder: { enabled: true, tone: "default" },
    push: { enabled: true, tone: "default" },
    taskDone: { enabled: true, tone: "success" },
    taskCreated: { enabled: false, tone: "default" },
  },
  quietHours: { enabled: false, start: "22:00", end: "07:00" },
};

export function loadSoundSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    if (!saved) return structuredClone(DEFAULT_SOUND_SETTINGS);
    return {
      ...DEFAULT_SOUND_SETTINGS,
      ...saved,
      events: { ...DEFAULT_SOUND_SETTINGS.events, ...(saved.events || {}) },
      quietHours: { ...DEFAULT_SOUND_SETTINGS.quietHours, ...(saved.quietHours || {}) },
    };
  } catch {
    return structuredClone(DEFAULT_SOUND_SETTINGS);
  }
}

export function saveSoundSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event("sound-settings-changed")); // e.g. header mute button
    return true;
  } catch {
    return false; // e.g. custom file too large for storage
  }
}

function inQuietHours({ enabled, start, end }) {
  if (!enabled || !start || !end) return false;
  const toMin = (hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const s = toMin(start);
  const e = toMin(end);
  return s <= e ? cur >= s && cur < e : cur >= s || cur < e; // window may cross midnight
}

let audioCtx = null;
function ctx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}

// Synthesized tones (no network, works offline): [frequency Hz, start s, duration s, wave]
const TONE_NOTES = {
  chime: [[880, 0, 0.3, "sine"], [1320, 0.12, 0.4, "sine"]],
  bell: [[1046.5, 0, 1.2, "sine"], [2093, 0, 0.6, "sine"], [1568, 0.02, 0.9, "triangle"]],
  ding: [[1318.5, 0, 0.5, "sine"]],
  pop: [[600, 0, 0.08, "square"], [900, 0.05, 0.08, "sine"]],
  marimba: [[523.25, 0, 0.25, "triangle"], [659.25, 0.12, 0.25, "triangle"], [783.99, 0.24, 0.35, "triangle"]],
  alarm: [[880, 0, 0.15, "square"], [660, 0.18, 0.15, "square"], [880, 0.36, 0.15, "square"], [660, 0.54, 0.15, "square"]],
  success: [[523.25, 0, 0.15, "sine"], [659.25, 0.1, 0.15, "sine"], [783.99, 0.2, 0.15, "sine"], [1046.5, 0.3, 0.4, "sine"]],
};

function playSynth(toneId, volume) {
  const notes = TONE_NOTES[toneId] || TONE_NOTES.chime;
  const ac = ctx();
  const t0 = ac.currentTime;
  const peak = Math.max(0.001, 0.35 * volume);
  for (const [freq, start, dur, wave] of notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t0 + start);
    gain.gain.setValueAtTime(peak, t0 + start);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t0 + start);
    osc.stop(t0 + start + dur);
  }
}

/** Plays a specific tone regardless of event toggles (used by the "Test" buttons). */
export function previewTone(toneId, settings = loadSoundSettings()) {
  try {
    if (toneId === "custom") {
      if (!settings.customSound) return;
      const audio = new Audio(settings.customSound);
      audio.volume = settings.volume;
      audio.play().catch(() => {});
      return;
    }
    playSynth(toneId, settings.volume);
  } catch (e) {
    console.warn("Could not play sound:", e);
  }
}

/** Plays the sound configured for an app event, honouring mute, per-event toggles and quiet hours. */
export function playNotificationSound(eventId = "push") {
  const s = loadSoundSettings();
  if (!s.enabled || inQuietHours(s.quietHours)) return;
  const ev = s.events[eventId] || { enabled: true, tone: "default" };
  if (!ev.enabled) return;
  const tone = !ev.tone || ev.tone === "default" ? s.tone : ev.tone;
  previewTone(tone === "custom" && !s.customSound ? "chime" : tone, s);
}

/**
 * Auto-play: the service worker posts {type: "push-received"} to open tabs whenever a
 * Web Push notification arrives, so the configured sound plays while the app is open.
 */
export function listenForPushSounds() {
  if (!("serviceWorker" in navigator)) return () => {};
  const handler = (event) => {
    if (event.data?.type === "push-received") playNotificationSound(event.data.event || "push");
  };
  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}
