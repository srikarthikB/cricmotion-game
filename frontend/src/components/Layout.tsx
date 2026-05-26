import { motion, AnimatePresence } from 'motion/react';
import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#000000]">
      {/* VIBRANT REAL-WORLD CRICKET BACKGROUND */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?auto=format&fit=crop&q=80&w=1600" 
            alt="Cricket Stadium Vibrant" 
            className="w-full h-full object-cover scale-105 relative transition-transform duration-[30s] animate-pulse"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />
        </div>
        
        {/* Layer 1: Atmospheric Depth - Less oppressive, more glow */}
        <div className="absolute inset-0 bg-radial-[circle_at_50%_40%,transparent_0%,rgba(0,0,0,0.7)_100%] z-10" />

        {/* Layer 2: Vibrant Glows */}
        <div className="absolute top-[5%] left-[5%] w-[45%] h-[45%] bg-cyan-500/20 blur-[150px] rounded-full z-20" />
        <div className="absolute bottom-[5%] right-[5%] w-[45%] h-[45%] bg-fuchsia-600/20 blur-[150px] rounded-full z-20" />

        {/* Tactical HUD Overlays */}
        <div className="absolute inset-0 opacity-20 z-20 pointer-events-none">
           <div className="absolute w-[2px] h-full left-[8%] bg-gradient-to-b from-transparent via-cyan-400 to-transparent" />
           <div className="absolute w-[2px] h-full right-[8%] bg-gradient-to-b from-transparent via-fuchsia-500 to-transparent" />
           <div className="absolute h-[1px] w-full top-[18%] bg-cyan-400/20" />
           <div className="absolute h-[1px] w-full bottom-[18%] bg-fuchsia-500/20" />
        </div>
        
        <div className="scanline z-40 opacity-5" />
      </div>

      <AnimatePresence mode="wait">
        <motion.main
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="relative z-10 w-full h-full flex flex-col"
        >
          {children}
        </motion.main>
      </AnimatePresence>
    </div>
  );
};
