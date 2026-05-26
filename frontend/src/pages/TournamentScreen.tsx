import { motion } from 'motion/react';
import { useGameStore } from '../stores/useGameStore';
import { ChevronLeft, Trophy, Crown, Lock, Star } from 'lucide-react';

const BracketCard = ({ name, status, icon: Icon, color }: any) => (
  <motion.div
    whileHover={{ scale: status === 'LOCKED' ? 1 : 1.02 }}
    className={`p-6 glass-card border-white/5 relative overflow-hidden flex items-center justify-between ${status === 'LOCKED' ? 'opacity-40 grayscale' : 'border-l-4 ' + color} transition-all`}
  >
    <div className="flex items-center space-x-6">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${status === 'LOCKED' ? 'bg-white/5' : 'bg-cyan-400/10'}`}>
            {status === 'LOCKED' ? <Lock size={20} className="text-gray-500" /> : <Icon size={24} className={color.replace('border-l-', 'text-')} />}
        </div>
        <div>
            <p className="text-[10px] text-gray-500 font-black tracking-[0.2em] uppercase mb-1 italic">{status}</p>
            <h3 className="text-xl font-black italic tracking-tighter text-white uppercase">{name}</h3>
        </div>
    </div>
    
    {status === 'ACTIVE' && (
        <div className="flex items-center space-x-1">
            {[1, 2, 3].map(i => <Star key={i} size={14} className="text-cyan-400 fill-cyan-400" />)}
        </div>
    )}
  </motion.div>
);

export const TournamentScreen = () => {
  const setState = useGameStore((state) => state.setState);

  return (
    <div className="flex-1 flex flex-col px-6 py-10 overflow-y-auto font-sans pb-32">
      <div className="flex items-center mb-10">
        <button onClick={() => setState('DASHBOARD')} className="mr-6 p-3 glass-card hover:bg-cyan-500/20 text-white border-white/10">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-4xl font-black italic tracking-tighter uppercase neon-text">WORLD TOUR</h1>
      </div>

      <div className="mb-10 relative h-56 rounded-3xl overflow-hidden glass-card flex items-center justify-center group border-white/10">
         <img 
            src="https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&q=80&w=800" 
            className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:scale-105 transition-transform duration-1000"
            alt="Tournament Arena"
         />
         <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
         <Trophy size={100} className="text-cyan-400 opacity-20 relative z-10" />
         <div className="absolute bottom-8 left-0 w-full text-center px-4 relative z-20">
             <h2 className="text-3xl font-black italic tracking-tighter text-white mb-2 leading-none uppercase">GRAND FINALS</h2>
             <p className="text-[10px] text-cyan-400 font-black tracking-[0.4em] uppercase italic opacity-60">SEASON 01: THE AWAKENING</p>
         </div>
      </div>

      <div className="space-y-4">
          <h3 className="text-[10px] font-black tracking-[0.3em] text-cyan-400/80 mb-4 uppercase italic">CURRENT BRACKETS</h3>
          <BracketCard 
            name="PREMIUM LEAGUE" 
            status="ACTIVE" 
            icon={Crown} 
            color="border-l-cyan-400"
          />
          <BracketCard 
            name="SILVER SERIES" 
            status="COMPLETED" 
            icon={Trophy} 
            color="border-l-emerald-500"
          />
          <BracketCard 
            name="ELITE MASTERS" 
            status="LOCKED" 
            icon={Star} 
            color="border-l-white/10"
          />
          <BracketCard 
            name="TITAN CUP" 
            status="LOCKED" 
            icon={Star} 
            color="border-l-white/10"
          />
      </div>

      <div className="mt-12 p-6 glass-card border-cyan-400/20 bg-cyan-400/5 rounded-2xl relative overflow-hidden">
          <div className="absolute -left-10 top-0 bottom-0 w-20 bg-cyan-400/10 blur-3xl" />
          <p className="text-xs text-center text-cyan-400/70 font-bold italic uppercase tracking-wider relative z-10 transition-all hover:scale-105">
            "The throne awaits the one who masters the motion."
          </p>
      </div>
    </div>
  );
};
