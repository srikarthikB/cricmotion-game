import { motion } from 'motion/react';
import { useGameStore } from '../stores/useGameStore';
import { 
  Play, 
  Trophy, 
  BarChart3, 
  Settings, 
  Bell,
  ArrowRight
} from 'lucide-react';

const ActionCard = ({ title, description, cta, icon: Icon, color, comingSoon, primary, onClick, className = '' }: any) => (
  <motion.div
    whileHover={{ scale: comingSoon ? 1 : 1.02, y: comingSoon ? 0 : -4 }}
    whileTap={{ scale: comingSoon ? 1 : 0.98 }}
    onClick={!comingSoon ? onClick : undefined}
    role="button"
    aria-disabled={comingSoon}
    className={`action-card flex h-[168px] flex-col justify-between group ${comingSoon ? 'opacity-50 cursor-not-allowed border-white/5 saturate-[0.5]' : 'tap-target'} ${primary ? 'border-cyan-300/30 bg-cyan-300/10' : ''} ${className}`}
  >
    {/* Decorative background icon */}
    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
      <Icon size={120} />
    </div>

    <div className="relative z-10 flex items-center justify-between">
        <div className={`p-2.5 rounded-xl bg-white/[0.07] border border-white/10 ${color} group-hover:scale-110 transition-transform`}>
          <Icon size={24} />
        </div>
        {!comingSoon && (
          <span className={`status-pill ${primary ? 'border-cyan-300/30 text-cyan-200' : ''}`}>
            {primary ? 'Start Here' : 'Open'}
          </span>
        )}
    </div>
    
    <div className="relative z-10">
        <h3 className="text-xl font-black tracking-tighter italic uppercase text-white group-hover:text-cyan-100 transition-colors">{title}</h3>
        <p className="mt-1 text-xs font-bold leading-snug text-white/55">{description}</p>
        {!comingSoon && (
          <div className="mt-3 inline-flex items-center gap-1 text-[10px] font-black uppercase italic tracking-widest text-cyan-300">
            {cta}
            <ArrowRight size={12} />
          </div>
        )}
        {comingSoon && (
          <p className="text-[9px] font-black tracking-[0.2em] uppercase text-cyan-400/50 mt-1 italic leading-none">Locked for now</p>
        )}
    </div>
  </motion.div>
);

export const Dashboard = () => {
  const setState = useGameStore((state) => state.setState);
  const user = useGameStore((state) => state.user);

  return (
    <div className="screen-shell relative">
      {/* Lobby Specific Dynamic Background Layer - Vibrant Color */}
      <div className="absolute inset-0 z-[-1] pointer-events-none opacity-40 overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1544256718-3bcf237f3974?auto=format&fit=crop&q=80&w=1600" 
          className="w-full h-full object-cover scale-125 blur-lg saturate-200"
          alt="Lobby Aura"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-15 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] mix-blend-overlay" />
        
        {/* Dynamic Light Streaks */}
        <motion.div 
            animate={{ 
                x: [0, 200, 0], 
                y: [0, -100, 0],
                opacity: [0.1, 0.3, 0.1]
            }} 
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-cyan-500/20 blur-[150px] rounded-full" 
        />
      </div>

      {/* Top Header */}
      <header className="flex justify-between items-center mb-8 sticky top-0 z-40 py-2 bg-transparent">
        <div className="flex items-center">
          <div className="relative mr-4">
            <div className="absolute -inset-1 bg-cyan-400/20 blur-xl rounded-full" />
            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 p-1 relative z-10 bg-black/40 backdrop-blur-md">
               <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || 'guest'}`} 
                alt="Avatar" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-cyan-400 rounded-full border-4 border-black z-20 flex items-center justify-center">
              <div className="w-2 h-2 bg-black rounded-full animate-pulse" />
            </div>
          </div>
          <div>
            <p className="eyebrow opacity-70 mb-1">Player Lobby</p>
            <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">{user?.name || 'System User'}</h2>
          </div>
        </div>
        <div className="flex space-x-2">
          <button className="btn-icon group" aria-label="Notifications">
             <Bell size={20} className="text-white/40 group-hover:text-white transition-colors" />
          </button>
          <button className="btn-icon group" aria-label="Open performance stats" onClick={() => setState('STATS')}>
             <BarChart3 size={20} className="text-cyan-400 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </header>

      {/* Main Hero Stage */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full h-[280px] rounded-[2rem] overflow-hidden relative mb-8 border border-cyan-300/25 shadow-[0_30px_60px_rgba(0,0,0,0.6)] group cursor-pointer"
        onClick={() => setState('MATCH_SETTINGS')}
      >
        <img 
          src="https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?auto=format&fit=crop&q=80&w=1200" 
          className="w-full h-full object-cover brightness-110 group-hover:scale-110 transition-all duration-1000"
          alt="Stadium Banner"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        <div className="absolute inset-0 bg-radial-[circle_at_50%_50%,transparent_0%,black_100%] opacity-40" />
        
        <div className="absolute bottom-0 left-0 p-8 w-full">
          <div className="flex items-center space-x-2 mb-4">
            <div className="flex space-x-1">
              {[1, 2, 3].map(i => <div key={i} className="w-1 h-3 bg-red-600 skew-x-12" />)}
            </div>
            <span className="text-[10px] font-black tracking-[0.3em] text-white/70 uppercase italic">Recommended First Step</span>
          </div>
          <h1 className="text-5xl font-black italic tracking-tighter mb-4 leading-[0.8] text-white uppercase drop-shadow-2xl">
            Start A<br/>Cricket Match
          </h1>
          <p className="max-w-sm pb-4 text-sm font-bold text-white/70">Choose match format, team, and stadium before camera calibration.</p>
          <div className="flex items-center space-x-4">
            <button className="btn-primary min-h-0 px-5 py-2.5 text-[10px]">
              <span>Set Up Match</span>
              <Play size={12} fill="currentColor" />
            </button>
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-black bg-slate-800 flex items-center justify-center overflow-hidden">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i * 123}`} alt="Player" />
                </div>
              ))}
              <div className="w-8 h-8 rounded-full border-2 border-black bg-cyan-400 flex items-center justify-center text-[10px] font-black text-black italic">
                +12
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Action Grid */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <ActionCard 
          title="Quick Play" 
          description="Set rules, pick a team, calibrate camera, then face the first ball."
          cta="Set Up Match"
          icon={Play} 
          color="text-cyan-400" 
          primary
          onClick={() => setState('MATCH_SETTINGS')}
          className="col-span-2 bg-gradient-to-r from-cyan-950/20 via-black/10 to-transparent border-cyan-500/20"
        />
        <ActionCard 
          title="World Tour" 
          description="View tournament brackets and season progress."
          cta="View Tour"
          icon={Trophy} 
          color="text-fuchsia-500" 
          onClick={() => setState('TOURNAMENT')}
        />
        <ActionCard 
          title="Settings" 
          description="Adjust sound, haptics, graphics, privacy, and account options."
          cta="Open Settings"
          icon={Settings} 
          color="text-cyan-400" 
          onClick={() => setState('SETTINGS')}
        />
      </div>

      {/* Mini Stats Console */}
      <div className="glass-card p-6 flex justify-between items-center mb-10 border-white/5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-400/5 blur-3xl opacity-50 group-hover:opacity-100 transition-opacity" />
        <div className="flex flex-col">
          <p className="section-label mb-1 opacity-60">Avg Score</p>
          <div className="flex items-baseline space-x-1">
            <span className="text-4xl font-black italic text-white leading-none">42.5</span>
            <span className="text-[10px] text-cyan-400 font-black italic">PR</span>
          </div>
        </div>
        <div className="w-[1px] h-10 bg-white/10" />
        <div className="flex flex-col">
          <p className="section-label mb-1 opacity-60">Rank</p>
          <span className="text-4xl font-black italic text-fuchsia-500 leading-none">#03</span>
        </div>
        <div className="w-[1px] h-10 bg-white/10" />
        <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-cyan-400/30 transition-colors">
                <Trophy size={24} className="text-cyan-400/50 group-hover:text-cyan-400 transition-colors" />
            </div>
        </div>
      </div>

      {/* News Ticker footer */}
      <div className="fixed bottom-0 left-0 w-full bg-black/40 backdrop-blur-2xl border-t border-white/10 py-4 overflow-hidden z-50 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
        <div className="flex whitespace-nowrap animate-marquee">
          <p className="text-[10px] font-black text-cyan-400/60 uppercase tracking-[0.3em] px-12 italic">
            [LIVE FEED] KOHLI HITS CENTURY IN SYDNEY • [UPCOMING] WORLD CUP QUALIFIERS START FRIDAY • [ARENA] HIGH HUMIDITY DETECTED AT EDEN GARDENS • [PLAYER] NEW RECORD SET FOR FASTEST DELIVERY 161.4 KM/H • [SYSTEM] V4.1 POSE ALGORITHM ACTIVE
          </p>
          <p className="text-[10px] font-black text-cyan-400/60 uppercase tracking-[0.3em] px-12 italic">
            [LIVE FEED] KOHLI HITS CENTURY IN SYDNEY • [UPCOMING] WORLD CUP QUALIFIERS START FRIDAY • [ARENA] HIGH HUMIDITY DETECTED AT EDEN GARDENS • [PLAYER] NEW RECORD SET FOR FASTEST DELIVERY 161.4 KM/H • [SYSTEM] V4.1 POSE ALGORITHM ACTIVE
          </p>
        </div>
      </div>
    </div>
  );
};
