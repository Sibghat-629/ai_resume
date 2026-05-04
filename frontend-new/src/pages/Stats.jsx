import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Trophy, 
  Target, 
  Zap, 
  TrendingUp, 
  Award,
  ChevronDown,
  ArrowUpRight,
  Lightbulb
} from 'lucide-react';
import axios from 'axios';

const API_BASE = '';

const Stats = () => {
  const [stats, setStats] = useState(null);
  const [userIdentity] = useState(localStorage.getItem('iv_user_identity') || 'default_user');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/stats/${userIdentity}`);
        setStats(res.data);
      } catch (e) {
        console.error("Failed to fetch stats", e);
      }
    };
    fetchStats();
  }, [userIdentity]);

  if (!stats) return <div className="animate-pulse space-y-8">
    <div className="h-64 glass-card bg-white/5"></div>
    <div className="grid grid-cols-2 gap-8">
      <div className="h-64 glass-card bg-white/5"></div>
      <div className="h-64 glass-card bg-white/5"></div>
    </div>
  </div>;

  return (
    <div className="space-y-8 pb-12">
      {/* Top Overview Cards */}
      <div className="grid grid-cols-3 gap-8">
         <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="col-span-2 glass-card p-8 bg-gradient-to-br from-primary/10 to-transparent"
         >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-white">Performance Overview</h2>
                <p className="text-muted">Your average interview score across all categories</p>
              </div>
              <div className="text-right">
                <span className="text-4xl font-black text-white">{stats.average_score.toFixed(1)}</span>
                <span className="text-muted font-bold ml-1">/ 10</span>
              </div>
            </div>
            
            {/* Visual Score Gauge (SVG) */}
            <div className="h-48 flex items-end justify-between gap-2">
              {(stats.recent_scores || []).reverse().map((s, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-4 group">
                  <div className="relative w-full flex-1 flex items-end justify-center">
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${s.overall_score * 10}%` }}
                      transition={{ delay: i * 0.1, duration: 1, ease: "easeOut" }}
                      className={`w-full max-w-[40px] rounded-t-xl relative overflow-hidden group-hover:opacity-80 transition-opacity ${
                        s.overall_score >= 8 ? 'bg-emerald-400' : s.overall_score >= 6 ? 'bg-amber-400' : 'bg-rose-400'
                      }`}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </motion.div>
                    <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-black text-[10px] font-bold px-2 py-1 rounded shadow-lg pointer-events-none">
                      {s.overall_score.toFixed(1)}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted font-bold uppercase truncate w-full text-center">
                    {new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
         </motion.div>

         <div className="col-span-1 space-y-8">
            <div className="glass-card p-6 border-l-4 border-emerald-400">
               <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 bg-emerald-400/10 rounded-xl flex items-center justify-center">
                    <Trophy className="text-emerald-400" size={20} />
                  </div>
                  <h3 className="font-bold text-white">Top Performance</h3>
               </div>
               <p className="text-sm text-muted mb-2">Your best category is:</p>
               <div className="flex items-end justify-between">
                  <span className="text-xl font-bold text-white uppercase tracking-wider">
                    {stats.category_scores?.[0]?.category.replace('_', ' ') || 'General'}
                  </span>
                  <span className="text-2xl font-black text-emerald-400">{stats.category_scores?.[0]?.avg_score.toFixed(1) || '0.0'}</span>
               </div>
            </div>

            <div className="glass-card p-6 border-l-4 border-amber-400">
               <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 bg-amber-400/10 rounded-xl flex items-center justify-center">
                    <Target className="text-amber-400" size={20} />
                  </div>
                  <h3 className="font-bold text-white">Next Milestone</h3>
               </div>
               <p className="text-sm text-muted mb-2">Reach average 8.5 to unlock</p>
               <div className="flex items-center gap-2">
                  <Award className="text-muted" size={20} />
                  <span className="font-bold text-muted">Advanced Interviewer Badge</span>
               </div>
            </div>
         </div>
      </div>

      {/* Detailed Category Breakdown */}
      <div className="grid grid-cols-2 gap-8">
        <div className="glass-card p-8">
           <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
              <Zap className="text-primary" size={24} />
              Category Breakdown
           </h3>
           <div className="space-y-6">
              {(stats.category_scores || []).map((cat, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-bold text-white uppercase tracking-widest">{cat.category.replace('_', ' ')}</span>
                    <span className="text-sm font-mono text-muted">{cat.avg_score.toFixed(1)}/10</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${cat.avg_score * 10}%` }}
                      className={`h-full rounded-full ${
                        i % 3 === 0 ? 'bg-primary' : i % 3 === 1 ? 'bg-secondary' : 'bg-accent'
                      }`}
                    ></motion.div>
                  </div>
                </div>
              ))}
           </div>
        </div>

        <div className="glass-card p-8 relative overflow-hidden">
           <div className="relative z-10">
              <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                <Lightbulb className="text-amber-400" size={24} />
                AI Insights
              </h3>
              <div className="space-y-4">
                <InsightItem 
                  title="Communication Clarity" 
                  description="Your explanations of technical concepts are 15% more concise than previous sessions." 
                  trend="up"
                />
                <InsightItem 
                  title="Problem Solving" 
                  description="You tend to jump into coding too quickly. Try the 'Understand-Plan-Execute' framework more." 
                  trend="down"
                />
                <InsightItem 
                  title="STAR Method" 
                  description="Excellent use of the Result component in your behavioral answers." 
                  trend="up"
                />
              </div>
              <button className="btn btn-secondary w-full mt-8">Generate Deep Analysis</button>
           </div>
           <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/5 blur-3xl rounded-full -mr-32 -mt-32"></div>
        </div>
      </div>
    </div>
  );
};

const InsightItem = ({ title, description, trend }) => (
  <div className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
    <div className="flex items-center justify-between mb-1">
      <span className="font-bold text-white text-sm">{title}</span>
      <ArrowUpRight size={14} className={trend === 'up' ? 'text-emerald-400' : 'text-rose-400'} />
    </div>
    <p className="text-xs text-muted leading-relaxed">{description}</p>
  </div>
);

export default Stats;
