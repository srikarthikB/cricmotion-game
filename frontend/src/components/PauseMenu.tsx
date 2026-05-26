import { motion } from 'motion/react';
import { useGameStore } from '../stores/useGameStore';
import { Play, Settings, RefreshCw, RotateCcw, XCircle } from 'lucide-react';

export const PauseMenu = () => {
  const setState = useGameStore((state) => state.setState);
  const resetScore = useGameStore((state) => state.resetScore);

  const menuItems = [
    { label: 'RESUME', icon: Play, action: () => setState('PLAY') },
    { label: 'SETTINGS', icon: Settings, action: () => {} },
    { label: 'CALIBRATE', icon: RefreshCw, action: () => setState('CALIBRATION') },
    { label: 'RESTART MATCH', icon: RotateCcw, action: () => { resetScore(); setState('PLAY'); } },
    { label: 'END GAME', icon: XCircle, action: () => { resetScore(); setState('DASHBOARD'); } },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-xs space-y-6"
      >
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black italic italic tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">PAUSED</h1>
          <div className="h-1 w-20 bg-cyan-400 mx-auto mt-2 rounded-full" />
        </div>

        <div className="space-y-3">
          {menuItems.map((item, i) => (
            <motion.button
              key={item.label}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ x: 10, backgroundColor: 'rgba(0, 242, 255, 0.1)' }}
              onClick={item.action}
              className="w-full p-4 glass-card border-white/5 flex items-center space-x-4 group text-white/80 hover:text-cyan-400 hover:border-cyan-400/30 transition-all"
            >
              <item.icon size={20} className="group-hover:rotate-12 transition-transform" />
              <span className="font-black italic tracking-widest text-lg">{item.label}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
};
