import { motion } from 'motion/react';
import { useGameStore } from '../stores/useGameStore';
import { apiService } from '../services/apiService';
import {
  ChevronLeft,
  Volume2,
  VolumeX,
  Monitor,
  Smartphone,
  ShieldCheck,
  User,
  LogOut,
  Bell,
  HardDrive,
} from 'lucide-react';

const SettingToggle = ({ label, sublabel, icon: Icon, active, onToggle }: any) => (
  <div className="flex items-center justify-between p-4 glass-card border-white/10">
    <div className="flex items-center space-x-4">
      <div className={`p-3 rounded-xl border ${active ? 'border-cyan-300/30 bg-cyan-300/15 text-cyan-300' : 'border-white/10 bg-white/5 text-white/35'}`}>
        <Icon size={20} />
      </div>
      <div>
        <h4 className="font-black text-sm tracking-wide text-white uppercase italic">{label}</h4>
        <p className="text-[10px] text-white/45 uppercase tracking-widest">{sublabel}</p>
      </div>
    </div>
    <button
      onClick={onToggle}
      aria-label={`Toggle ${label}`}
      className={`w-12 h-6 rounded-full relative transition-colors ${active ? 'bg-cyan-400' : 'bg-white/15'}`}
    >
      <motion.div
        animate={{ x: active ? 26 : 2 }}
        className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-md"
      />
    </button>
  </div>
);

const SettingSection = ({ title, children }: any) => (
  <div className="space-y-3">
    <h3 className="section-label px-2">{title}</h3>
    {children}
  </div>
);

export const SettingsScreen = () => {
  const setState = useGameStore((state) => state.setState);
  const user = useGameStore((state) => state.user);
  const setUser = useGameStore((state) => state.setUser);

  const isAudioEnabled = useGameStore((state) => state.isAudioEnabled);
  const toggleAudio = useGameStore((state) => state.toggleAudio);

  const isHapticEnabled = useGameStore((state) => state.isHapticEnabled);
  const toggleHaptic = useGameStore((state) => state.toggleHaptic);

  const graphicsQuality = useGameStore((state) => state.graphicsQuality);
  const setGraphicsQuality = useGameStore((state) => state.setGraphicsQuality);

  const isMotionBlurEnabled = useGameStore((state) => state.isMotionBlurEnabled);
  const toggleMotionBlur = useGameStore((state) => state.toggleMotionBlur);

  const isAnonymousDataEnabled = useGameStore((state) => state.isAnonymousDataEnabled);
  const toggleAnonymousData = useGameStore((state) => state.toggleAnonymousData);

  const isPushAlertsEnabled = useGameStore((state) => state.isPushAlertsEnabled);
  const togglePushAlerts = useGameStore((state) => state.togglePushAlerts);

  const handleLogout = () => {
    apiService.logout();
    setUser(null);
    setState('AUTH');
  };

  const handleCacheClean = () => {
    const btn = document.getElementById('cache-clean-btn');
    if (btn) {
      const originalText = btn.innerText;
      btn.innerText = 'CLEARING...';
      setTimeout(() => {
        btn.innerText = 'CLEARED';
        setTimeout(() => {
          btn.innerText = originalText;
        }, 2000);
      }, 1500);
    }
  };

  return (
    <div className="screen-shell flex flex-col">
      <div className="screen-header">
        <button onClick={() => setState('DASHBOARD')} className="btn-icon" aria-label="Back to lobby">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1">
          <p className="eyebrow mb-2">Lobby Tools</p>
          <h1 className="screen-title">Settings</h1>
          <p className="helper-text mt-2">Tune controls, visuals, notifications, and account options.</p>
        </div>
      </div>

      <div className="space-y-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative p-6 glass-card overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-400/5 blur-3xl rounded-full translate-x-10 -translate-y-10 group-hover:scale-150 transition-transform duration-700" />
          <div className="flex items-center space-x-6">
            <div className="relative">
              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || 'guest'}`}
                alt="Avatar"
                className="w-20 h-20 rounded-2xl bg-slate-50 border-2 border-sky-400 p-1"
              />
              <div className="absolute -bottom-2 -right-2 bg-sky-500 p-1.5 rounded-lg border-2 border-black">
                <User size={14} className="text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-black italic tracking-tight text-white uppercase">{user?.name || 'Guest Player'}</h2>
              <p className="text-xs text-cyan-300 font-black italic">Level {user?.level || 1} / XP {user?.xp || 0}</p>
              <button className="mt-3 btn-secondary min-h-0 px-3 py-2 text-[10px]">
                Edit Profile <ChevronLeft size={12} className="rotate-180" />
              </button>
            </div>
          </div>
        </motion.div>

        <SettingSection title="Audio & Haptics">
          <SettingToggle
            label="Sound"
            sublabel="Game effects and crowd audio"
            icon={isAudioEnabled ? Volume2 : VolumeX}
            active={isAudioEnabled}
            onToggle={toggleAudio}
          />
          <SettingToggle
            label="Haptic Feedback"
            sublabel="Touch vibrations for actions"
            icon={Smartphone}
            active={isHapticEnabled}
            onToggle={toggleHaptic}
          />
        </SettingSection>

        <SettingSection title="Graphics">
          <div className="grid grid-cols-2 gap-3">
            {['LOW', 'MEDIUM', 'STRETCHED', 'ULTRA'].map((mode: any) => (
              <button
                key={mode}
                onClick={() => setGraphicsQuality(mode)}
                className={`py-3 rounded-xl border text-[10px] font-black tracking-widest uppercase transition-all ${graphicsQuality === mode ? 'border-cyan-400 bg-cyan-400/10 text-cyan-400 shadow-[0_0_10px_rgba(0,242,255,0.2)]' : 'border-white/10 bg-white/5 text-white/50 hover:text-white hover:border-white/20'}`}
              >
                {mode}
              </button>
            ))}
          </div>
          <SettingToggle
            label="Motion Blur"
            sublabel="Cinematic movement effects"
            icon={Monitor}
            active={isMotionBlurEnabled}
            onToggle={toggleMotionBlur}
          />
        </SettingSection>

        <SettingSection title="Privacy & System">
          <SettingToggle
            label="Anonymous Data"
            sublabel="Share usage data to improve play"
            icon={ShieldCheck}
            active={isAnonymousDataEnabled}
            onToggle={toggleAnonymousData}
          />
          <SettingToggle
            label="Push Alerts"
            sublabel="Tournament notifications"
            icon={Bell}
            active={isPushAlertsEnabled}
            onToggle={togglePushAlerts}
          />
          <div className="flex items-center justify-between p-4 glass-card border-white/10">
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-xl bg-white/5 text-white/45 border border-white/10">
                <HardDrive size={20} />
              </div>
              <div>
                <h4 className="font-black text-sm tracking-wide uppercase italic text-white">Clear Cache</h4>
                <p className="text-[10px] text-white/45 tracking-widest uppercase">Remove local temporary data</p>
              </div>
            </div>
            <button id="cache-clean-btn" onClick={handleCacheClean} className="btn-secondary min-h-0 px-4 py-2 text-[11px]">
              Clear
            </button>
          </div>
        </SettingSection>

        <button onClick={handleLogout} className="btn-danger w-full mt-4">
          <LogOut size={20} />
          <span>Log Out</span>
        </button>
      </div>

      <div className="mt-12 text-center text-[10px] text-gray-600 font-mono tracking-widest uppercase pb-10">
        Build Version: 4.1.2-Stable
      </div>
    </div>
  );
};
