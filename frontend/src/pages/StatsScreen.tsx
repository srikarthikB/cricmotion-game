import { motion } from 'motion/react';
import { useGameStore } from '../stores/useGameStore';
import { ChevronLeft, BarChart3, TrendingUp, Target, Clock, ShieldAlert } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const data = [
  { name: 'M1', runs: 24 },
  { name: 'M2', runs: 45 },
  { name: 'M3', runs: 12 },
  { name: 'M4', runs: 67 },
  { name: 'M5', runs: 32 },
  { name: 'M6', runs: 89 },
  { name: 'M7', runs: 54 },
];

export const StatsScreen = () => {
  const setState = useGameStore((state) => state.setState);

  return (
    <div className="flex-1 flex flex-col px-6 py-10 overflow-y-auto">
      <div className="flex items-center mb-10">
        <button onClick={() => setState('DASHBOARD')} className="mr-6 p-2 glass-card hover:bg-cyan-500/20 text-cyan-400">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-3xl font-black italic tracking-tighter uppercase neon-text">PERFORMANCE HUB</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="glass-card p-4 border-l-4 border-l-cyan-400">
          <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-1">Total Runs</p>
          <p className="text-3xl font-black italic">1,420</p>
          <div className="flex items-center text-green-400 text-[10px] mt-2">
            <TrendingUp size={12} className="mr-1" />
            <span>+12% vs last week</span>
          </div>
        </div>
        <div className="glass-card p-4 border-l-4 border-l-magenta-500">
          <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-1">Top Score</p>
          <p className="text-3xl font-black italic">102*</p>
          <div className="flex items-center text-gray-500 text-[10px] mt-2">
             <Target size={12} className="mr-1" />
             <span>STADIUM_B</span>
          </div>
        </div>
      </div>

      <section className="glass-card p-6 mb-8 h-64">
           <h3 className="text-xs font-mono tracking-[0.3em] text-cyan-400 mb-6 uppercase">RUN PROGRESSION</h3>
           <div className="w-full h-40">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorRuns" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#00f2ff" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#00f2ff" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="runs" stroke="#00f2ff" fillOpacity={1} fill="url(#colorRuns)" strokeWidth={3} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#0a0f1d', border: '1px solid #00f2ff', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
           </div>
      </section>

      <section className="space-y-4">
          <h3 className="text-xs font-mono tracking-[0.3em] text-cyan-400 mb-4 uppercase">SYSTEM LOGS</h3>
          <div className="glass-card p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                  <Clock className="text-gray-500" size={16} />
                  <span className="text-sm">Total Playtime</span>
              </div>
              <span className="font-mono text-cyan-400">14.5 HRS</span>
          </div>
          <div className="glass-card p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                  <ShieldAlert className="text-gray-500" size={16} />
                  <span className="text-sm">Safety Protocols</span>
              </div>
              <span className="font-mono text-green-400 text-xs">ENFORCED</span>
          </div>
      </section>
    </div>
  );
};
