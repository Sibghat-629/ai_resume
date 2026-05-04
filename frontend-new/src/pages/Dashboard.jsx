import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  CheckCircle2, 
  Star, 
  HelpCircle, 
  Upload, 
  ArrowRight,
  TrendingUp,
  Clock
} from 'lucide-react';
import axios from 'axios';

const API_BASE = '';

const Dashboard = () => {
  const [stats, setStats] = useState({
    total_interviews: 0,
    completed_interviews: 0,
    average_score: 0,
    total_questions_answered: 0
  });
  const [resume, setResume] = useState(null);
  const [recentInterviews, setRecentInterviews] = useState([]);
  const [userIdentity] = useState(localStorage.getItem('iv_user_identity') || 'default_user');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsRes = await axios.get(`${API_BASE}/api/stats/${userIdentity}`);
        setStats(statsRes.data);

        const resumeRes = await axios.get(`${API_BASE}/api/resume/${userIdentity}`);
        setResume(resumeRes.data);

        const ivRes = await axios.get(`${API_BASE}/api/interviews?user_identity=${userIdentity}&limit=5`);
        setRecentInterviews(ivRes.data.interviews);
      } catch (e) {
        console.error("Failed to fetch dashboard data", e);
      }
    };
    fetchData();
  }, [userIdentity]);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-6">
        <StatCard 
          icon={<FileText className="text-indigo-400" />} 
          label="Total Interviews" 
          value={stats.total_interviews} 
          trend="+12%"
        />
        <StatCard 
          icon={<CheckCircle2 className="text-emerald-400" />} 
          label="Completed" 
          value={stats.completed_interviews} 
          trend="+5%"
        />
        <StatCard 
          icon={<Star className="text-amber-400" />} 
          label="Avg Score" 
          value={stats.average_score.toFixed(1)} 
          trend="+0.4"
        />
        <StatCard 
          icon={<HelpCircle className="text-pink-400" />} 
          label="Questions" 
          value={stats.total_questions_answered} 
          trend="+28"
        />
      </div>

      <div className="grid grid-cols-3 gap-8">
        {/* Resume Card */}
        <motion.div variants={item} className="col-span-1 glass-card p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Resume / CV</h2>
            <span className={`badge ${resume ? 'badge-success' : 'badge-warning'}`}>
              {resume ? 'Uploaded' : 'No Resume'}
            </span>
          </div>

          {!resume ? (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer group">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Upload size={32} className="text-muted group-hover:text-primary" />
              </div>
              <p className="font-semibold text-white">Drop your resume</p>
              <p className="text-xs text-muted mt-1">PDF, DOCX up to 10MB</p>
              <button className="btn btn-secondary btn-sm mt-6">Browse Files</button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl mb-6">
                <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                  <FileText className="text-indigo-400" size={20} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{resume.filename}</p>
                  <p className="text-xs text-muted">Uploaded {new Date(resume.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white/5 p-3 rounded-xl">
                  <p className="text-xs text-muted">Skills</p>
                  <p className="text-lg font-bold text-white">{resume.parsed_data.skills?.length || 0}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl">
                  <p className="text-xs text-muted">Experience</p>
                  <p className="text-lg font-bold text-white">{resume.parsed_data.experience?.length || 0}</p>
                </div>
              </div>

              <button className="btn btn-secondary w-full mt-auto">Update Resume</button>
            </div>
          )}
        </motion.div>

        {/* Recent Activity */}
        <motion.div variants={item} className="col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Recent Interviews</h2>
            <button className="text-primary text-sm font-semibold flex items-center gap-1 hover:underline">
              View All <ArrowRight size={14} />
            </button>
          </div>

          <div className="space-y-4">
            {recentInterviews.length > 0 ? recentInterviews.map((iv) => (
              <div key={iv.id} className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-colors cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Clock size={24} className="text-muted group-hover:text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{iv.interview_type ? iv.interview_type.charAt(0).toUpperCase() + iv.interview_type.slice(1) : 'General'} Interview</p>
                    <p className="text-xs text-muted">{new Date(iv.created_at).toLocaleDateString()} · {iv.questions_asked || 0} Questions</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${getScoreColor(iv.overall_score)}`}>
                    {iv.overall_score ? iv.overall_score.toFixed(1) : '--'}
                    <span className="text-xs text-muted font-normal"> / 10</span>
                  </p>
                  <span className={`badge ${iv.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                    {iv.status}
                  </span>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <HelpCircle size={48} className="text-muted/30 mb-4" />
                <p className="text-muted">No interviews yet. Ready to start?</p>
                <button className="btn btn-primary mt-6">Start Your First Interview</button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

const StatCard = ({ icon, label, value, trend }) => (
  <motion.div 
    variants={{
      hidden: { scale: 0.9, opacity: 0 },
      show: { scale: 1, opacity: 1 }
    }}
    className="glass-card p-6 flex items-start justify-between relative overflow-hidden group hover:scale-[1.02] transition-transform"
  >
    <div className="relative z-10">
      <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-white/10 transition-colors">
        {icon}
      </div>
      <p className="text-sm font-medium text-muted">{label}</p>
      <h3 className="text-3xl font-bold text-white mt-1">{value}</h3>
    </div>
    
    <div className="flex flex-col items-end justify-between h-full relative z-10">
      <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-400/10 px-2 py-1 rounded-lg">
        <TrendingUp size={12} />
        {trend}
      </div>
    </div>
    
    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors"></div>
  </motion.div>
);

const getScoreColor = (score) => {
  if (!score) return 'text-muted';
  if (score >= 8) return 'text-emerald-400';
  if (score >= 6) return 'text-amber-400';
  return 'text-rose-400';
};

export default Dashboard;
