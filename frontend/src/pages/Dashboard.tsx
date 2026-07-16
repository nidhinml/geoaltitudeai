import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Map, Database, Cpu, CheckCircle, Clock, Server, 
  Activity, MapPin, Truck, Mountain, Navigation, Target, HardDrive
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api');

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

const CountUp = ({ end, suffix = "", duration = 2 }: any) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const increment = end / (duration * 60);
    const handle = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(handle);
      } else {
        setCount(start);
      }
    }, 1000 / 60);
    return () => clearInterval(handle);
  }, [end, duration]);
  
  return <span>{Math.floor(count).toLocaleString()}{suffix}</span>;
};

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({ 
    queryKey: ['dashboardStats'], 
    queryFn: () => fetch(`${API_BASE}/dashboard/stats`).then(r => r.ok ? r.json() : null).catch(() => null),
    refetchInterval: 5000 // refresh every 5s for live effect
  });

  if (isLoading) {
    return <div className="h-full flex items-center justify-center"><Activity className="w-12 h-12 text-[#22c55e] animate-spin" /></div>;
  }

  if (!stats) {
    return <div className="p-10 text-red-400 text-center font-bold">Failed to load Dashboard Statistics. Backend may be offline.</div>;
  }

  const { dataset, model, altitudes, terrain_distribution, active_vehicles, total_predictions, heatmap, recent_activity } = stats;

  const terrainData = [
    { name: 'Flat', value: terrain_distribution?.Flat || 0 },
    { name: 'Hilly', value: terrain_distribution?.Hilly || 0 },
    { name: 'Mountainous', value: terrain_distribution?.Mountainous || 0 },
  ];

  const hasTerrainData = terrainData.some(d => d.value > 0);
  const pieData = hasTerrainData ? terrainData : [{ name: 'No Data', value: 1 }];

  return (
    <div className="space-y-6 pb-10">
      
      {/* 1. Hero / Header Section */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl glass-panel p-6 sm:p-8 border border-[#1F293D] flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[#0B0F19]"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-tr from-[#22c55e]/10 via-[#3b82f6]/5 to-transparent rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-[#f97316]/10 to-transparent rounded-full blur-3xl -z-10" />
        
        <div className="space-y-2 z-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tight">GeoAltitude AI Hub</h1>
          <p className="text-[#9CA3AF] max-w-2xl text-sm leading-relaxed">
            Advanced geospatial intelligence platform. Fusing satellite topography with XGBoost machine learning to deliver real-time terrain predictions and vehicle intelligence routing.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 z-10">
          <Link to="/live-prediction" className="px-5 py-2.5 bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.5)] hover:shadow-[0_0_25px_rgba(59,130,246,0.7)] transition-all flex items-center gap-2 text-sm">
            <Target className="w-4 h-4" /> Launch Predictor
          </Link>
          <Link to="/vehicle-intelligence" className="px-5 py-2.5 bg-[#161D30] hover:bg-[#1F293D] border border-[#374151] text-white font-bold rounded-xl transition-all flex items-center gap-2 text-sm">
            <Truck className="w-4 h-4 text-[#f97316]" /> Fleet Intelligence
          </Link>
        </div>
      </motion.div>

      {/* 2. Primary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Training Dataset', val: dataset?.total_records || dataset?.rows || 0, label: 'samples', icon: Database, c: 'text-[#3b82f6]', bg: 'bg-[#3b82f6]/10' },
          { title: 'Model Status', val: model?.is_trained ? 'Active' : 'Offline', label: model?.is_trained ? `R² ${model.r2_score}` : 'Needs Training', icon: Cpu, c: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10', isText: true },
          { title: 'Active Vehicles', val: active_vehicles || 0, label: 'telemetry streams', icon: Navigation, c: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
          { title: 'Total Predictions', val: total_predictions || 0, label: 'processed requests', icon: Activity, c: 'text-[#8b5cf6]', bg: 'bg-[#8b5cf6]/10' }
        ].map((k, i) => (
          <motion.div 
            key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: i * 0.1 }}
            className="glass-panel p-5 rounded-xl border border-[#1F293D] bg-[#0B0F19] hover:bg-[#0F1423] transition-colors group relative overflow-hidden"
          >
            <div className={`absolute -right-4 -top-4 w-24 h-24 ${k.bg} rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity`} />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-widest mb-1">{k.title}</p>
                <div className="text-2xl font-black text-white">
                  {k.isText ? k.val : <CountUp end={Number(k.val)} />}
                </div>
                <p className="text-xs text-[#6B7280] font-mono mt-1">{k.label}</p>
              </div>
              <div className={`p-2 rounded-lg ${k.bg} ${k.c} border border-[#1F293D]`}>
                <k.icon className="w-5 h-5" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* 3. Middle Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Terrain Distribution (Donut Chart) */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} className="lg:col-span-1 glass-panel p-6 rounded-xl border border-[#1F293D] bg-[#0B0F19]">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4"><Mountain className="w-4 h-4 text-[#22c55e]" /> Terrain Classification</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none">
                  {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={hasTerrainData ? COLORS[index % COLORS.length] : '#374151'} />)}
                </Pie>
                <RechartsTooltip contentStyle={{ backgroundColor: '#0B0F19', border: '1px solid #1F293D', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between items-center mt-2 px-2">
            {pieData.map((entry, idx) => (
              <div key={idx} className="text-center">
                <div className="flex items-center gap-1 justify-center mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: hasTerrainData ? COLORS[idx] : '#374151' }} />
                  <span className="text-[10px] text-[#9CA3AF] uppercase">{entry.name}</span>
                </div>
                <span className="text-sm font-bold text-white">{entry.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Altitude Extremes */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="lg:col-span-2 glass-panel p-6 rounded-xl border border-[#1F293D] bg-[#0B0F19] flex flex-col justify-between relative overflow-hidden">
           <div className="absolute right-0 bottom-0 w-64 h-64 bg-gradient-to-tl from-[#f59e0b]/10 to-transparent blur-3xl pointer-events-none" />
           <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-6"><TrendingUp className="w-4 h-4 text-[#f59e0b]" /> Geospatial Altitude Extremes</h3>
           <div className="grid grid-cols-3 gap-4 flex-1">
              {[
                { l: 'Highest Peak', v: altitudes?.highest || 0, d: 'Maximum elevation recorded', c: 'text-[#ef4444]' },
                { l: 'Average Altitude', v: altitudes?.average || 0, d: 'Mean topological height', c: 'text-[#3b82f6]' },
                { l: 'Lowest Point', v: altitudes?.lowest || 0, d: 'Minimum elevation recorded', c: 'text-[#22c55e]' }
              ].map(a => (
                <div key={a.l} className="bg-[#161D30] rounded-xl border border-[#1F293D] p-4 flex flex-col justify-center relative group">
                  <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
                  <span className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider">{a.l}</span>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className={`text-3xl font-black ${a.c}`}><CountUp end={a.v} /></span>
                    <span className="text-sm text-[#6B7280]">m</span>
                  </div>
                  <span className="text-[10px] text-[#6B7280] mt-2 leading-tight">{a.d}</span>
                </div>
              ))}
           </div>
        </motion.div>
      </div>

      {/* 4. Full Width Map & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Interactive Prediction/Coverage Map */}
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7 }} className="lg:col-span-2 glass-panel p-1 rounded-xl border border-[#1F293D] h-[400px] relative overflow-hidden bg-[#0B0F19]">
           <div className="absolute top-4 left-4 z-[400] bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg flex items-center gap-2 pointer-events-none">
             <MapPin className="w-4 h-4 text-[#f59e0b]" />
             <span className="text-xs font-bold text-white">Training Coverage Heatmap</span>
           </div>
           {heatmap && heatmap.length > 0 ? (
             <MapContainer center={[10.8505, 76.2711]} zoom={6.5} className="w-full h-full rounded-lg z-0" zoomControl={false}>
               <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="&copy; CartoDB" />
               {heatmap.map((pt: any, i: number) => (
                 <CircleMarker key={i} center={[pt[0], pt[1]]} radius={4} pathOptions={{ color: '#f59e0b', stroke: false, fillOpacity: 0.4 }} />
               ))}
             </MapContainer>
           ) : (
             <div className="w-full h-full flex flex-col items-center justify-center bg-[#161D30] rounded-lg">
               <Map className="w-10 h-10 text-[#475569] mb-2" />
               <p className="text-sm text-[#9CA3AF]">No coverage data available</p>
             </div>
           )}
        </motion.div>

        {/* Vercel-style Recent Predictions List */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }} className="lg:col-span-1 glass-panel border border-[#1F293D] rounded-xl bg-[#0B0F19] overflow-hidden flex flex-col h-[400px]">
          <div className="p-4 border-b border-[#1F293D] bg-[#161D30]/50 flex justify-between items-center">
            <h3 className="text-sm font-bold text-white flex items-center gap-2"><Server className="w-4 h-4 text-[#3b82f6]" /> Live Inference Stream</h3>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]"></span>
            </span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {recent_activity && recent_activity.length > 0 ? (
              <div className="space-y-2">
                {recent_activity.map((log: any, idx: number) => (
                  <div key={idx} className="p-3 bg-[#161D30] hover:bg-[#1e293b] rounded-lg border border-[#1F293D] transition-colors group cursor-default">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-1.5 text-xs text-[#9CA3AF]">
                        <HardDrive className="w-3 h-3 text-[#3b82f6]" /> POST /predict/live
                      </div>
                      <span className="text-[9px] text-[#6B7280] font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex justify-between items-end mt-2">
                      <div className="text-[10px] text-[#9CA3AF] font-mono">
                        {log.latitude?.toFixed(4)}, {log.longitude?.toFixed(4)}
                      </div>
                      <div className="text-sm font-bold text-[#22c55e] bg-[#22c55e]/10 px-2 py-0.5 rounded border border-[#22c55e]/20">
                        {log.predicted_altitude?.toFixed(2)}m
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#6B7280]">Waiting for prediction telemetry...</div>
            )}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
