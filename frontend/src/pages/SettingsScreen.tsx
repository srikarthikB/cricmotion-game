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
  HardDrive
} from 'lucide-react';

const SettingToggle = ({ label, sublabel, icon: Icon, active, onToggle }: any) => (
  <div className="flex items-center justify-between p-4 glass-card">
    <div className="flex items-center space-x-4">
      <div className={`p-3 rounded-xl ${active ? 'bg-sky-100 text-sky-600' : 'bg-slate-50 text-slate-400'}`}>
        <Icon size={20} />
      </div>
      <div>
        <h4 className="font-bold text-sm tracking-wide text-slate-800">{label}</h4>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest">{sublabel}</p>
      </div>
    </div>
    <button 
      onClick={onToggle}
      className={`w-12 h-6 rounded-full relative transition-colors ${active ? 'bg-sky-500' : 'bg-slate-200'}`}
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
    <h3 className="text-[10px] font-mono tracking-[0.4em] text-cyan-400/50 uppercase px-2">{title}</h3>
    {children}
  </div>
);

export const SettingsScreen = () => {
  const setState = useGameStore((state) => state.setState);
  const user = useGameStore((state) => state.user);
  const setUser = useGameStore((state) => state.setUser);
  
  // Settings States
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
    // Simulate cache cleaning
    const btn = document.getElementById('cache-clean-btn');
    if (btn) {
      const originalText = btn.innerText;
      btn.innerText = 'CLEANING...';
      setTimeout(() => {
        btn.innerText = 'WIPED!';
        setTimeout(() => {
          btn.innerText = originalText;
        }, 2000);
      }, 1500);
    }
  };

  return (
    <div className="flex-1 flex flex-col px-6 py-10 overflow-y-auto pb-32">
      <div className="flex items-center mb-10">
        <button onClick={() => setState('DASHBOARD')} className="mr-6 p-2 glass-card hover:bg-cyan-500/20 text-cyan-400">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-3xl font-black italic tracking-tighter uppercase neon-text">SYSTEM CONFIG</h1>
      </div>

      <div className="space-y-8">
        {/* Profile Card */}
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
              <div className="absolute -bottom-2 -right-2 bg-sky-500 p-1.5 rounded-lg border-2 border-white">
                <User size={14} className="text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-black italic tracking-tight text-slate-800">{user?.name || 'GUEST_OPERATOR'}</h2>
              <p className="text-xs text-sky-600 font-black italic">LVL {user?.level || 1} • XP {user?.xp || 0}</p>
              <button className="mt-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 flex items-center tracking-widest uppercase">
                Edit Bio <ChevronLeft size={12} className="rotate-180 ml-1" />
              </button>
            </div>
          </div>
        </motion.div>

        <SettingSection title="AUDIO & HAPTICS">
          <SettingToggle 
            label="MASTER SOUND" 
            sublabel="Global volume control" 
            icon={isAudioEnabled ? Volume2 : VolumeX} 
            active={isAudioEnabled}
            onToggle={toggleAudio}
          />
          <SettingToggle 
            label="HAPTIC FEEDBACK" 
            sublabel="Advanced touch vibrations" 
            icon={Smartphone} 
            active={isHapticEnabled}
            onToggle={toggleHaptic}
          />
        </SettingSection>

        <SettingSection title="GRAPHICS">
           <div className="grid grid-cols-2 gap-3">
              {['LOW', 'MEDIUM', 'STRETCHED', 'ULTRA'].map((mode: any) => (
                <button 
                  key={mode}
                  onClick={() => setGraphicsQuality(mode)}
                  className={`py-3 rounded-xl border text-[10px] font-black tracking-widest uppercase transition-all ${graphicsQuality === mode ? 'border-cyan-400 bg-cyan-400/10 text-cyan-400 shadow-[0_0_10px_rgba(0,242,255,0.2)]' : 'border-white/5 bg-white/5 text-gray-500'}`}
                >
                  {mode}
                </button>
              ))}
           </div>
           <SettingToggle 
            label="MOTION BLUR" 
            sublabel="Cinematic transition fx" 
            icon={Monitor} 
            active={isMotionBlurEnabled}
            onToggle={toggleMotionBlur}
          />
        </SettingSection>

        <SettingSection title="PRIVACY & SYSTEM">
          <SettingToggle 
            label="ANONYMOUS DATA" 
            sublabel="Telemetery for AI training" 
            icon={ShieldCheck} 
            active={isAnonymousDataEnabled}
            onToggle={toggleAnonymousData}
          />
          <SettingToggle 
            label="PUSH ALERTS" 
            sublabel="Tournament notifications" 
            icon={Bell} 
            active={isPushAlertsEnabled}
            onToggle={togglePushAlerts}
          />
          <div className="flex items-center justify-between p-4 glass-card border-white/5">
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-xl bg-white/5 text-gray-500">
                <HardDrive size={20} />
              </div>
              <div>
                <h4 className="font-bold text-sm tracking-wide uppercase">Cache Clean</h4>
                <p className="text-[10px] text-gray-500 tracking-widest">WIPE LOCAL TEMP DATA</p>
              </div>
            </div>
            <button 
              id="cache-clean-btn"
              onClick={handleCacheClean}
              className="text-[11px] font-black text-cyan-400 hover:underline tracking-widest uppercase"
            >
              Execute
            </button>
          </div>
        </SettingSection>

        <button 
          onClick={handleLogout}
          className="w-full py-4 mt-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 font-black tracking-[0.3em] flex items-center justify-center space-x-2 hover:bg-red-500/20 transition-all"
        >
          <LogOut size={20} />
          <span>TERMINATE SESSION</span>
        </button>
      </div>

      <div className="mt-12 text-center text-[10px] text-gray-600 font-mono tracking-widest uppercase pb-10">
        Build Version: 4.1.2-Stable <br/>
        All rights reserved © Shadow Cricket Gaming Ltd.
      </div>
    </div>
  );
};
