import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Mic2, 
  History, 
  BarChart3, 
  User, 
  Settings,
  Bell,
  Search
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

import Dashboard from './pages/Dashboard';
import Interview from './pages/Interview';
import HistoryPage from './pages/History';
import Stats from './pages/Stats';

const Sidebar = () => {
  const [user, setUser] = useState(localStorage.getItem('iv_user_identity') || 'Guest');
  
  return (
    <div className="w-64 glass-card h-[calc(100vh-4rem)] sticky top-8 m-8 flex flex-col">
      <div className="flex items-center gap-3 p-6 mb-8">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
          <Mic2 className="text-white" size={24} />
        </div>
        <span className="text-xl font-bold tracking-tight">Interview<span className="text-primary">Pro</span></span>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" />
        <NavItem to="/interview" icon={<Mic2 size={20} />} label="Interview" />
        <NavItem to="/history" icon={<History size={20} />} label="History" />
        <NavItem to="/stats" icon={<BarChart3 size={20} />} label="Statistics" />
      </nav>

      <div className="p-4 mt-auto">
        <div className="glass-card p-4 flex items-center gap-3 bg-white/5 border-white/5">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center font-bold text-white">
            {user[0].toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold truncate">{user}</span>
            <span className="text-xs text-muted">Free Plan</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const NavItem = ({ to, icon, label }) => (
  <NavLink 
    to={to} 
    className={({ isActive }) => `
      flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
      ${isActive 
        ? 'bg-primary text-white shadow-lg shadow-primary/20' 
        : 'text-muted hover:text-white hover:bg-white/5'}
    `}
  >
    {icon}
    <span className="font-medium">{label}</span>
  </NavLink>
);

const Header = () => {
  const location = useLocation();
  const pageName = {
    '/': 'Dashboard',
    '/interview': 'Interview Session',
    '/history': 'Interview History',
    '/stats': 'Performance Stats'
  }[location.pathname] || 'InterviewPro';

  return (
    <header className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold text-white">{pageName}</h1>
        <p className="text-muted">Welcome back to your career growth journey.</p>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-xl focus-within:border-primary/50 transition-colors">
          <Search size={18} className="text-muted" />
          <input 
            type="text" 
            placeholder="Search interviews..." 
            className="bg-transparent border-none outline-none text-sm w-48 text-white placeholder:text-muted/50"
          />
        </div>
        <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all text-muted hover:text-white">
          <Bell size={20} />
        </button>
        <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all text-muted hover:text-white">
          <Settings size={20} />
        </button>
      </div>
    </header>
  );
};

const App = () => {
  return (
    <Router>
      <div className="app-container">
        <div className="app-bg">
          <div className="bg-grid"></div>
          <div className="bg-glow glow-1"></div>
          <div className="bg-glow glow-2"></div>
          <div className="bg-glow glow-3"></div>
        </div>
        
        <Sidebar />
        
        <main className="flex-1 p-8 overflow-y-auto max-h-screen">
          <Header />
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/interview" element={<Interview />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/stats" element={<Stats />} />
            </Routes>
          </AnimatePresence>
        </main>
      </div>
    </Router>
  );
};

export default App;
