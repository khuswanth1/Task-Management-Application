import React, { useState } from 'react';
import toast from 'react-hot-toast';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import {
  SOUND_EVENTS, TONES, DEFAULT_SOUND_SETTINGS,
  loadSoundSettings, saveSoundSettings, previewTone,
} from '../../utils/sound';

const MAX_CUSTOM_BYTES = 1024 * 1024; // keeps the data: URL within localStorage limits

const Toggle = ({ checked, onChange, label }) => (
  <label className="relative inline-flex items-center cursor-pointer" aria-label={label}>
    <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <div className="w-9 h-5 bg-slate-300 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
  </label>
);

export default function SoundSettings({ theme, isSystemDark }) {
  const isDark = theme === 'dark' || (theme === 'system' && isSystemDark);
  const [settings, setSettings] = useState(loadSoundSettings);

  // Every change is saved immediately (per device)
  const update = (patch) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      if (!saveSoundSettings(next)) toast.error('Could not save sound settings (storage full).');
      return next;
    });
  };
  const updateEvent = (id, patch) =>
    update({ events: { ...settings.events, [id]: { ...settings.events[id], ...patch } } });

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('audio/')) return toast.error('Please choose an audio file (mp3, wav, ogg…).');
    if (file.size > MAX_CUSTOM_BYTES) return toast.error('Audio file must be under 1 MB.');
    const reader = new FileReader();
    reader.onloadend = () => {
      update({ customSound: reader.result, customSoundName: file.name, tone: 'custom' });
      toast.success(`Custom sound "${file.name}" set`);
    };
    reader.readAsDataURL(file);
  };

  const card = `p-5 rounded-2xl border space-y-4 ${isDark ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-200'}`;
  const heading = `text-xs font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`;
  const selectCls = `px-3 py-2 rounded-xl border text-xs font-bold outline-none ${isDark ? 'bg-slate-800 text-slate-300 border-slate-600' : 'bg-white text-slate-700 border-slate-200'}`;
  const textCls = isDark ? 'text-slate-200' : 'text-slate-700';
  const toneOptions = TONES.filter(t => t.id !== 'custom' || settings.customSound);

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h3 className={`text-2xl font-black tracking-tight mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>Notification Sounds</h3>
        <p className="text-slate-500 text-sm font-medium">Choose what plays when reminders and notifications arrive. Saved on this device.</p>
      </div>

      {/* Master switch + volume */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings.enabled ? <VolumeUpIcon className="text-indigo-500" /> : <VolumeOffIcon className="text-slate-400" />}
            <div>
              <p className={`text-sm font-black ${textCls}`}>Play notification sounds</p>
              <p className="text-xs text-slate-500">Sounds play automatically when a notification arrives while the app is open.</p>
            </div>
          </div>
          <Toggle checked={settings.enabled} onChange={(v) => update({ enabled: v })} label="Enable sounds" />
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${!settings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Volume {Math.round(settings.volume * 100)}%</label>
            <input type="range" min="0" max="1" step="0.05" value={settings.volume}
              onChange={(e) => update({ volume: Number(e.target.value) })} className="w-full accent-indigo-600" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Default tone</label>
            <div className="flex gap-2">
              <select value={settings.tone} onChange={(e) => update({ tone: e.target.value })} className={`${selectCls} flex-1`}>
                {toneOptions.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <button type="button" onClick={() => previewTone(settings.tone, settings)}
                className="px-3 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center gap-1 active:scale-95">
                <PlayArrowIcon sx={{ fontSize: 16 }} /> Test
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Per-event sounds */}
      <div className={`${card} ${!settings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <h4 className={heading}>Sound for each notification</h4>
        <div className="space-y-3">
          {SOUND_EVENTS.map(ev => {
            const cfg = settings.events[ev.id] || { enabled: true, tone: 'default' };
            const tone = cfg.tone === 'default' ? settings.tone : cfg.tone;
            return (
              <div key={ev.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <Toggle checked={cfg.enabled} onChange={(v) => updateEvent(ev.id, { enabled: v })} label={ev.label} />
                  <span className={`text-sm font-bold ${textCls}`}>{ev.label}</span>
                </div>
                <div className={`flex gap-2 ${!cfg.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <select value={cfg.tone} onChange={(e) => updateEvent(ev.id, { tone: e.target.value })} className={selectCls}>
                    <option value="default">Default tone</option>
                    {toneOptions.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                  <button type="button" onClick={() => previewTone(tone, settings)} aria-label={`Test ${ev.label} sound`}
                    className={`px-2 rounded-xl border text-xs font-black ${isDark ? 'border-slate-600 text-slate-300' : 'border-slate-200 text-slate-600'}`}>
                    <PlayArrowIcon sx={{ fontSize: 16 }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom sound + quiet hours */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${!settings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className={card}>
          <h4 className={heading}>Custom sound</h4>
          <p className="text-xs text-slate-500">Upload your own short sound (mp3, wav, ogg — under 1 MB).</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer active:scale-95">
              <CloudUploadIcon sx={{ fontSize: 16 }} /> Upload
              <input type="file" accept="audio/*" className="hidden" onChange={handleUpload} />
            </label>
            {settings.customSound && (
              <>
                <span className={`text-xs font-bold truncate max-w-[10rem] ${textCls}`}>{settings.customSoundName}</span>
                <button type="button" onClick={() => previewTone('custom', settings)} className="text-xs font-black text-indigo-500">Play</button>
                <button type="button" className="text-xs font-black text-red-500"
                  onClick={() => update({
                    customSound: null, customSoundName: null,
                    tone: settings.tone === 'custom' ? 'chime' : settings.tone,
                  })}>
                  Remove
                </button>
              </>
            )}
          </div>
        </div>

        <div className={card}>
          <div className="flex items-center justify-between">
            <h4 className={heading}>Quiet hours</h4>
            <Toggle checked={settings.quietHours.enabled} label="Quiet hours"
              onChange={(v) => update({ quietHours: { ...settings.quietHours, enabled: v } })} />
          </div>
          <p className="text-xs text-slate-500">No sounds during these hours (notifications still appear).</p>
          <div className={`flex items-center gap-2 ${!settings.quietHours.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <input type="time" value={settings.quietHours.start} className={selectCls}
              onChange={(e) => update({ quietHours: { ...settings.quietHours, start: e.target.value } })} />
            <span className="text-xs text-slate-500">to</span>
            <input type="time" value={settings.quietHours.end} className={selectCls}
              onChange={(e) => update({ quietHours: { ...settings.quietHours, end: e.target.value } })} />
          </div>
        </div>
      </div>

      <button type="button" onClick={() => { update(structuredClone(DEFAULT_SOUND_SETTINGS)); toast.success('Sound settings reset'); }}
        className={`px-4 py-2 rounded-xl border text-xs font-black ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
        Reset to defaults
      </button>
    </div>
  );
}
