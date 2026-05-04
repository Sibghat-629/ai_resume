import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  Filter, 
  Calendar, 
  ChevronRight, 
  MoreVertical,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import axios from 'axios';

const API_BASE = '';

const HistoryPage = () => {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userIdentity] = useState(localStorage.getItem('iv_user_identity') || 'default_user');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/interviews?user_identity=${userIdentity}`);
        setInterviews(res.data.interviews);
      } catch (e) {
        console.error("Failed to fetch history", e);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [userIdentity]);

  return (
    <div className="space-y-6">
      {/* Filters & Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2.5 rounded-2xl">
          <Search size={20} className="text-muted" />
          <input 
            type="text" 
            placeholder="Search by interview type or date..." 
            className="bg-transparent border-none outline-none text-sm w-full text-white"
          />
        </div>
        
        <button className="btn btn-secondary flex items-center gap-2 px-4 py-2.5 rounded-2xl">
          <Filter size={18} />
          <span>Filters</span>
        </button>
        
        <button className="btn btn-secondary flex items-center gap-2 px-4 py-2.5 rounded-2xl">
          <Calendar size={18} />
          <span>Last 30 Days</span>
        </button>
      </div>

      {/* History List */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 bg-white/5">
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Interview Session</th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Score</th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan="6" className="px-6 py-8">
                      <div className="h-4 bg-white/5 rounded w-3/4"></div>
                    </td>
                  </tr>
                ))
              ) : interviews.length > 0 ? interviews.map((iv) => (
                <tr key={iv.id} className="hover:bg-white/5 transition-colors group cursor-pointer">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                        <CheckCircle2 size={20} className="text-primary" />
                      </div>
                      <span className="font-semibold text-white">#{iv.id} Session</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-muted">{new Date(iv.created_at).toLocaleDateString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="badge badge-info">{iv.interview_type || 'General'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary" 
                          style={{ width: `${(iv.overall_score || 0) * 10}%` }}
                        ></div>
                      </div>
                      <span className={`text-sm font-bold ${getScoreColor(iv.overall_score)}`}>
                        {iv.overall_score ? iv.overall_score.toFixed(1) : '--'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`badge ${iv.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                      {iv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 hover:bg-white/10 rounded-lg text-muted transition-colors opacity-0 group-hover:opacity-100">
                        <MoreVertical size={18} />
                      </button>
                      <ChevronRight size={20} className="text-muted group-hover:text-white transition-colors" />
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center">
                      <AlertCircle size={48} className="text-muted/20 mb-4" />
                      <p className="text-muted">No interview history found.</p>
                      <button className="btn btn-primary mt-6">Start Interview</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-white/5 flex items-center justify-between">
          <p className="text-xs text-muted">Showing 1 to {interviews.length} of {interviews.length} entries</p>
          <div className="flex items-center gap-2">
            <button className="btn btn-secondary btn-sm px-3 py-1.5 opacity-50 cursor-not-allowed">Previous</button>
            <button className="btn btn-secondary btn-sm px-3 py-1.5">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const getScoreColor = (score) => {
  if (!score) return 'text-muted';
  if (score >= 8) return 'text-emerald-400';
  if (score >= 6) return 'text-amber-400';
  return 'text-rose-400';
};

export default HistoryPage;
