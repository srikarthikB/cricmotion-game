import { motion } from 'motion/react';
import { useGameStore } from '../stores/useGameStore';
import { Trophy, Star, ChevronRight, Share2, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useEffect } from 'react';

export const MatchSummaryScreen = () => {
  const setState = useGameStore((state) => state.setState);
  const score = useGameStore((state) => state.score);

  useEffect(() => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#0ea5e9', '#d946ef', '#ffffff']
    });
  }, []);

  return (
    <div className="flex-1 flex flex-col px-6 py-10 overflow-y-auto font-sans">
      <div className="text-center mb-10">
        <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            className="w-24 h-24 bg-gradient-to-br from-cyan-400 to-cyan-700 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-[0_0_50px_rgba(34,211,238,0.4)] border-2 border-white/20"
        >
            <Trophy size={48} className="text-black" />
        </motion.div>
        <h1 className="text-7xl font-black italic tracking-tighter neon-text uppercase leading-none drop-shadow-[0_0_20px_cyan]">VICTORY</h1>
        <p className="text-cyan-400/60 font-black tracking-[0.4em] uppercase mt-4 text-[10px] italic">MATCH PROTOCOL COMPLETED</p>
      </div>

      <div className="space-y-6">
          <div className="p-8 glass-card border-white/10 relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-5 italic font-black text-8xl text-white group-hover:scale-110 transition-transform">WIN</div>
             <div>
                <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.3em] mb-2">FINAL SCORE</p>
                <p className="text-6xl font-black italic text-white leading-none">{score.runs} <span className="text-2xl text-white/30">/ {score.wickets}</span></p>
             </div>
             <div className="mt-8 flex justify-between items-center">
                <div>
                   <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-1">STRIKE RATE</p>
                   <p className="text-3xl font-black italic text-cyan-400 leading-none">{(score.runs / (score.balls || 1) * 100).toFixed(1)}</p>
                </div>
                <div className="flex space-x-1 items-end h-10">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="w-1.5 bg-cyan-400 rounded-full" style={{ height: `${20 + i * 15}%`, opacity: 0.2 + i * 0.1 }} />
                    ))}
                </div>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="glass-card p-6 border-white/5">
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1 italic">MAX POWER</p>
                <p className="text-3xl font-black italic text-white">92%</p>
             </div>
             <div className="glass-card p-6 border-white/5">
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1 italic">TIMING ACC.</p>
                <p className="text-3xl font-black italic text-white">88%</p>
             </div>
          </div>

          <section className="pt-4">
            <h3 className="text-[10px] font-black tracking-[0.3em] text-cyan-400/80 mb-4 uppercase italic">ACHIEVEMENTS</h3>
            <div className="space-y-3">
                {[
                    { title: 'CRITICAL HIT', desc: 'Smashed a 6 with perfect timing', icon: Zap, color: 'text-amber-400' },
                    { title: 'PRO BALLER', desc: 'Completed tournament tier-1', icon: Star, color: 'text-fuchsia-500' },
                ].map((item, i) => (
                    <div key={i} className="flex items-center p-4 glass-card border-white/5 hover:border-white/20 transition-all">
                        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mr-4 border border-white/5">
                            <item.icon size={24} className={item.color} />
                        </div>
                        <div>
                            <p className="text-lg font-black text-white italic tracking-tight">{item.title}</p>
                            <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">{item.desc}</p>
                        </div>
                    </div>
                ))}
            </div>
          </section>
      </div>

      <div className="mt-10 flex space-x-4">
          <button className="flex-1 py-4 glass-card flex items-center justify-center border-white/10 hover:bg-white/5">
             <Share2 size={20} className="mr-2" />
             <span className="font-bold tracking-widest italic uppercase">Share</span>
          </button>
          <button 
            onClick={() => setState('DASHBOARD')}
            className="flex-[2] gradient-btn flex items-center justify-center"
          >
             <span className="font-bold tracking-widest italic uppercase">CONTINUE</span>
             <ChevronRight size={20} className="ml-1" />
          </button>
      </div>
    </div>
  );
};
