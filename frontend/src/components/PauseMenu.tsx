import { motion } from 'motion/react';
import { useGameStore } from '../stores/useGameStore';
import { Play, Settings, RefreshCw, RotateCcw, XCircle } from 'lucide-react';

export const PauseMenu = () => {
  const setState = useGameStore((state) => state.setState);
  const resetScore = useGameStore((state) => state.resetScore);

  const menuItems = [
    { label: 'Resume Match', hint: 'Continue from this ball', icon: Play, action: () => setState('PLAY'), style: 'btn-primary' },
    { label: 'Settings', hint: 'Audio, haptics, graphics', icon: Settings, action: () => setState('SETTINGS'), style: 'btn-secondary' },
    { label: 'Recalibrate Camera', hint: 'Retune motion tracking', icon: RefreshCw, action: () => setState('CALIBRATION'), style: 'btn-secondary' },
    { label: 'Restart Match', hint: 'Reset score and play again', icon: RotateCcw, action: () => { resetScore(); setState('PLAY'); }, style: 'btn-secondary' },
    { label: 'End Match', hint: 'Return to lobby', icon: XCircle, action: () => { resetScore(); setState('DASHBOARD'); }, style: 'btn-danger' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-xs space-y-6"
      >
        <div className="text-center mb-8">
          <p className="eyebrow mb-3">Match Paused</p>
          <h1 className="text-5xl font-black italic tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">Choose Next Step</h1>
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
              className={`w-full justify-start px-5 py-4 group ${item.style}`}
            >
              <item.icon size={20} className="transition-transform group-hover:rotate-6" />
              <span className="flex flex-col items-start">
                <span className="text-sm">{item.label}</span>
                <span className="text-[10px] normal-case not-italic tracking-wide opacity-60">{item.hint}</span>
              </span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
};
