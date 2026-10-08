import React, { useState, useEffect } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import ColorLensIcon from '@mui/icons-material/ColorLens';
import BackupIcon from '@mui/icons-material/Backup';
import EventIcon from '@mui/icons-material/Event';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';

import ThemeSettings from '../components/settings/ThemeSettings';
import BackupSettings from '../components/settings/BackupSettings';
import CalendarSettings from '../components/settings/CalendarSettings';
import SoundSettings from '../components/settings/SoundSettings';
import LanguageSettings from '../components/settings/LanguageSettings';
import TranslateIcon from '@mui/icons-material/Translate';
import { useI18n } from '../i18n/I18nContext';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';

export default function Settings({ user, token, setToken, theme, setTheme, isSystemDark, onProfileUpdate, onClose, onReset }) {
  const [activeTab, setActiveTab] = useState('profile');
  const { t } = useI18n();

  // Inline Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileFormData, setProfileFormData] = useState({});

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify(profileFormData)
      });
      if (res.ok) {
        if (onProfileUpdate) onProfileUpdate();
        setIsEditingProfile(false);
      } else {
        alert("Failed to update profile.");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle URL-based routing (e.g., ?tab=theme)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && ['profile', 'theme', 'language', 'sounds', 'calendar', 'backup'].includes(tab)) {
      setActiveTab(tab);
    }
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('tab', tab);
    window.history.pushState({}, '', newUrl);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };

  const tabs = [
    { id: 'profile', label: t('tab.profile'), icon: <PersonIcon sx={{ fontSize: 18 }} /> },
    { id: 'theme', label: t('tab.theme'), icon: <ColorLensIcon sx={{ fontSize: 18 }} /> },
    { id: 'language', label: t('tab.language'), icon: <TranslateIcon sx={{ fontSize: 18 }} /> },
    { id: 'sounds', label: t('tab.sounds'), icon: <VolumeUpIcon sx={{ fontSize: 18 }} /> },
    { id: 'calendar', label: t('tab.calendar'), icon: <EventIcon sx={{ fontSize: 18 }} /> },
    { id: 'backup', label: t('tab.backup'), icon: <BackupIcon sx={{ fontSize: 18 }} /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-in fade-in zoom-in-95 duration-500">
      
      {/* Settings Header */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={onClose}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          <ArrowBackIcon />
        </button>
        <div>
          <h1 className={`text-3xl font-black tracking-tight ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'text-white' : 'text-slate-900'}`}>{t('settings.title')}</h1>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* LEFT SIDEBAR */}
        <div className={`w-full lg:w-80 flex-shrink-0 flex flex-col gap-6 p-6 rounded-[2rem] border shadow-sm ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100'}`}>
          
          {/* Profile Summary */}
          <div className="flex flex-col items-center justify-center p-4 border-b border-slate-100 dark:border-slate-800">
            <div className={`w-24 h-24 rounded-full border-4 shadow-xl flex items-center justify-center overflow-hidden mb-4
              ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-indigo-50 border-white text-indigo-300'}`}>
              {user?.profileImage && !user.profileImage.startsWith('blob:') ? (
                <img src={user.profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <AccountCircleIcon sx={{ fontSize: 70 }} />
              )}
            </div>
            <h2 className={`text-lg font-black truncate w-full text-center ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'text-white' : 'text-slate-800'}`}>
              {user?.name || "Member"}
            </h2>
            <p className="text-xs font-bold text-slate-500 tracking-wider mt-1">{user?.mobile || "No phone"}</p>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex flex-col gap-2 flex-grow">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-black transition-all ${activeTab === tab.id 
                  ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' 
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Logout Button */}
          <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleLogout}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl active:scale-[0.98] transition-all font-black text-sm border
                ${theme === 'dark' || (theme === 'system' && isSystemDark)
                  ? 'bg-slate-800 text-red-400 border-slate-700 hover:bg-red-500/10'
                  : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'
                }`}
            >
              <LogoutIcon sx={{ fontSize: 18 }} /> Log Out
            </button>
          </div>

        </div>

        {/* RIGHT CONTENT AREA */}
        <div className={`flex-grow p-8 rounded-[2.5rem] border shadow-sm min-h-[500px] ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100'}`}>
          
          {activeTab === 'profile' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-xl relative">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className={`text-xl font-black ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'text-white' : 'text-slate-800'}`}>Profile Overview</h3>
                  <p className="text-slate-500 text-sm font-medium mb-8">
                    {isEditingProfile ? "Update your personal details below." : "View your personal details."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!isEditingProfile ? (
                    <button 
                      onClick={() => {
                        setProfileFormData({
                          name: user?.name || "",
                          mobile: user?.mobile || "",
                          age: user?.age || "",
                          gender: user?.gender || "",
                          dob: user?.dob || ""
                        });
                        setIsEditingProfile(true);
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-lg transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <EditIcon sx={{ fontSize: 14 }} /> Edit
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => setIsEditingProfile(false)}
                        className={`px-4 py-2 border text-xs font-black rounded-lg transition-all flex items-center gap-1.5 ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                      >
                        <CloseIcon sx={{ fontSize: 14 }} /> Cancel
                      </button>
                      <button 
                        onClick={handleSaveProfile}
                        disabled={isSavingProfile}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black rounded-lg transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <SaveIcon sx={{ fontSize: 14 }} /> {isSavingProfile ? 'Saving...' : 'Save'}
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-1 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                  {isEditingProfile ? (
                    <input 
                      type="text" 
                      value={profileFormData.name} 
                      onChange={(e) => setProfileFormData({...profileFormData, name: e.target.value})}
                      className={`mt-1 w-full p-4 rounded-xl border font-bold text-sm outline-none transition-colors ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-800 focus:border-indigo-500'}`}
                    />
                  ) : (
                    <div className={`mt-1 p-4 rounded-xl border font-bold text-sm ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                      {user?.name || "Not set"}
                    </div>
                  )}
                </div>
                
                {/* Email is read-only usually, but we display it */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                  <div className={`mt-1 p-4 rounded-xl border font-bold text-sm ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                    {user?.email || "Not set"} (Read Only)
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mobile Number</label>
                  {isEditingProfile ? (
                    <input 
                      type="text" 
                      value={profileFormData.mobile} 
                      onChange={(e) => setProfileFormData({...profileFormData, mobile: e.target.value})}
                      className={`mt-1 w-full p-4 rounded-xl border font-bold text-sm outline-none transition-colors ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-800 focus:border-indigo-500'}`}
                    />
                  ) : (
                    <div className={`mt-1 p-4 rounded-xl border font-bold text-sm ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                      {user?.mobile || "Not set"}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Age</label>
                  {isEditingProfile ? (
                    <input 
                      type="number" 
                      value={profileFormData.age} 
                      onChange={(e) => setProfileFormData({...profileFormData, age: e.target.value})}
                      className={`mt-1 w-full p-4 rounded-xl border font-bold text-sm outline-none transition-colors ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-800 focus:border-indigo-500'}`}
                    />
                  ) : (
                    <div className={`mt-1 p-4 rounded-xl border font-bold text-sm ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                      {user?.age ? `${user.age} years old` : "Not set"}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gender</label>
                  {isEditingProfile ? (
                    <select 
                      value={profileFormData.gender} 
                      onChange={(e) => setProfileFormData({...profileFormData, gender: e.target.value})}
                      className={`mt-1 w-full p-4 rounded-xl border font-bold text-sm outline-none transition-colors cursor-pointer ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-800 focus:border-indigo-500'}`}
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  ) : (
                    <div className={`mt-1 p-4 rounded-xl border font-bold text-sm capitalize ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                      {user?.gender || "Not set"}
                    </div>
                  )}
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date of Birth</label>
                  {isEditingProfile ? (
                    <input 
                      type="date" 
                      value={profileFormData.dob} 
                      onChange={(e) => setProfileFormData({...profileFormData, dob: e.target.value})}
                      className={`mt-1 w-full p-4 rounded-xl border font-bold text-sm outline-none transition-colors ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500 [color-scheme:dark]' : 'bg-white border-slate-200 text-slate-800 focus:border-indigo-500'}`}
                    />
                  ) : (
                    <div className={`mt-1 p-4 rounded-xl border font-bold text-sm ${theme === 'dark' || (theme === 'system' && isSystemDark) ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                      {user?.dob ? new Date(user.dob).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : "Not set"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'theme' && (
            <ThemeSettings theme={theme} setTheme={setTheme} isSystemDark={isSystemDark} user={user} token={token} onProfileUpdate={onProfileUpdate} />
          )}

          {activeTab === 'calendar' && (
            <CalendarSettings token={token} theme={theme} isSystemDark={isSystemDark} />
          )}

          {activeTab === 'language' && (
            <LanguageSettings theme={theme} isSystemDark={isSystemDark} />
          )}

          {activeTab === 'sounds' && (
            <SoundSettings theme={theme} isSystemDark={isSystemDark} />
          )}

          {activeTab === 'backup' && (
            <BackupSettings user={user} token={token} theme={theme} isSystemDark={isSystemDark} onReset={onReset} />
          )}

        </div>
      </div>
    </div>
  );
}
