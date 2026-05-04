import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic2, 
  X, 
  Clock, 
  MessageSquare, 
  Settings, 
  Volume2, 
  VolumeX,
  Play,
  Square,
  ChevronRight
} from 'lucide-react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  useChat,
  useToken,
  useConnectionState,
} from '@livekit/components-react';
import { Track, ConnectionState } from 'livekit-client';

const API_BASE = '';

const Interview = () => {
  const [token, setToken] = useState(null);
  const [roomName, setRoomName] = useState(localStorage.getItem('iv_user_identity') || 'default_user');
  const [isConnecting, setIsConnecting] = useState(false);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef(null);

  const startInterview = async () => {
    setIsConnecting(true);
    // In a real app, fetch token from backend
    // For this demo, we simulate token or use a test one if available
    // But since I don't have a token endpoint, I'll show the UI state
    setTimeout(() => {
      // Simulation: normally we'd setToken(fetchedToken)
      setToken('fake-token-for-ui-demo'); 
    }, 1500);
  };

  const endInterview = () => {
    setToken(null);
    setIsConnecting(false);
    setDuration(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => {
    if (token) {
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [token]);

  const formatDuration = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col">
      <AnimatePresence mode="wait">
        {!token ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex-1 flex flex-col items-center justify-center text-center p-12"
          >
            <div className="w-32 h-32 bg-primary/10 rounded-full flex items-center justify-center mb-8 relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-20"></div>
              <Mic2 size={64} className="text-primary" />
            </div>
            <h2 className="text-4xl font-bold text-white mb-4">Ready to start?</h2>
            <p className="text-muted max-w-md mb-12">
              Our AI interviewer is ready to conduct a professional session with you. 
              Ensure your microphone is working and you're in a quiet environment.
            </p>
            
            <div className="flex flex-col gap-4 w-full max-w-sm">
              <button 
                onClick={startInterview}
                disabled={isConnecting}
                className="btn btn-primary btn-lg w-full py-4 text-lg relative overflow-hidden group"
              >
                {isConnecting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Preparing Room...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Play fill="currentColor" size={20} />
                    Start Interview Now
                  </span>
                )}
              </button>
              <button className="btn btn-secondary w-full py-4 text-lg">
                <Settings size={20} className="mr-2" />
                Audio Settings
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col gap-6"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between glass-card p-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="font-bold text-white uppercase tracking-widest text-xs">Live Session</span>
                </div>
                <div className="h-6 w-px bg-white/10"></div>
                <div className="flex items-center gap-2 text-muted">
                  <Clock size={16} />
                  <span className="font-mono text-sm">{formatDuration(duration)}</span>
                </div>
              </div>
              
              <button 
                onClick={endInterview}
                className="btn bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500 hover:text-white px-4"
              >
                <X size={18} className="mr-2" />
                End Session
              </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
              {/* Voice Orb Area */}
              <div className="col-span-8 glass-card flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none"></div>
                
                <VoiceOrb isSpeaking={true} />
                
                <div className="mt-12 text-center relative z-10">
                  <h3 className="text-2xl font-bold text-white mb-2">InterviewPro AI</h3>
                  <p className="text-primary font-medium">Listening to your response...</p>
                </div>

                <div className="absolute bottom-8 left-8 right-8 flex items-center justify-center gap-4">
                   <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: "0%" }}
                        animate={{ width: "65%" }}
                        className="h-full bg-primary"
                      ></motion.div>
                   </div>
                   <span className="text-xs font-mono text-muted">Question 3 / 10</span>
                </div>
              </div>

              {/* Transcript Area */}
              <div className="col-span-4 glass-card flex flex-col min-h-0">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <MessageSquare size={18} className="text-primary" />
                    Live Transcript
                  </h3>
                  <button className="text-muted hover:text-white transition-colors">
                    <Settings size={16} />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <Message 
                    role="agent" 
                    text="Hello! I've reviewed your resume and I'm impressed with your background in React development. Let's start with a technical question."
                  />
                  <Message 
                    role="user" 
                    text="Thank you! I'm happy to be here and looking forward to the discussion."
                  />
                  <Message 
                    role="agent" 
                    text="Great. Can you explain the difference between useMemo and useCallback, and provide a real-world scenario where you'd use each?"
                  />
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
                
                <div className="p-4 bg-white/5">
                  <p className="text-xs text-center text-muted italic">
                    AI is processing your speech in real-time
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const VoiceOrb = ({ isSpeaking }) => {
  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      {/* Animated Rings */}
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 1 }}
          animate={{ 
            opacity: [0.1, 0.3, 0.1], 
            scale: [1, 1.2 + (i * 0.15), 1],
          }}
          transition={{ 
            duration: 3 + (i * 0.5), 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
          className="absolute inset-0 border border-primary/30 rounded-full"
        />
      ))}

      {/* Main Core */}
      <motion.div
        animate={{ 
          scale: isSpeaking ? [1, 1.05, 1] : 1,
          boxShadow: isSpeaking 
            ? ["0 0 20px rgba(99, 102, 241, 0.3)", "0 0 50px rgba(99, 102, 241, 0.6)", "0 0 20px rgba(99, 102, 241, 0.3)"]
            : "0 0 20px rgba(99, 102, 241, 0.3)"
        }}
        transition={{ duration: 2, repeat: Infinity }}
        className="w-32 h-32 bg-gradient-to-tr from-primary to-indigo-400 rounded-full flex items-center justify-center relative z-10 shadow-2xl"
      >
        <Mic2 size={40} className="text-white" />
        
        {/* Glow Effect */}
        <div className="absolute inset-0 bg-primary blur-2xl opacity-20 rounded-full"></div>
      </motion.div>

      {/* Waveform Visualization (Visual Mock) */}
      <div className="absolute bottom-0 flex items-center gap-1.5">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            animate={{ 
              height: isSpeaking ? [8, Math.random() * 40 + 10, 8] : 8 
            }}
            transition={{ 
              duration: 0.5 + Math.random() * 0.5, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="w-1.5 bg-primary/40 rounded-full"
          />
        ))}
      </div>
    </div>
  );
};

const Message = ({ role, text }) => (
  <div className={`flex flex-col ${role === 'user' ? 'items-end' : 'items-start'}`}>
    <span className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1 px-1">
      {role === 'agent' ? 'InterviewPro' : 'You'}
    </span>
    <div className={`max-w-[90%] p-3 rounded-2xl text-sm ${
      role === 'agent' 
        ? 'bg-white/5 text-white border border-white/5 rounded-tl-none' 
        : 'bg-primary/20 text-indigo-100 border border-primary/10 rounded-tr-none'
    }`}>
      {text}
    </div>
  </div>
);

export default Interview;
