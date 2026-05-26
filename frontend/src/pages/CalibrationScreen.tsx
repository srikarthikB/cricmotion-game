import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameStore } from '../stores/useGameStore';
import { apiService } from '../services/apiService';
import { Camera, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export const CalibrationScreen = () => {
  const setState = useGameStore((state) => state.setState);
  const user = useGameStore((state) => state.user);
  const matchConfig = useGameStore((state) => state.matchConfig);
  const setBackendMatch = useGameStore((state) => state.setBackendMatch);
  const resetScore = useGameStore((state) => state.resetScore);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'INITIALIZING' | 'READY' | 'CALIBRATING' | 'SUCCESS' | 'ERROR'>('INITIALIZING');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 1280, height: 720, facingMode: 'user' } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setStatus('READY');
        }
      } catch (err) {
        console.error('Camera access failed:', err);
        setStatus('ERROR');
      }
    }
    setupCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  const startBackendMatch = async () => {
    try {
      const match = await apiService.startMatch({
        ...matchConfig,
        playerName: user?.name || 'Player',
      });

      setBackendMatch({
        gameId: match.game_id,
        target: match.target,
        overs: match.overs,
      });
      resetScore();
      setStatus('SUCCESS');
      setTimeout(() => setState('PLAY'), 1500);
    } catch (err) {
      console.error('Backend match start failed:', err);
      setStatus('ERROR');
    }
  };

  const startCalibration = () => {
    setStatus('CALIBRATING');
    let p = 0;
    const interval = setInterval(() => {
      p += 2;
      setProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        startBackendMatch();
      }
    }, 50);
  };

  return (
    <div className="flex-1 flex flex-col relative bg-black overflow-hidden font-sans">
      {/* Background Stadium - High Impact Night Scene - Vibrant */}
      <div className="absolute inset-0 z-0">
        <motion.img 
            animate={{ scale: [1.1, 1, 1.1] }}
            transition={{ duration: 30, repeat: Infinity }}
            src="https://images.unsplash.com/photo-1544256718-3bcf237f3974?auto=format&fit=crop&q=80&w=1200" 
            alt="Stadium Floodlights" 
            className="w-full h-full object-cover blur-[1px] opacity-40 shadow-inner"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col p-6 overflow-y-auto scrollbar-none">
        <header className="flex items-center justify-between mb-8">
            <button onClick={() => setState('DASHBOARD')} className="p-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                <RefreshCw size={20} className="text-white opacity-50 rotate-180" />
            </button>
            <div className="text-center">
                <p className="text-[9px] font-black tracking-[0.4em] text-cyan-400 opacity-50 uppercase mb-1 leading-none italic">SENSORS ACTIVE</p>
                <h1 className="text-2xl font-black italic tracking-tighter uppercase text-white leading-none">BIOMETRICS</h1>
            </div>
            <div className="w-12" />
        </header>

        <div className="flex-1 flex flex-col items-center justify-center py-4">
            <motion.div
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className="mb-8 text-center"
            >
                <h1 className="text-6xl font-black italic text-white mb-2 leading-[0.8] tracking-tighter drop-shadow-[0_0_20px_rgba(0,0,0,1)] uppercase">
                BIOMETRIC<br/>
                <span className="text-cyan-400">CALIBRATION</span>
                </h1>
                <div className="flex items-center justify-center space-x-2 font-black italic tracking-[0.3em] text-cyan-400/50 text-[10px] uppercase mt-4">
                    <motion.span
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                    >
                        {status === 'READY' ? 'SYSTEM READY BYPASS' : `MAPPING SKELETON... (${Math.floor(progress)}%)`}
                    </motion.span>
                </div>
            </motion.div>

            {/* Webcam Viewport */}
            <div className="relative w-full max-w-[340px] aspect-[4/5] rounded-[2.5rem] border-[1px] border-white/10 overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)] bg-slate-900 group">
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover opacity-100 scale-x-[-1]"
                />
                
                {/* Tech Silhouette Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-12">
                    <div className="relative w-full h-full border-2 border-cyan-400/20 rounded-[2rem] flex items-center justify-center">
                        <svg viewBox="0 0 100 150" className={`w-3/4 h-3/4 ${status === 'CALIBRATING' ? 'text-cyan-400 animate-pulse' : 'text-white/20'}`}>
                            <path 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="1.5" 
                                d="M50,15 Q60,15 60,25 Q60,35 50,35 Q40,35 40,25 Q40,15 50,15 M30,40 Q50,35 70,40 L75,80 L65,80 L60,140 L40,140 L35,80 L25,80 Z"
                            />
                        </svg>
                        {/* HUD Targets */}
                        <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.5, 0.2] }} transition={{ repeat: Infinity, duration: 1 }} className="absolute top-1/4 w-4 h-4 rounded-full border border-cyan-400" />
                        <motion.div animate={{ scale: [1.5, 1, 1.5], opacity: [0.5, 0.2, 0.5] }} transition={{ repeat: Infinity, duration: 1 }} className="absolute bottom-1/4 w-6 h-6 rounded-full border border-fuchsia-500" />
                    </div>
                </div>

                {/* Corner Markers */}
                <div className="absolute top-8 left-8 w-10 h-10 border-t-2 border-l-2 border-cyan-400 shadow-[-10px_-10px_20px_rgba(0,242,255,0.2)] rounded-tl-xl" />
                <div className="absolute top-8 right-8 w-10 h-10 border-t-2 border-r-2 border-cyan-400 shadow-[10px_-10px_20px_rgba(0,242,255,0.2)] rounded-tr-xl" />
                <div className="absolute bottom-8 left-8 w-10 h-10 border-b-2 border-l-2 border-cyan-400 shadow-[-10px_10px_20px_rgba(0,242,255,0.2)] rounded-bl-xl" />
                <div className="absolute bottom-8 right-8 w-10 h-10 border-b-2 border-r-2 border-cyan-400 shadow-[10px_10px_20px_rgba(0,242,255,0.2)] rounded-br-xl" />

                {/* Dynamic Scanline */}
                {status === 'CALIBRATING' && (
                    <motion.div 
                        initial={{ top: '0%' }}
                        animate={{ top: '100%' }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        className="absolute inset-x-0 h-[2px] bg-cyan-400 shadow-[0_0_20px_cyan] z-20"
                    />
                )}
            </div>

            {/* Bottom Progress Bar */}
            <div className="w-full max-w-md mt-12 px-6">
                <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className="h-full bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.6)] rounded-full"
                    />
                </div>
                
                <div className="mt-8 flex flex-col items-center space-y-4">
                    <AnimatePresence mode="wait">
                        {status === 'READY' ? (
                            <motion.button
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={startCalibration}
                                className="gradient-btn py-4 px-12 text-lg shadow-[0_0_30px_rgba(0,242,255,0.2)]"
                            >
                                INITIALIZE CALIBRATION
                            </motion.button>
                        ) : status === 'SUCCESS' ? (
                            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
                                <div className="p-4 bg-emerald-500/20 rounded-full border-2 border-emerald-500 mb-2">
                                    <CheckCircle2 size={32} className="text-emerald-400" />
                                </div>
                                <span className="text-emerald-400 font-black italic tracking-widest text-lg uppercase">SIMULATION READY</span>
                            </motion.div>
                        ) : (
                            <p className="text-[10px] text-gray-500 font-black italic tracking-widest uppercase text-center animate-pulse">SYNCHRONIZING BIOMETRIC DATA • STADIUM PROTOCOL V4.1</p>
                        )}
                    </AnimatePresence>

                    <div className="pt-4 flex flex-col items-center space-y-4">
                        <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setState('DASHBOARD')}
                            className="bg-white/5 border border-white/10 px-8 py-3 rounded-2xl text-[11px] font-black text-cyan-400 uppercase tracking-widest hover:bg-white/10 transition-all flex items-center space-x-2 shadow-lg"
                        >
                            <RefreshCw size={14} className="rotate-180" />
                            <span>RETURN TO LOBBY</span>
                        </motion.button>
                        <button 
                            onClick={() => setState('MATCH_SETTINGS')}
                            className="text-[10px] font-black text-white/40 uppercase tracking-widest hover:text-white transition-colors"
                        >
                            RECONFIGURE
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
