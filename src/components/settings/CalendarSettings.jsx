import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import EventIcon from '@mui/icons-material/Event';
import SyncIcon from '@mui/icons-material/Sync';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import WebhookIcon from '@mui/icons-material/Webhook';

const API = '/api/calendar/google';

export default function CalendarSettings({ token, theme, isSystemDark }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const isDark = theme === 'dark' || (theme === 'system' && isSystemDark);
  const authHeaders = { Authorization: 'Bearer ' + token };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/status`, { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) setStatus(await res.json());
    } catch (err) {
      console.error('Failed to load Google Calendar status', err);
    }
  }, [token]);

  useEffect(() => {
    fetchStatus();

    // Result of the OAuth round-trip (?calendar=connected|denied|error)
    const params = new URLSearchParams(window.location.search);
    const result = params.get('calendar');
    if (result) {
      const reason = params.get('reason');
      if (result === 'connected') toast.success('Google Calendar connected! Syncing your tasks…');
      else if (result === 'denied') toast.error(`Google Calendar access was not granted${reason ? ` (${reason})` : ''}.`);
      else toast.error(`Could not connect Google Calendar${reason ? `: ${reason}` : '. Please try again.'}`, { duration: 10000 });
      params.delete('calendar');
      params.delete('reason');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
      // Initial sync runs in the background; refresh status shortly after
      setTimeout(fetchStatus, 4000);
    }
  }, [fetchStatus]);

  const handleConnect = async () => {
    setBusy(true);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch(`${API}/auth-url?timeZone=${encodeURIComponent(timeZone)}`, { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start Google sign-in');
      window.location.href = data.url;
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  const handleSync = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/sync`, { method: 'POST', headers: authHeaders });
      if (!res.ok) throw new Error();
      toast.success('Syncing tasks to Google Calendar…');
    } catch {
      toast.error('Sync failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Google Calendar? Existing events stay in your calendar but will no longer update.')) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/connection`, { method: 'DELETE', headers: authHeaders });
      if (!res.ok) throw new Error();
      toast.success('Google Calendar disconnected.');
      await fetchStatus();
    } catch {
      toast.error('Failed to disconnect.');
    } finally {
      setBusy(false);
    }
  };

  const card = `p-6 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`;
  const heading = `text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`;
  const secondaryBtn = `flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black border transition-all disabled:opacity-50 ${isDark ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'}`;
  const fmt = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h3 className={`text-xl font-black mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Google Calendar</h3>
        <p className="text-slate-500 text-sm font-medium mb-6">
          Every task with a due time is added to your Google Calendar. Moving or renaming the event in Google Calendar updates the task here.
        </p>

        {!status ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : !status.configured ? (
          <div className={card}>
            <p className="text-sm font-bold text-amber-600">Google Calendar isn't configured on the server yet (missing Google OAuth client settings).</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`${card} flex flex-col md:flex-row gap-6 items-start md:items-center justify-between`}>
              <div className="flex items-start gap-4 flex-1">
                <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center ${isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
                  <EventIcon />
                </div>
                <div>
                  <h4 className={heading}>{status.connected ? 'Connected' : 'Not connected'}</h4>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    {status.connected
                      ? <>Syncing to <b>{status.googleEmail || 'your Google account'}</b> ({status.calendarId}) · last sync {fmt(status.lastSyncedAt)}</>
                      : 'Connect your Google account to mirror tasks as calendar events.'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {status.connected ? (
                  <>
                    <button onClick={handleSync} disabled={busy} className={secondaryBtn}>
                      <SyncIcon sx={{ fontSize: 16 }} /> Sync now
                    </button>
                    <button onClick={handleDisconnect} disabled={busy}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black border transition-all disabled:opacity-50 ${isDark ? 'bg-slate-900 text-red-400 border-slate-700 hover:bg-red-500/10' : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'}`}>
                      <LinkOffIcon sx={{ fontSize: 16 }} /> Disconnect
                    </button>
                  </>
                ) : (
                  <button onClick={handleConnect} disabled={busy}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-indigo-600 text-white hover:bg-indigo-700 transition-all disabled:opacity-50">
                    <EventIcon sx={{ fontSize: 16 }} /> Connect Google Calendar
                  </button>
                )}
              </div>
            </div>

            {status.connected && (
              <div className={`${card} flex items-start gap-4`}>
                <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center ${status.webhookActive ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600') : (isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500')}`}>
                  <WebhookIcon />
                </div>
                <div>
                  <h4 className={heading}>Calendar → Task updates (webhook)</h4>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    {status.webhookActive
                      ? `Active — Google notifies the app of changes. Auto-renews before ${fmt(status.webhookExpiresAt)}.`
                      : status.webhookConfigured
                        ? 'Starting… Google push notifications will be active shortly.'
                        : 'Disabled — the server has no public webhook URL configured, so only Task → Calendar sync runs.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
