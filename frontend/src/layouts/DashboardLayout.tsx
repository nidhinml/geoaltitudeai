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
  MountainSnow,
  Fuel,
  RefreshCw,
  Navigation,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GlobalPageGuide from '../components/GlobalPageGuide';

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
  { name: '🌄 Terrain Intelligence', path: '/terrain', icon: Mountain },
  { name: '📈 Elevation Profile', path: '/elevation-profile', icon: TrendingUp },
  { name: '📐 Gradient Analysis', path: '/gradient', icon: Ruler },
  { name: '📡 Vehicle Intelligence', path: '/vehicle-intelligence', icon: Radar },
  { name: '🚍 Route Intelligence', path: '/route-intelligence', icon: Navigation },
  { name: '🌊 Flood Risk Analysis', path: '/flood-risk', icon: Droplets },
  { name: '⛰️ Landslide Risk', path: '/landslide-risk', icon: MountainSnow },
  { name: '⛽ Fuel Efficiency', path: '/fuel-efficiency', icon: Fuel },
  { name: '🔄 Model Feedback', path: '/model-feedback', icon: RefreshCw },
  { name: 'Live Prediction', path: '/live-prediction', icon: MapPin },
  { name: 'Batch Prediction', path: '/batch-prediction', icon: UploadCloud },
  { name: '🧠 Model Explainability', path: '/explainability', icon: Brain },
  { name: '📚 Learn XGBoost', path: '/learn', icon: BookOpen },
  { name: 'History', path: '/history', icon: HistoryIcon },
  { name: 'System Architecture', path: '/architecture', icon: Layers },
  { name: 'Settings', path: '/settings', icon: SettingsIcon },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const location = useLocation();

  // Profile Settings State
  const [profileName, setProfileName] = useState(() => localStorage.getItem('geo_profile_name') || 'Nidhin');
  const [visiblePages, setVisiblePages] = useState<string[]>(() => {
    const saved = localStorage.getItem('geo_visible_pages');
    return saved ? JSON.parse(saved) : sidebarItems.map(i => i.path);
  });
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activeModel, setActiveModel] = useState('-');

  useEffect(() => {
    localStorage.setItem('geo_profile_name', profileName);
  }, [profileName]);

  useEffect(() => {
    localStorage.setItem('geo_visible_pages', JSON.stringify(visiblePages));
  }, [visiblePages]);

  const togglePageVisibility = (path: string) => {
    setVisiblePages(prev => 
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  // Polling backend health status
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'}/health`);
        if (response.ok) {
          const data = await response.json();
          setBackendStatus('online');
          if (data.active_model) setActiveModel(data.active_model);
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
          {sidebarItems.filter(item => visiblePages.includes(item.path)).map((item) => {
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
                {sidebarItems.filter(item => visiblePages.includes(item.path)).map((item) => {
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
              <span className={`font-semibold ${activeModel !== '-' ? 'text-[#3b82f6]' : 'text-white'}`}>{activeModel}</span>
            </div>

            <GlobalPageGuide />

            {/* Quick Profile */}
            <button 
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-2 border border-[#1F293D] bg-[#161D30]/60 px-3 py-1.5 rounded-full hover:bg-[#1F293D] hover:border-[#374151] transition-all cursor-pointer outline-none focus:ring-2 focus:ring-[#22c55e]/50"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#22c55e] to-[#3b82f6] flex items-center justify-center text-[10px] font-bold text-black uppercase">
                {profileName.substring(0, 2)}
              </div>
              <span className="hidden md:inline text-xs font-semibold text-white">{profileName}</span>
            </button>
          </div>
        </header>

        {/* Profile Settings Modal */}
        <AnimatePresence>
          {isProfileModalOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsProfileModalOpen(false)}
                className="fixed inset-0 bg-black z-40"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                className="fixed top-20 right-6 w-[400px] max-h-[80vh] bg-[#0B0F19] border border-[#1F293D] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
              >
                <div className="p-5 border-b border-[#1F293D] flex justify-between items-center bg-gradient-to-r from-[#161D30] to-transparent">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <SettingsIcon className="w-5 h-5 text-[#3b82f6]" /> Profile & Layout Settings
                  </h3>
                  <button onClick={() => setIsProfileModalOpen(false)} className="text-[#9CA3AF] hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                  {/* Name Edit */}
                  <div>
                    <label className="block text-xs text-[#9CA3AF] font-bold uppercase tracking-wider mb-2">Display Name</label>
                    <input 
                      type="text" 
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full bg-[#161D30] border border-[#374151] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition-all"
                      placeholder="Enter your name..."
                    />
                  </div>

                  {/* Sidebar Visibility Toggle */}
                  <div>
                    <label className="block text-xs text-[#9CA3AF] font-bold uppercase tracking-wider mb-3">Sidebar Configuration</label>
                    <p className="text-xs text-[#6B7280] mb-4">Select which modules you want to display in the main sidebar.</p>
                    
                    <div className="space-y-2">
                      {sidebarItems.map((item) => {
                        const isVisible = visiblePages.includes(item.path);
                        const Icon = item.icon;
                        
                        return (
                          <label key={item.path} className="flex items-center gap-3 p-3 rounded-xl border border-[#1F293D] bg-[#161D30]/50 hover:bg-[#1F293D] cursor-pointer transition-colors group">
                            <input 
                              type="checkbox" 
                              checked={isVisible}
                              onChange={() => togglePageVisibility(item.path)}
                              className="w-4 h-4 rounded bg-[#080B11] border-[#374151] text-[#22c55e] focus:ring-0 focus:ring-offset-0 transition-colors"
                            />
                            <div className="flex items-center gap-3 flex-1">
                              <div className={`p-1.5 rounded-lg ${isVisible ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-gray-800 text-gray-500'} transition-colors`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <span className={`text-sm ${isVisible ? 'text-white' : 'text-[#6B7280] line-through'} transition-colors`}>{item.name}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
                
                <div className="p-4 border-t border-[#1F293D] bg-[#161D30]/80">
                  <button 
                    onClick={() => setIsProfileModalOpen(false)}
                    className="w-full py-2.5 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

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
