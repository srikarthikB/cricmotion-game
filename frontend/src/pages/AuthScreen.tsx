import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useGameStore } from '../stores/useGameStore';
import { apiService } from '../services/apiService';
import { User as UserIcon, Shield, Zap } from 'lucide-react';

export const AuthScreen = () => {
  const setState = useGameStore((state) => state.setState);
  const setUser = useGameStore((state) => state.setUser);
  const [name, setName] = useState('');

  useEffect(() => {
    const existingUser = apiService.getStoredUser();
    if (existingUser) {
      setUser(existingUser);
      setState('DASHBOARD');
    }
  }, [setUser, setState]);

  const handleStart = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;
    
    const user = await apiService.createAccount(name.trim());
    setUser(user);
    setState('DASHBOARD');
  };

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card w-full max-w-md p-8 relative overflow-hidden backdrop-blur-3xl border-white/10"
      >
        {/* Animated Background Glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/10 blur-[100px] rounded-full" />
        
        <div className="text-center mb-10 relative z-10">
          <div className="inline-flex p-3 rounded-2xl bg-cyan-400/10 border border-cyan-400/20 mb-4">
             <UserIcon className="text-cyan-400 w-8 h-8" />
          </div>
          <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none mb-2">ACCESS TERMINAL</h2>
          <p className="text-white/40 text-[10px] font-black tracking-[0.3em] uppercase italic">ESTABLISHING NEURAL LINK</p>
        </div>

        <form onSubmit={handleStart} className="space-y-6 relative z-10">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-cyan-400 uppercase tracking-widest italic ml-1">OPERATOR IDENTIFIER</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ENTER YOUR NAME..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white font-bold placeholder:text-white/20 focus:outline-none focus:border-cyan-400/50 transition-colors uppercase italic"
              autoFocus
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={!name.trim()}
            className={`w-full flex items-center justify-center space-x-3 gradient-btn h-16 ${!name.trim() ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
          >
            <Zap className="w-5 h-5 fill-black" />
            <span className="text-lg font-black italic tracking-tighter">INITIALIZE START</span>
          </motion.button>

          <div className="flex items-center space-x-4 opacity-30 group">
            <div className="h-[1px] flex-1 bg-white/10" />
            <span className="text-[9px] font-black text-white uppercase italic">OR</span>
            <div className="h-[1px] flex-1 bg-white/10" />
          </div>

          <button 
            type="button"
            className="w-full py-4 px-6 rounded-2xl border border-white/5 text-white/40 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center font-black text-xs uppercase italic tracking-widest"
          >
            <Shield className="mr-3 w-4 h-4 opacity-50" />
            PRIVILEGED UPLINK
          </button>
        </form>

        <div className="mt-10 pt-6 border-t border-white/5 text-center">
          <p className="text-[9px] text-white/20 font-black tracking-[0.4em] uppercase italic">
            SECURE.PROTOCOL.STADIUM.V4.1
          </p>
        </div>
      </motion.div>

      {/* Decorative HUD markers */}
      <div className="absolute top-8 left-8 text-cyan-400/20 font-mono text-[10px] tracking-widest">
        [AUTH_SEC_LAYER_01]
      </div>
      <div className="absolute bottom-8 right-8 text-cyan-400/20 font-mono text-[10px] tracking-widest">
        LAT_MS: 12.0
      </div>
    </div>
  );
};
