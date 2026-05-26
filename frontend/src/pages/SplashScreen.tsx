import { motion } from 'motion/react';
import { useEffect } from 'react';
import { useGameStore } from '../stores/useGameStore';

export const SplashScreen = () => {
  const setState = useGameStore((state) => state.setState);

  useEffect(() => {
    const timer = setTimeout(() => {
      setState('AUTH');
    }, 4000);
    return () => clearTimeout(timer);
  }, [setState]);

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 bg-white">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ 
          scale: [0.8, 1.1, 1],
          opacity: 1,
          filter: ["blur(10px)", "blur(0px)"]
        }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="relative"
      >
        <div className="absolute -inset-4 bg-sky-500/10 blur-2xl rounded-full" />
        <h1 className="text-7xl font-black italic tracking-tighter text-slate-900 drop-shadow-[0_4px_10px_rgba(0,0,0,0.1)]">
          CRIC<span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-fuchsia-500">MOTION</span>
        </h1>
        <motion.div
           initial={{ width: 0 }}
           animate={{ width: "100%" }}
           transition={{ delay: 1, duration: 1.5 }}
           className="h-1 bg-gradient-to-r from-transparent via-sky-500 to-transparent mt-2 shadow-sm"
        />
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.8 }}
        className="flex flex-col items-center space-y-4"
      >
        <div className="flex space-x-2">
            {[0, 1, 2].map((i) => (
                <motion.div
                    key={i}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                    className="w-2 h-2 bg-sky-500 rounded-full shadow-md"
                />
            ))}
        </div>
        <p className="text-sky-600/60 font-mono text-sm tracking-[0.3em] uppercase italic font-bold">Initializing Stadium Pro...</p>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="text-[10px] text-slate-400 font-mono tracking-widest uppercase mt-4"
        >
          v4.1.2-Stable • premium stadium & country pack enabled
        </motion.p>
      </motion.div>

      {/* Futuristic Background Element */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute w-[800px] h-[800px] border border-sky-500/5 rounded-full pointer-events-none"
        style={{ borderStyle: 'solid' }}
      />
    </div>
  );
};
