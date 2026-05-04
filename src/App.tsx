import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Shield, Eye, Settings, Clock as ClockIcon, Power, Smartphone, Maximize2, Trash2, ShieldAlert, ChevronRight, LogIn, Link as LinkIcon, RefreshCcw } from 'lucide-react';
import { WebRTCService } from './services/webrtc';
import { DriveService } from './services/drive';

// --- Digital Clock Disguise ---

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

const StreamerView = ({ webrtc, roomId }: { webrtc: WebRTCService, roomId: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState('Initializing...');
  const [isLinked, setIsLinked] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      const authStatus = await DriveService.getStatus();
      setIsLinked(authStatus);
    };
    checkStatus();

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) videoRef.current.srcObject = stream;
        await webrtc.startStream(stream, roomId);
        setStatus('LIVE');
      } catch (err) {
        console.error(err);
        setStatus('Camera Error');
      }
    }
    start();

    // Remote Trigger Listener
    webrtc.onRemoteTrigger(async (command) => {
      if (command.type === 'capture' && videoRef.current) {
        try {
          const img = await webrtc.captureFrame(videoRef.current);
          await DriveService.uploadImage(img, `remote_${Date.now()}.jpg`);
          console.log("Remote capture uploaded to Drive");
        } catch (err) {
          console.error("Remote capture failed:", err);
        }
      }
    });
  }, [webrtc, roomId]);

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
            <span className="text-[9px] font-mono text-slate-400 italic">LINK: {roomId}</span>
          </div>
        </div>
        {!isLinked && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center space-y-4">
             <ShieldAlert className="text-rose-500 mb-2" size={32} />
             <h4 className="text-sm font-bold uppercase tracking-widest">Drive Access Required</h4>
             <p className="text-[10px] text-slate-400 max-w-xs">Remote captures cannot be saved without Google Drive verification.</p>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        <div className="p-8 bg-slate-900/40 backdrop-blur-md rounded-[2rem] border border-slate-800/80">
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.3em] mb-2">State</p>
          <p className="text-2xl font-bold text-emerald-400 italic tracking-tighter">{status}</p>
        </div>
        <div className="p-8 bg-slate-900/40 backdrop-blur-md rounded-[2rem] border border-slate-800/80">
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.3em] mb-2">Storage</p>
          <p className="text-2xl font-bold font-mono text-slate-300 tracking-tighter truncate">{isLinked ? 'DRIVE' : 'OFFLINE'}</p>
        </div>
      </div>
    </div>
  );
};

const RemoteView = ({ webrtc, roomId }: { webrtc: WebRTCService, roomId: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastCapture, setLastCapture] = useState<string | null>(null);

  useEffect(() => {
    webrtc.joinStream(roomId, (stream) => {
      if (videoRef.current) videoRef.current.srcObject = stream;
    });
  }, [webrtc, roomId]);

  const handleRemoteTrigger = () => {
    setIsCapturing(true);
    webrtc.sendTrigger({ type: 'capture' });
    setTimeout(() => {
      setIsCapturing(false);
      setLastCapture(new Date().toLocaleTimeString());
    }, 500);
  };

  return (
    <div className="space-y-12">
      <div className="relative rounded-[3rem] overflow-hidden bg-black aspect-video border border-slate-800 shadow-2xl shadow-emerald-500/5">
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
        
        <div className={`absolute inset-0 bg-white transition-opacity duration-100 pointer-events-none ${isCapturing ? 'opacity-80' : 'opacity-0'}`} />
        
        <div className="absolute bottom-10 right-10">
          <button 
            onClick={handleRemoteTrigger}
            title="Trigger Remote Capture"
            className="w-20 h-20 bg-emerald-600 text-slate-950 rounded-full flex items-center justify-center hover:bg-emerald-500 hover:scale-110 active:scale-95 transition-all shadow-2xl shadow-emerald-500/20"
          >
            <Camera size={32} />
          </button>
        </div>
        
        <div className="absolute top-10 right-10 bg-slate-900/60 backdrop-blur-md px-5 py-2.5 rounded-2xl text-[10px] font-mono text-slate-300 uppercase tracking-widest flex items-center border border-slate-800">
          <div className="w-1.5 h-1.5 bg-rose-600 rounded-full mr-3 shadow-[0_0_10px_rgba(225,29,72,0.8)] animate-pulse" />
          Remote Link: {roomId}
        </div>

        {lastCapture && (
           <div className="absolute bottom-10 left-10 p-4 bg-emerald-950/80 backdrop-blur-md border border-emerald-500/30 rounded-2xl">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Protocol Executed</span>
            <p className="text-[9px] font-mono text-slate-300 mt-1">Saved to Drive @ {lastCapture}</p>
          </div>
        )}
      </div>

      <div className="p-12 border-2 border-dashed border-slate-800 rounded-[3rem] flex flex-col items-center justify-center text-slate-700 bg-slate-900/10">
        <LinkIcon size={24} className="mb-4 opacity-20" />
        <h3 className="text-xs font-bold uppercase tracking-[0.3em] opacity-40">Direct Asset Storage</h3>
        <p className="text-[10px] mt-2 max-w-xs text-center leading-relaxed">Images captured via remote trigger are uploaded directly to the streamer's "SecureVision" folder in Google Drive.</p>
      </div>
    </div>
  );
};

// --- App Root ---

export default function App() {
  const [isStealth, setIsStealth] = useState(true);
  const [view, setView] = useState<'landing' | 'streamer' | 'controller'>('landing');
  const [secretCount, setSecretCount] = useState(0);
  const [isLinked, setIsLinked] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [roomId, setRoomId] = useState('');
  const [joinId, setJoinId] = useState('');
  const webrtc = useRef(new WebRTCService());

  useEffect(() => {
    const init = async () => {
      const status = await DriveService.getStatus();
      setIsLinked(status);
      const url = await DriveService.getAuthUrl();
      setAuthUrl(url);
    };
    init();

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setIsLinked(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnect = () => {
    if (authUrl) {
      window.open(authUrl, 'oauth_popup', 'width=600,height=700');
    }
  };

  const handleSecretTap = () => {
    setSecretCount(prev => prev + 1);
    if (secretCount >= 6) {
      setIsStealth(false);
      setSecretCount(0);
    }
    setTimeout(() => setSecretCount(0), 3000);
  };

  if (isStealth) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-200 font-sans flex flex-col items-center justify-center relative overflow-hidden select-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-900/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[120px]"></div>
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-grid-pattern"></div>

        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <DigitalClock onSecretTap={handleSecretTap} />
        </motion.div>
        
        <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end opacity-40">
           <div className="flex items-center space-x-3 bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-lg px-3 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">DRIVE SYNC ACTIVE</span>
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
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-900/10 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="fixed inset-0 pointer-events-none opacity-[0.02] bg-grid-pattern"></div>

      <nav className="h-20 border-b border-slate-800/60 backdrop-blur-2xl sticky top-0 z-50 px-8 flex items-center justify-between">
        <div className="flex items-center space-x-4 cursor-pointer group" onClick={() => setView('landing')}>
          <div className="w-11 h-11 bg-slate-900 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-500 shadow-lg shadow-emerald-500/5 transition-all group-hover:border-emerald-500/60 group-hover:shadow-emerald-500/10">
            <Shield size={22} fill="currentColor" className="opacity-80" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tighter uppercase leading-none italic text-slate-100">SecureVision</span>
            <span className="text-[10px] font-mono text-slate-500 tracking-[0.3em] uppercase mt-1">Drive & Tunnel</span>
          </div>
        </div>

        <div className="flex items-center space-x-8">
          {!isLinked ? (
            <button 
              onClick={handleConnect}
              className="px-6 py-2.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 border border-emerald-500/30 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center space-x-3"
            >
              <LogIn size={14} />
              <span>Identity Verification</span>
            </button>
          ) : (
            <div className="flex items-center space-x-3 text-emerald-500">
               <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
               <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Authenticated</span>
            </div>
          )}
          <button 
            onClick={() => setIsStealth(true)}
            className="flex items-center space-x-2 text-[10px] font-bold text-slate-500 hover:text-emerald-400 transition-colors tracking-widest"
          >
            <ClockIcon size={14} />
            <span>ENTER STEALTH</span>
          </button>
        </div>
      </nav>

      <main className="relative max-w-6xl mx-auto p-8 md:p-16">
        <AnimatePresence mode="wait">
          {view === 'landing' && (
            <motion.div key="landing" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} className="grid gap-12 lg:grid-cols-2">
              <div className="p-16 rounded-[4rem] bg-slate-900/40 backdrop-blur-md border border-slate-800/80 flex flex-col justify-between group hover:border-emerald-500/30 transition-all duration-700 min-h-[480px]">
                <div>
                  <div className="w-16 h-16 bg-slate-900/60 border border-slate-800 rounded-[2.5rem] flex items-center justify-center text-slate-400 group-hover:text-emerald-400 transition-all mb-12">
                    <Smartphone size={32} />
                  </div>
                  <h2 className="text-5xl lg:text-6xl font-bold tracking-tighter mb-6 leading-[0.9] italic text-slate-100">Node Deployment</h2>
                  <input 
                    type="text" 
                    placeholder="Enter Custom Link ID" 
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                    className="w-full bg-black/40 border border-slate-800 rounded-2xl px-6 py-4 font-mono text-sm uppercase tracking-widest focus:border-emerald-500/50 outline-none transition-colors"
                  />
                </div>
                <button 
                  disabled={!roomId}
                  onClick={() => setView('streamer')}
                  className="mt-12 h-20 bg-emerald-600 disabled:opacity-30 disabled:grayscale text-slate-950 rounded-[2rem] font-bold text-xl transition-all flex items-center justify-center space-x-4 shadow-[0_20px_50px_rgba(16,185,129,0.15)] hover:scale-[1.02]"
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
                  <input 
                    type="text" 
                    placeholder="Enter Node Link ID" 
                    value={joinId}
                    onChange={(e) => setJoinId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                    className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 font-mono text-sm uppercase tracking-widest focus:border-emerald-400 outline-none transition-colors mb-6"
                  />
                  <button 
                    disabled={!joinId}
                    onClick={() => setView('controller')}
                    className="w-full h-16 bg-slate-900 text-white rounded-2xl font-bold text-lg flex items-center justify-center space-x-3 disabled:opacity-20 hover:scale-[1.01] transition-transform"
                  >
                    <LinkIcon size={20} />
                    <span>ESTABLISH LINK</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'streamer' && (
            <motion.div key="streamer" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
              <div className="flex items-center justify-between mb-12">
                <h2 className="text-4xl font-bold tracking-tighter italic uppercase">Node Active</h2>
                <button onClick={() => setView('landing')} className="px-6 py-2 bg-slate-900 border border-slate-800 rounded-full text-[10px] font-bold uppercase tracking-widest">Detach</button>
              </div>
              <StreamerView webrtc={webrtc.current} roomId={roomId} />
            </motion.div>
          )}

          {view === 'controller' && (
            <motion.div key="controller" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
               <div className="flex items-center justify-between mb-12">
                <button onClick={() => setView('landing')} className="p-4 bg-slate-900 rounded-2xl border border-slate-800"><ChevronRight className="rotate-180" size={20} /></button>
                <h2 className="text-4xl font-bold tracking-tighter italic uppercase">Command Hub</h2>
              </div>
              <RemoteView webrtc={webrtc.current} roomId={joinId} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-32 py-16 px-8 border-t border-slate-800/60 opacity-40">
        <div className="max-w-6xl mx-auto flex justify-between items-center text-[10px] font-mono tracking-[0.5em] uppercase">
          <span>SecureVision Drive v4.0</span>
          <span>End-to-End Encrypted Handshake</span>
        </div>
      </footer>
    </div>
  );
}
