import { motion } from 'motion/react';
import { useGameStore } from '../stores/useGameStore';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';

import { TEAMS, VENUES } from '../constants';

const Selector = ({ label, value, onPrev, onNext }: any) => (
  <div className="flex items-center justify-between py-5 border-b border-white/5 last:border-0 px-4 group">
    <span className="section-label group-hover:text-cyan-300 transition-colors">{label}</span>
    <div className="flex items-center space-x-6">
      <button onClick={onPrev} className="btn-icon h-10 w-10" aria-label={`Decrease ${label}`}><ChevronLeft size={22} /></button>
      <span className="text-3xl font-black italic min-w-[100px] text-center text-white tracking-tighter uppercase">{value}</span>
      <button onClick={onNext} className="btn-icon h-10 w-10" aria-label={`Increase ${label}`}><ChevronRight size={22} /></button>
    </div>
  </div>
);

export const MatchSettingsScreen = () => {
  const setState = useGameStore((state) => state.setState);
  const config = useGameStore((state) => state.matchConfig);
  const updateConfig = useGameStore((state) => state.updateMatchConfig);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="screen-shell flex flex-col space-y-8 pb-48"
    >
      <header className="screen-header">
        <button onClick={() => setState('DASHBOARD')} className="btn-icon" aria-label="Back to lobby">
            <ChevronLeft size={24} className="text-white" />
        </button>
        <div className="text-center">
            <p className="eyebrow mb-2">Step 1 of 2</p>
            <h1 className="screen-title">Match Setup</h1>
            <p className="helper-text mt-2">Pick the rules, team, and stadium before calibration.</p>
        </div>
        <div className="w-12" />
      </header>

      <div className="space-y-8">
        <section>
          <div className="flex items-center justify-between mb-4">
             <h3 className="section-label">01. Match Rules</h3>
             <div className="h-[1px] flex-1 bg-white/10 ml-4" />
          </div>
          <div className="glass-card overflow-hidden border-white/5">
             <Selector 
                label="MATCH LENGTH" 
                value={config.overs === 20 ? 'T-20' : `${config.overs} OVERS`} 
                onPrev={() => updateConfig({ overs: Math.max(1, config.overs - 1) })}
                onNext={() => updateConfig({ overs: Math.min(50, config.overs + 1) })}
             />
             <Selector 
                label="WICKET CAP" 
                value={config.wickets}
                onPrev={() => updateConfig({ wickets: Math.max(1, config.wickets - 1) })}
                onNext={() => updateConfig({ wickets: Math.min(10, config.wickets + 1) })}
             />
             <div className="flex items-center justify-between py-6 px-4">
                <span className="section-label">Run Chase Mode</span>
                <button 
                    onClick={() => updateConfig({ isRunChase: !config.isRunChase })}
                    aria-label="Toggle run chase mode"
                    className={`w-16 h-8 rounded-full relative transition-all duration-300 ${config.isRunChase ? 'bg-cyan-400' : 'bg-white/10 shadow-inner'}`}
                >
                    <motion.div 
                        animate={{ x: config.isRunChase ? 36 : 4 }}
                        className={`absolute top-1 left-0 w-6 h-6 rounded-full shadow-lg ${config.isRunChase ? 'bg-black' : 'bg-white/20'}`}
                    />
                </button>
             </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-6">
             <h3 className="section-label">02. Choose Team</h3>
             <div className="h-[1px] flex-1 bg-white/10 ml-4" />
          </div>
          <div className="flex space-x-4 overflow-x-auto pb-4 px-2 scrollbar-none snap-x items-center">
              {TEAMS.map(team => (
              <motion.div
                  key={team.id}
                  onClick={() => updateConfig({ team: team.id })}
                  role="button"
                  aria-label={`Select ${team.name}`}
                  className={`flex-shrink-0 w-28 aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer border-2 transition-all duration-500 snap-center relative ${config.team === team.id ? 'border-cyan-400 scale-110 z-10 shadow-[0_0_30px_rgba(34,211,238,0.3)]' : 'border-white/10 opacity-70 hover:opacity-100'}`}
              >
                  <img 
                      src={`https://flagcdn.com/w320/${team.code}.png`} 
                      alt={team.name}
                      className="w-full h-full object-cover"
                  />
                  {config.team === team.id && (
                    <div className="absolute inset-0 bg-cyan-400/10 flex flex-col items-center justify-end p-2">
                        <span className="text-[8px] font-black text-white bg-black/80 px-2 py-0.5 rounded-full tracking-widest">{team.name}</span>
                    </div>
                  )}
              </motion.div>
              ))}
          </div>
        </section>

        <section>
           <div className="flex items-center justify-between mb-6">
              <h3 className="section-label">03. Choose Stadium</h3>
              <div className="h-[1px] flex-1 bg-white/10 ml-4" />
           </div>
           <div className="flex space-x-6 overflow-x-auto pb-6 px-2 scrollbar-none snap-x">
                {VENUES.map(venue => (
                <motion.div
                    key={venue.id}
                    onClick={() => updateConfig({ venue: venue.id })}
                    role="button"
                    aria-label={`Select ${venue.name}`}
                    className={`flex-shrink-0 w-64 aspect-video rounded-[1.5rem] overflow-hidden cursor-pointer border-2 transition-all duration-500 snap-center relative ${config.venue === venue.id ? 'border-cyan-400 scale-105 z-10 shadow-[0_0_40px_rgba(34,211,238,0.25)]' : 'border-white/10 opacity-70 hover:opacity-100'}`}
                >
                    <img src={venue.img} alt={venue.name} className="w-full h-full object-cover brightness-75 group-hover:brightness-100" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
                        <span className="text-xs font-black text-white uppercase tracking-wider italic">{venue.name}</span>
                    </div>
                </motion.div>
                ))}
            </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 w-full p-8 z-50 bg-gradient-to-t from-black via-black/80 to-transparent">
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setState('CALIBRATION')}
          className="btn-primary w-full h-20 text-xl sm:text-2xl shadow-[0_20px_50px_rgba(34,211,238,0.3)]"
        >
          <Play size={30} className="fill-black" />
          <span>Continue To Camera Setup</span>
        </motion.button>
      </div>
    </motion.div>
  );
};
