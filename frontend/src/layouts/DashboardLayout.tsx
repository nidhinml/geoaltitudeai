import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Database, 
  Eraser, 
  BarChart3, 
  Cpu, 
  Play, 
  LineChart, 
  MapPin, 
  UploadCloud, 
  History as HistoryIcon, 
  Settings as SettingsIcon,
  Menu,
  X,
  Activity,
  Map,
  Compass,
  Brain,
  BookOpen,
  Mountain,
  TrendingUp,
  Ruler,
  Radar,
  Droplets,
  MountainSnow
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const sidebarItems: SidebarItem[] = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Dataset', path: '/dataset', icon: Database },
  { name: 'Data Cleaning', path: '/data-cleaning', icon: Eraser },
  { name: 'Exploratory Analysis', path: '/analysis', icon: BarChart3 },
  { name: 'Feature Engineering', path: '/features', icon: Cpu },
  { name: 'Train Model', path: '/train', icon: Play },
  { name: 'Model Evaluation', path: '/evaluation', icon: LineChart },
  { name: '🧠 Model Explainability', path: '/explainability', icon: Brain },
  { name: '📚 Learn XGBoost', path: '/learn', icon: BookOpen },
  { name: '🌄 Terrain Intelligence', path: '/terrain', icon: Mountain },
  { name: '📈 Elevation Profile', path: '/elevation-profile', icon: TrendingUp },
  { name: '📐 Gradient Analysis', path: '/gradient', icon: Ruler },
  { name: '📡 Vehicle Intelligence', path: '/vehicle-intelligence', icon: Radar },
  { name: '🌊 Flood Risk Analysis', path: '/flood-risk', icon: Droplets },
  { name: '⛰️ Landslide Risk', path: '/landslide-risk', icon: MountainSnow },
  { name: 'Live Prediction', path: '/live-prediction', icon: MapPin },
  { name: 'Batch Prediction', path: '/batch-prediction', icon: UploadCloud },
  { name: 'History', path: '/history', icon: HistoryIcon },
  { name: 'Settings', path: '/settings', icon: SettingsIcon },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const location = useLocation();

  // Polling backend health status
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'}/health`);
        if (response.ok) {
          setBackendStatus('online');
        } else {
          setBackendStatus('offline');
        }
      } catch (err) {
        setBackendStatus('offline');
      }
    };
    
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const getPageTitle = () => {
    const item = sidebarItems.find(i => i.path === location.pathname);
    return item ? item.name : 'GeoAltitude AI';
  };

  return (
    <div className="flex h-screen bg-[#080B11] text-[#F3F4F6] font-sans overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-72 glass-panel border-r border-[#1F293D] h-full z-20">
        {/* Logo and Branding */}
        <div className="p-6 border-b border-[#1F293D] flex items-center gap-3">
          <div className="p-2 bg-[#22c55e]/15 border border-[#22c55e]/30 rounded-xl text-[#22c55e] animate-pulse-slow">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-wider text-white">GEOALTITUDE</h1>
            <span className="text-[10px] uppercase tracking-widest text-[#22c55e] font-semibold">Terrain Elevation AI</span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5 scrollbar-thin">
          {sidebarItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all relative group ${
                  isActive 
                    ? 'text-white font-semibold' 
                    : 'text-[#9CA3AF] hover:text-white hover:bg-white/5'
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeNavIndicator"
                    className="absolute inset-0 bg-gradient-to-r from-[#22c55e]/15 to-[#3b82f6]/5 border-l-2 border-[#22c55e] rounded-xl z-0"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <span className={`relative z-10 ${isActive ? 'text-[#22c55e]' : 'group-hover:text-[#22c55e]'} transition-colors`}>
                  <Icon className="w-5 h-5" />
                </span>
                <span className="relative z-10 text-[14px]">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer / Connection Status */}
        <div className="p-4 border-t border-[#1F293D] bg-black/20 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
            <span>API Connection:</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${
                backendStatus === 'online' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' :
                backendStatus === 'offline' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' :
                'bg-yellow-500 animate-pulse'
              }`} />
              <span className={`font-semibold capitalize ${
                backendStatus === 'online' ? 'text-green-400' :
                backendStatus === 'offline' ? 'text-red-400' :
                'text-yellow-400'
              }`}>
                {backendStatus}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-center text-[#9CA3AF]/60 mt-1">
            GeoAltitude AI v1.0.0
          </div>
        </div>
      </aside>

      {/* Sidebar - Mobile drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="lg:hidden fixed inset-0 bg-black z-30"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              className="lg:hidden fixed inset-y-0 left-0 w-72 bg-[#0B0F19] border-r border-[#1F293D] z-40 flex flex-col h-full"
            >
              <div className="p-6 border-b border-[#1F293D] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#22c55e]/15 border border-[#22c55e]/30 rounded-xl text-[#22c55e]">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className="font-extrabold text-md tracking-wider text-white">GEOALTITUDE</h1>
                  </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded-lg">
                  <X className="w-5 h-5 text-[#9CA3AF]" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5">
                {sidebarItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all relative ${
                        isActive 
                          ? 'text-white font-semibold' 
                          : 'text-[#9CA3AF] hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {isActive && (
                        <div className="absolute inset-0 bg-gradient-to-r from-[#22c55e]/15 to-[#3b82f6]/5 border-l-2 border-[#22c55e] rounded-xl z-0" />
                      )}
                      <span className={`relative z-10 ${isActive ? 'text-[#22c55e]' : ''}`}>
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="relative z-10 text-[14px]">{item.name}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-[#1F293D] bg-black/20">
                <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
                  <span>API Connection:</span>
                  <span className="font-semibold text-green-400 capitalize">{backendStatus}</span>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content body */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-[#1F293D] bg-[#0B0F19]/40 backdrop-blur-md px-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsOpen(true)}
              className="lg:hidden p-2 text-[#9CA3AF] hover:text-white hover:bg-white/5 rounded-xl border border-[#1F293D]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold tracking-tight text-white">{getPageTitle()}</h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Model Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#1E293B] border border-[#334155] rounded-full text-xs">
              <Activity className="w-3.5 h-3.5 text-[#22c55e]" />
              <span className="text-[#9CA3AF]">Active Model:</span>
              <span className="font-semibold text-white">-</span>
            </div>

            {/* Quick Profile */}
            <div className="flex items-center gap-2 border border-[#1F293D] bg-[#161D30]/60 px-3 py-1.5 rounded-full">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#22c55e] to-[#3b82f6] flex items-center justify-center text-[10px] font-bold text-black uppercase">
                ME
              </div>
              <span className="hidden md:inline text-xs font-semibold text-white">ML Engineer</span>
            </div>
          </div>
        </header>

        {/* Viewport for subpages */}
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="h-full max-w-7xl mx-auto"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
