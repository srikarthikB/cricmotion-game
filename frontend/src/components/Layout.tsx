import { motion, AnimatePresence } from 'motion/react';
import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="relative w-full h-screen overflow-hidden bg-[var(--color-game-bg)]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?auto=format&fit=crop&q=80&w=1600" 
            alt="Cricket stadium" 
            className="w-full h-full object-cover scale-105 relative saturate-[0.82] contrast-[1.08] brightness-[0.62]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/25" />
          <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(5,8,13,0.95)_0%,rgba(7,19,15,0.78)_42%,rgba(5,8,13,0.92)_100%)]" />
        </div>
        
        <div className="absolute inset-0 z-10 bg-radial-[circle_at_50%_38%,rgba(103,232,249,0.08)_0%,rgba(5,8,13,0.62)_46%,rgba(0,0,0,0.9)_100%]" />
        <div className="absolute inset-x-0 bottom-0 z-20 h-[34%] bg-gradient-to-t from-[rgba(6,32,23,0.72)] to-transparent" />
        <div className="absolute inset-x-0 top-0 z-20 h-[28%] bg-gradient-to-b from-black/80 to-transparent" />

        <div className="absolute inset-0 opacity-[0.14] z-20 pointer-events-none">
           <div className="absolute w-[1px] h-full left-[8%] bg-gradient-to-b from-transparent via-cyan-200 to-transparent" />
           <div className="absolute w-[1px] h-full right-[8%] bg-gradient-to-b from-transparent via-cyan-200 to-transparent" />
           <div className="absolute h-[1px] w-full top-[18%] bg-cyan-200/40" />
           <div className="absolute h-[1px] w-full bottom-[18%] bg-cyan-200/25" />
        </div>
        
        <div className="scanline z-40 opacity-[0.035]" />
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
