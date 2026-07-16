import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  AreaChart, Area, ComposedChart, Bar, PieChart, Pie, Cell 
} from 'recharts';
import { Fuel, Mountain, Zap, Ruler, TrendingUp, TrendingDown, ArrowRight, Table as TableIcon, Activity, Search, Plus, X, Navigation, Eye, EyeOff, Map as MapIcon, Info } from 'lucide-react';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

interface GPSPoint {
  latitude: number;
  longitude: number;
}

interface RouteAnalysis {
  latitude: number;
  longitude: number;
  altitude: number;
  prev_altitude: number;
  alt_diff: number;
  distance_m: number;
  gradient_pct: number;
  category: string;
  fuel_impact: number;
  difficulty: number;
}

interface Summary {
  total_distance_m: number;
  total_elevation_gain: number;
  total_elevation_loss: number;
  max_gradient: number;
  avg_gradient: number;
  max_climb: number;
  max_descent: number;
  avg_fuel_impact: number;
}

interface FuelResponse {
  route_analysis: RouteAnalysis[];
  summary: Summary;
}

// Helper to recenter map
function MapUpdater({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      map.fitBounds(points);
    }
  }, [points, map]);
  return null;
}

const COLORS = {
  'Flat Road': '#22c55e',       // Green
  'Gentle Uphill': '#eab308',   // Yellow
  'Moderate Uphill': '#f59e0b', // Orange
  'Steep Uphill': '#ef4444',    // Red
  'Gentle Downhill': '#3b82f6', // Blue
  'Steep Downhill': '#1d4ed8',  // Dark Blue
};

export default function FuelEfficiencyAnalysis() {
  const [data, setData] = useState<FuelResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'map' | 'data'>('map');
  const [searchLocations, setSearchLocations] = useState<string[]>(['', '']);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showMapTutorial, setShowMapTutorial] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [keralaGeoJSON, setKeralaGeoJSON] = useState<any>(null);

  useEffect(() => {
    fetch('/kerala.geojson')
      .then(res => res.json())
      .then(data => setKeralaGeoJSON(data))
      .catch(err => console.error("Error loading Kerala bounds", err));
  }, []);

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  const forwardGeocode = async (query: string) => {
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&format=json`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.results && data.results.length > 0) {
          return { lat: data.results[0].latitude, lon: data.results[0].longitude };
        }
      }
    } catch (e) {
      console.warn("Forward geocoding error", e);
    }
    return null;
  };

  const handleRouteSearch = async () => {
    const validLocs = searchLocations.filter(loc => loc.trim() !== '');
    if (validLocs.length < 2) return alert("Please enter at least a start and end location to analyze.");
    setIsLoading(true);
    setError(null);
    
    let pts: {lat: number, lon: number}[] = [];
    
    for (let i = 0; i < validLocs.length; i++) {
      if (i > 0) await delay(1000);
      const loc = validLocs[i];
      const pt = await forwardGeocode(loc);
      if (!pt) {
        setIsLoading(false);
        return alert(`Could not find coordinates for: ${loc}`);
      }
      if (keralaGeoJSON) {
        const isInside = keralaGeoJSON.features.some((feature: any) => booleanPointInPolygon(point([pt.lon, pt.lat]), feature));
        if (!isInside) {
          setIsLoading(false);
          return alert(`Location "${loc}" is outside the trained region.`);
        }
      }
      pts.push(pt);
    }
    
    try {
      const coordsString = pts.map(p => `${p.lon},${p.lat}`).join(';');
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`);
      if (res.ok) {
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const coords = data.routes[0].geometry.coordinates;
          const newRoute = coords.map((c: number[]) => ({ latitude: c[1], longitude: c[0] }));
          await loadEstimate(newRoute);
        }
      }
    } catch (e) {
      alert("Failed to generate route.");
    }
    setIsLoading(false);
  };

  const loadEstimate = async (route: GPSPoint[]) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/fuel/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to fetch fuel estimate');
      }
      
      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const terrainData = useMemo(() => {
    if (!data) return [];
    const counts: Record<string, number> = {};
    data.route_analysis.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [data]);

  const chartData = useMemo(() => {
    if (!data) return [];
    let cumDist = 0;
    return data.route_analysis.map((p, i) => {
      cumDist += p.distance_m;
      return {
        point: i,
        distance: (cumDist / 1000).toFixed(2), // km
        altitude: p.altitude,
        gradient: p.gradient_pct,
        fuel: p.fuel_impact,
        category: p.category
      };
    });
  }, [data]);

  const getPolylineColor = (gradient: number) => {
    if (gradient > 8) return COLORS['Steep Uphill'];
    if (gradient > 3) return COLORS['Moderate Uphill'];
    if (gradient > 1) return COLORS['Gentle Uphill'];
    if (gradient < -8) return COLORS['Steep Downhill'];
    if (gradient < -3) return COLORS['Gentle Downhill'];
    return COLORS['Flat Road'];
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start lg:items-center flex-col lg:flex-row gap-4">
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Fuel className="w-8 h-8 text-[#22c55e]" />
              Fuel Efficiency Analysis
            </h1>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowUserGuide(!showUserGuide)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#1F293D] hover:bg-[#374151] text-[#9CA3AF] hover:text-white text-xs font-bold rounded-lg border border-white/10 transition-colors"
              >
                <Info className="w-4 h-4" />
                {showUserGuide ? 'Hide Guide' : 'User Guide'}
              </button>
              <button 
                onClick={() => setShowMapTutorial(!showMapTutorial)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#1F293D] hover:bg-[#374151] text-[#9CA3AF] hover:text-white text-xs font-bold rounded-lg border border-white/10 transition-colors"
              >
                {showMapTutorial ? <EyeOff className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
                {showMapTutorial ? 'Hide Routing' : 'Routing Tech'}
              </button>
              <button 
                onClick={() => setShowTutorial(!showTutorial)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#1F293D] hover:bg-[#374151] text-[#9CA3AF] hover:text-white text-xs font-bold rounded-lg border border-white/10 transition-colors"
              >
                {showTutorial ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showTutorial ? 'Hide AI Math' : 'How AI Works'}
              </button>
            </div>
          </div>
          <p className="text-[#9CA3AF] mt-2 max-w-3xl">
            Estimates how topographical variations affect vehicle fuel consumption and EV battery drain using the XGBoost altitude model.
          </p>
        </div>
        
        <div className="flex flex-col gap-2 bg-[#1F293D] p-3 rounded-xl border border-white/10 shadow-lg min-w-[320px] w-full lg:w-auto">
          {searchLocations.map((loc, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="w-6 flex justify-center">
                {idx === 0 ? <Navigation className="w-4 h-4 text-[#22c55e]" /> : <Navigation className="w-4 h-4 text-rose-500" />}
              </div>
              <input
                type="text"
                placeholder={idx === 0 ? "Start Location (e.g. Kochi)" : idx === searchLocations.length - 1 ? "End Location (e.g. Munnar)" : "Stopover..."}
                className="bg-black/50 border border-[#374151] rounded text-white px-3 py-1.5 text-sm w-full focus:border-[#22c55e] outline-none"
                value={loc}
                onChange={(e) => {
                  const newLocs = [...searchLocations];
                  newLocs[idx] = e.target.value;
                  setSearchLocations(newLocs);
                }}
              />
              {idx > 1 && (
                <button onClick={() => {
                  const newLocs = [...searchLocations];
                  newLocs.splice(idx, 1);
                  setSearchLocations(newLocs);
                }} className="text-gray-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <div className="flex justify-between items-center mt-2 pl-8">
            <button
              onClick={() => setSearchLocations([...searchLocations, ''])}
              className="text-xs flex items-center gap-1 text-[#22c55e] hover:text-[#1ea34d]"
            >
              <Plus className="w-3 h-3" /> Add Stop
            </button>
            <button
              onClick={handleRouteSearch}
              disabled={isLoading}
              className="bg-[#22c55e] hover:bg-[#1ea34d] text-black font-bold py-1.5 px-4 rounded-md text-sm flex items-center gap-2 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Processing...' : <><Search className="w-4 h-4" /> Analyze Terrain</>}
            </button>
          </div>
        </div>
      </div>

      {/* USER GUIDE */}
      {showUserGuide && (
      <div className="glass-panel p-5 rounded-2xl border border-[#1F293D] mb-6 bg-[#0B0F19]">
        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
          <Info className="w-4 h-4 text-[#22c55e]" /> How to Use This Page
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-[#9CA3AF]">
          <li><strong>Define a Route:</strong> Use the Route Builder on the map to enter a Start and End location, or click directly on the map to set waypoints.</li>
          <li><strong>Select Vehicle Parameters:</strong> Under the Fuel Analysis Configuration, set the Vehicle Mass (weight) and Base Efficiency (e.g. baseline MPG on flat ground).</li>
          <li><strong>Analyze:</strong> Click the <strong className="text-[#22c55e]">Calculate Fuel Efficiency</strong> button below the map.</li>
          <li><strong>Review Report:</strong> The system will process the route segment by segment, identifying zones of high fuel burn (steep climbs) and regenerative braking opportunities (steep descents).</li>
        </ol>
      </div>
      )}

      {/* MAP & ROUTING ARCHITECTURE */}
      {showMapTutorial && (
      <div className="glass-panel p-5 rounded-2xl border border-[#1F293D] mb-6 bg-[#0B0F19]">
        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
          <MapIcon className="w-4 h-4 text-[#3b82f6]" /> Map & Routing Architecture
        </h3>
        <div className="flex flex-col xl:flex-row gap-6 items-center">
          {/* Diagram */}
          <div className="w-full xl:w-1/3 bg-[#161D30] rounded-xl border border-[#1F293D] p-4 flex items-center justify-center relative overflow-hidden h-32">
            <svg viewBox="0 0 200 100" className="w-full h-full">
              <rect x="20" y="20" width="40" height="60" rx="4" fill="#1F293D" stroke="#3b82f6" strokeWidth="2" />
              <text x="40" y="52" fill="white" fontSize="10" textAnchor="middle" fontWeight="bold">OSRM</text>
              
              <motion.line 
                x1="65" y1="50" x2="135" y2="50" stroke="#22c55e" strokeWidth="2" strokeDasharray="4 4"
                animate={{ strokeDashoffset: [0, -20] }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              
              <rect x="140" y="20" width="40" height="60" rx="4" fill="#1F293D" stroke="#f97316" strokeWidth="2" />
              <text x="160" y="47" fill="white" fontSize="10" textAnchor="middle" fontWeight="bold">XGBoost</text>
              <text x="160" y="60" fill="#f97316" fontSize="8" textAnchor="middle">AI API</text>
            </svg>
          </div>
          
          <div className="w-full xl:w-2/3 space-y-3">
             <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
               <strong className="text-white">Mapping Engine:</strong> We use <strong className="text-[#3b82f6]">React-Leaflet</strong> over OpenStreetMap tiles for lightweight, open-source GIS rendering. 
             </p>
             <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
               <strong className="text-white">Routing API:</strong> When you enter a Start/End location, the app pings the <strong className="text-[#3b82f6]">OSRM (Open Source Routing Machine) API</strong>. OSRM calculates the fastest driving route and returns an encoded polyline of Lat/Lon coordinates.
             </p>
             <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
               <strong className="text-white">Data Pipeline:</strong> We sample points along this OSRM route and stream them to our Python FastAPI backend. The <strong className="text-[#f97316]">XGBoost Model</strong> predicts the altitude for each point, allowing the frontend to calculate the physics required for Fuel Economy.
             </p>
          </div>
        </div>
      </div>
      )}

      {/* HOW IT WORKS (LAYMAN'S GUIDE) */}
      {showTutorial && (
      <div className="glass-panel p-5 rounded-2xl border border-[#1F293D] mb-6 bg-[#0B0F19]">
        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
          <Fuel className="w-4 h-4 text-[#22c55e]" /> How it Works (AI & Physics Model)
        </h3>
        
        <div className="flex flex-col md:flex-row gap-6 items-center">
          {/* Animated SVG Pictorial */}
          <div className="w-full md:w-1/3 bg-[#161D30] rounded-xl border border-[#1F293D] p-4 flex items-center justify-center relative overflow-hidden h-32">
            <svg viewBox="0 0 200 100" className="w-full h-full">
              {/* Uphill */}
              <path d="M 20 80 L 80 40" stroke="#ef4444" strokeWidth="3" fill="none" />
              <motion.g animate={{ x: [0, 60], y: [0, -40] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                <circle cx="20" cy="80" r="4" fill="white" />
                <rect x="0" y="70" width="10" height="20" fill="#ef4444" rx="2" transform="rotate(-33 20 80)" />
              </motion.g>
              {/* Downhill */}
              <path d="M 120 40 L 180 80" stroke="#22c55e" strokeWidth="3" fill="none" />
              <motion.g animate={{ x: [0, 60], y: [0, 40] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                <circle cx="120" cy="40" r="4" fill="white" />
                <rect x="110" y="30" width="10" height="20" fill="#22c55e" rx="2" transform="rotate(33 120 40)" />
              </motion.g>
              <text x="30" y="30" fill="#ef4444" fontSize="10" fontWeight="bold">Uphill: Fuel Drain</text>
              <text x="110" y="95" fill="#22c55e" fontSize="10" fontWeight="bold">Downhill: Coasting (Save)</text>
            </svg>
          </div>
          
          <div className="w-full md:w-2/3 space-y-3">
             <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
               <strong className="text-white">The Math (Gravitational Potential Energy):</strong> Driving on a flat road only requires energy to overcome air resistance and friction. But driving uphill forces the engine to fight gravity, multiplying fuel consumption based on the physical work equation:
             </p>
             <div className="bg-[#161D30] p-2 rounded border border-[#1F293D] font-mono text-[10px] text-[#22c55e] space-y-1">
               <p>Work (W) = m × g × Δh</p>
               <p className="text-[#9CA3AF]">m = vehicle mass, g = gravity, Δh = XGBoost Altitude Difference</p>
               <p className="text-[#f97316]">Fuel Impact ∝ W + (Rolling Resistance × Distance)</p>
             </div>
             <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
               <strong className="text-white">Why we take it:</strong> By taking the Altitude predictions from our XGBoost model, we can calculate the exact Kinetic and Potential Energy required to climb any road in the world. Logistics companies use this to predict exactly how much extra fuel a mountain route requires compared to a flat highway.
             </p>
          </div>
        </div>
      </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
          {error}
        </div>
      )}

      {data && !isLoading && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Top KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-panel p-5 rounded-xl border border-[#1F293D] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-20">
                <Mountain className="w-16 h-16 text-[#22c55e]" />
              </div>
              <span className="text-xs font-bold text-[#9CA3AF] uppercase">Elevation Gain</span>
              <div className="mt-2 flex items-end gap-2">
                <h3 className="text-3xl font-bold text-white">+{data.summary.total_elevation_gain.toFixed(0)}</h3>
                <span className="text-[#9CA3AF] mb-1">m</span>
              </div>
            </div>
            
            <div className="glass-panel p-5 rounded-xl border border-[#1F293D] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-20">
                <Ruler className="w-16 h-16 text-rose-500" />
              </div>
              <span className="text-xs font-bold text-[#9CA3AF] uppercase">Max Gradient</span>
              <div className="mt-2 flex items-end gap-2">
                <h3 className="text-3xl font-bold text-white">{data.summary.max_gradient.toFixed(1)}</h3>
                <span className="text-[#9CA3AF] mb-1">%</span>
              </div>
            </div>

            <div className="glass-panel p-5 rounded-xl border border-rose-500/30 bg-rose-500/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-20">
                <Fuel className="w-16 h-16 text-rose-500" />
              </div>
              <span className="text-xs font-bold text-rose-400 uppercase">Fuel Loss %</span>
              <div className="mt-2 flex items-end gap-2">
                <h3 className="text-3xl font-bold text-rose-400">+{data.summary.avg_fuel_impact.toFixed(1)}</h3>
                <span className="text-rose-500/70 mb-1">%</span>
              </div>
              <p className="text-[10px] text-rose-500/70 mt-1">Fuel loss due to terrain</p>
            </div>

            <div className="glass-panel p-5 rounded-xl border border-blue-500/30 bg-blue-500/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-20">
                <Zap className="w-16 h-16 text-blue-500" />
              </div>
              <span className="text-xs font-bold text-blue-400 uppercase">EV Regen Potential</span>
              <div className="mt-2 flex items-end gap-2">
                <h3 className="text-3xl font-bold text-blue-400">
                  {Math.abs(data.summary.total_elevation_loss).toFixed(0)}
                </h3>
                <span className="text-blue-500/70 mb-1">m</span>
              </div>
              <p className="text-[10px] text-blue-500/70 mt-1">Descent available for regen</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column - Map and Terrain Dist */}
            <div className="lg:col-span-1 space-y-6">
              <div className="glass-panel p-4 rounded-xl border border-[#1F293D] h-[400px] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-white text-sm">Gradient-Aware Route</h3>
                </div>
                <div className="flex-1 rounded-lg overflow-hidden border border-[#1F293D] relative z-0">
                  <MapContainer 
                    center={[data.route_analysis[0].latitude, data.route_analysis[0].longitude]} 
                    zoom={15} 
                    style={{ height: '100%', width: '100%', background: '#0a0a0a' }}
                    zoomControl={false}
                  >
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                      attribution='&copy; CARTO'
                    />
                    <MapUpdater points={data.route_analysis.map(p => [p.latitude, p.longitude])} />
                    
                    {/* Render segments individually to color them by gradient */}
                    {data.route_analysis.slice(1).map((p, i) => (
                      <Polyline 
                        key={i}
                        positions={[
                          [data.route_analysis[i].latitude, data.route_analysis[i].longitude],
                          [p.latitude, p.longitude]
                        ]}
                        pathOptions={{ 
                          color: getPolylineColor(p.gradient_pct), 
                          weight: 5, 
                          opacity: 0.8 
                        }}
                      />
                    ))}
                  </MapContainer>
                </div>
              </div>

              <div className="glass-panel p-4 rounded-xl border border-[#1F293D] h-[300px]">
                <h3 className="font-bold text-white text-sm mb-4">Terrain Category Distribution</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={terrainData}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {terrainData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || '#8884d8'} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#1F293D', color: '#fff', fontSize: '12px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right Column - Charts and Grid */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Altitude Profile */}
              <div className="glass-panel p-4 rounded-xl border border-[#1F293D] h-[300px]">
                <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#22c55e]" /> Predicted Altitude Profile
                </h3>
                <ResponsiveContainer width="100%" height="80%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="altGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" vertical={false} />
                    <XAxis dataKey="distance" stroke="#4B5563" fontSize={10} tickFormatter={(val) => `${val}km`} />
                    <YAxis stroke="#4B5563" fontSize={10} domain={['auto', 'auto']} tickFormatter={(val) => `${val}m`} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#1F293D', fontSize: '12px' }}
                      labelStyle={{ color: '#9CA3AF' }}
                    />
                    <Area type="monotone" dataKey="altitude" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#altGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="glass-panel p-4 rounded-xl border border-[#1F293D] h-[300px]">
                <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-rose-500" /> Fuel Loss & Road Gradient
                </h3>
                <ResponsiveContainer width="100%" height="80%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" vertical={false} />
                    <XAxis dataKey="distance" stroke="#4B5563" fontSize={10} />
                    <YAxis yAxisId="left" stroke="#4B5563" fontSize={10} tickFormatter={(val) => `${val}%`} />
                    <YAxis yAxisId="right" orientation="right" stroke="#rose-500" fontSize={10} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#1F293D', fontSize: '12px' }}
                    />
                    <Bar yAxisId="left" dataKey="gradient" fill="#3b82f6" opacity={0.6} radius={[2, 2, 0, 0]} name="Gradient (%)" />
                    <Line yAxisId="right" type="step" dataKey="fuel" stroke="#f43f5e" strokeWidth={2} dot={false} name="Fuel Loss %" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

            </div>
          </div>
          
          {/* Detailed GPS Data Grid */}
          <div className="glass-panel p-4 rounded-xl border border-[#1F293D]">
            <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-[#9CA3AF]" /> Route Telemetry Stream
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#161D30]/80 sticky top-0">
                  <tr>
                    <th className="p-3 text-[#9CA3AF] uppercase font-bold border-b border-[#1F293D]">Distance</th>
                    <th className="p-3 text-[#9CA3AF] uppercase font-bold border-b border-[#1F293D]">Altitude</th>
                    <th className="p-3 text-[#9CA3AF] uppercase font-bold border-b border-[#1F293D]">Gradient</th>
                    <th className="p-3 text-[#9CA3AF] uppercase font-bold border-b border-[#1F293D]">Category</th>
                    <th className="p-3 text-[#9CA3AF] uppercase font-bold border-b border-[#1F293D] text-right">Fuel Loss %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F293D]">
                  {chartData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="p-3 text-white font-mono">{row.distance} km</td>
                      <td className="p-3 text-[#22c55e] font-mono">{row.altitude.toFixed(1)} m</td>
                      <td className="p-3 font-mono">
                        <span className={row.gradient > 0 ? 'text-rose-400' : 'text-blue-400'}>
                          {row.gradient > 0 ? '+' : ''}{row.gradient.toFixed(2)}%
                        </span>
                      </td>
                      <td className="p-3">
                        <span 
                          className="px-2 py-1 rounded-md text-[10px] font-bold"
                          style={{ 
                            backgroundColor: `${COLORS[row.category as keyof typeof COLORS]}20`,
                            color: COLORS[row.category as keyof typeof COLORS],
                            border: `1px solid ${COLORS[row.category as keyof typeof COLORS]}40`
                          }}
                        >
                          {row.category}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-white">
                        {row.fuel > 0 ? '+' : ''}{row.fuel.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
