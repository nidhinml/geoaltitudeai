import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, useMapEvents, ZoomControl, GeoJSON, Rectangle } from 'react-leaflet';
import L from 'leaflet';
import { 
  Activity, Map as MapIcon, Layers, Search, ShieldAlert, ShieldCheck, Droplets, Radar, Shield, Trash2, CloudRain, Eye, EyeOff, Info
} from 'lucide-react';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api');

const getRiskClassification = (altitude: number) => {
  if (altitude <= 5) return { level: 'Very High', color: '#ef4444', icon: ShieldAlert, desc: 'Critical flood zone. Highly vulnerable to sea-level rise and storm surges.' };
  if (altitude <= 15) return { level: 'High', color: '#f97316', icon: ShieldAlert, desc: 'High vulnerability to heavy monsoon flooding and tidal anomalies.' };
  if (altitude <= 50) return { level: 'Moderate', color: '#eab308', icon: Shield, desc: 'Moderate risk during extreme precipitation events. Flash flooding possible.' };
  if (altitude <= 150) return { level: 'Low', color: '#22c55e', icon: ShieldCheck, desc: 'Low flood risk. Generally safe unless situated in a deep valley or river basin.' };
  return { level: 'Very Low', color: '#3b82f6', icon: ShieldCheck, desc: 'Very low flood risk. High elevation terrain safe from standard flooding.' };
};

export default function FloodRiskAnalysis() {
  const [markers, setMarkers] = useState<any[]>([]);
  const [heatmapGrid, setHeatmapGrid] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapStyle, setMapStyle] = useState<'street' | 'satellite'>('satellite');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);
  const [showMapTutorial, setShowMapTutorial] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [keralaGeoJSON, setKeralaGeoJSON] = useState<any>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  useEffect(() => {
    fetch('/kerala.geojson')
      .then(res => res.json())
      .then(data => setKeralaGeoJSON(data))
      .catch(err => console.error("Error loading Kerala bounds", err));
  }, []);

  const MapEvents = () => {
    const map = useMapEvents({
      click: async (e) => {
        if (loading) return;
        
        if (keralaGeoJSON) {
          const pt = point([e.latlng.lng, e.latlng.lat]);
          const isInside = keralaGeoJSON.features.some((feature: any) => booleanPointInPolygon(pt, feature));
          if (!isInside) {
            alert("Point is outside the trained region (Kerala). Please select inside the boundary.");
            return;
          }
        }

        setLoading(true);
        try {
          const res = await fetch(`${API_BASE}/predict/live`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude: e.latlng.lat, longitude: e.latlng.lng })
          });
          
          if (res.ok) {
            const data = await res.json();
            const alt = data.predicted_altitude;
            const risk = getRiskClassification(alt);
            
            const newMarker = {
              lat: e.latlng.lat,
              lon: e.latlng.lng,
              altitude: alt,
              risk,
              timestamp: Date.now()
            };
            
            setMarkers(prev => [newMarker, ...prev].slice(0, 50)); // Keep last 50
          }
        } catch (err) {
          console.error(err);
        }
        setLoading(false);
      }
    });

    useEffect(() => {
      setMapInstance(map);
    }, [map]);

    return null;
  };

  const generateHeatmapGrid = async () => {
    if (!mapInstance || !keralaGeoJSON) return;
    
    setLoading(true);
    setHeatmapGrid([]); // clear old grid
    
    try {
      const bounds = mapInstance.getBounds();
      const zoom = mapInstance.getZoom();
      
      // Prevent scanning too large an area
      if (zoom < 11) {
        alert("Area is too large for grid scan. Please zoom in closer to a city or district first.");
        setLoading(false);
        return;
      }

      const latDiff = bounds.getNorth() - bounds.getSouth();
      const lonDiff = bounds.getEast() - bounds.getWest();
      
      // 12x12 grid = 144 points
      const GRID_SIZE = 12;
      const latStep = latDiff / GRID_SIZE;
      const lonStep = lonDiff / GRID_SIZE;
      
      let gridPoints = [];
      
      for (let i = 0; i < GRID_SIZE; i++) {
        for (let j = 0; j < GRID_SIZE; j++) {
          const lat = bounds.getSouth() + (i * latStep) + (latStep / 2);
          const lon = bounds.getWest() + (j * lonStep) + (lonStep / 2);
          
          // Only include points inside Kerala
          const pt = point([lon, lat]);
          const isInside = keralaGeoJSON.features.some((f: any) => booleanPointInPolygon(pt, f));
          
          if (isInside) {
            gridPoints.push({ lat, lon, latBounds: [bounds.getSouth() + (i * latStep), bounds.getSouth() + ((i + 1) * latStep)], lonBounds: [bounds.getWest() + (j * lonStep), bounds.getWest() + ((j + 1) * lonStep)] });
          }
        }
      }

      if (gridPoints.length === 0) {
        alert("No valid region found within Kerala bounds.");
        setLoading(false);
        return;
      }

      // Batch predict for speed using parallel live requests as POST
      const promises = gridPoints.map(p => 
        fetch(`${API_BASE}/predict/live`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude: p.lat, longitude: p.lon })
        }).then(res => res.json())
      );
      
      const results = await Promise.all(promises);
      
      const coloredGrid = results.map((pred: any, index: number) => {
        const gp = gridPoints[index];
        const risk = getRiskClassification(pred.predicted_altitude);
        return {
          bounds: [[gp.latBounds[0], gp.lonBounds[0]], [gp.latBounds[1], gp.lonBounds[1]]],
          color: risk.color,
          altitude: pred.predicted_altitude,
          riskLevel: risk.level
        };
      });
      
      setHeatmapGrid(coloredGrid);
    } catch (err) {
      console.error(err);
      alert("Failed to generate grid. Backend might be down.");
    }
    
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !mapInstance) return;
    setLoading(true);
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchQuery)}&count=1&format=json`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.results && data.results.length > 0) {
          mapInstance.flyTo([data.results[0].latitude, data.results[0].longitude], 13);
        } else {
           alert("Location not found.");
        }
      }
    } catch (e) {
      console.warn("Search error", e);
    }
    setLoading(false);
  };

  const clearAll = () => {
    setMarkers([]);
    setHeatmapGrid([]);
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 relative">
      {/* LEFT PANE: Map Container */}
      <div className="flex-1 lg:flex-[1.8] relative rounded-2xl overflow-hidden border border-[#1F293D] shadow-2xl bg-[#0B0F19]">
        <div className="absolute top-4 left-4 z-[400] bg-black/70 backdrop-blur-md border border-white/10 p-4 rounded-xl shadow-xl w-72 pointer-events-auto">
          <div className="flex items-center gap-3 mb-3">
            <Droplets className="w-5 h-5 text-[#3b82f6]" />
            <h3 className="text-white font-bold text-sm">Flood Risk Scanner</h3>
          </div>
          <p className="text-xs text-[#9CA3AF] mb-4">Click anywhere on the map to drop a water-level sensor, or scan the viewport for a macro analysis.</p>
          
          <div className="flex gap-2 mb-3">
            <input 
              type="text" 
              placeholder="Search city (e.g. Kochi)" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 bg-[#161D30] border border-[#1F293D] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#3b82f6]"
            />
            <button 
              onClick={handleSearch}
              disabled={loading || !searchQuery.trim()}
              className="px-3 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <button 
              onClick={generateHeatmapGrid} 
              disabled={loading}
              className="w-full py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 text-white text-xs font-black rounded-lg transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(59,130,246,0.5)] disabled:opacity-50"
            >
              {loading ? <Activity className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
              {loading ? 'Scanning Region...' : 'Scan Current Viewport'}
            </button>
            <button 
              onClick={clearAll} 
              disabled={loading || (markers.length === 0 && heatmapGrid.length === 0)}
              className="w-full py-2 bg-[#161D30] hover:bg-red-500/20 text-white hover:text-red-400 text-xs font-bold rounded-lg transition-colors border border-[#1F293D] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" /> Clear Map
            </button>
          </div>
          
          <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
            <h4 className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest flex items-center gap-1"><CloudRain className="w-3 h-3"/> Risk Legend</h4>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="flex items-center gap-2 text-[10px] text-white"><div className="w-3 h-3 rounded-sm bg-[#ef4444]"></div> Very High (0-5m)</div>
              <div className="flex items-center gap-2 text-[10px] text-white"><div className="w-3 h-3 rounded-sm bg-[#f97316]"></div> High (5-15m)</div>
              <div className="flex items-center gap-2 text-[10px] text-white"><div className="w-3 h-3 rounded-sm bg-[#eab308]"></div> Moderate (15-50m)</div>
              <div className="flex items-center gap-2 text-[10px] text-white"><div className="w-3 h-3 rounded-sm bg-[#22c55e]"></div> Low (50-150m)</div>
              <div className="flex items-center gap-2 text-[10px] text-white col-span-2"><div className="w-3 h-3 rounded-sm bg-[#3b82f6]"></div> Very Low ({'>'}150m)</div>
            </div>
          </div>
        </div>

        <div className="absolute top-4 right-4 z-[400] bg-black/70 backdrop-blur-md border border-white/10 p-1.5 rounded-xl shadow-xl pointer-events-auto">
          <button 
            onClick={() => setMapStyle(prev => prev === 'street' ? 'satellite' : 'street')}
            className="flex items-center gap-2 px-3 py-2 bg-[#161D30] hover:bg-[#1F293D] text-white text-xs font-bold rounded-lg transition-colors border border-white/10"
          >
            {mapStyle === 'street' ? <MapIcon className="w-4 h-4 text-[#22c55e]" /> : <Layers className="w-4 h-4 text-[#3b82f6]" />}
            {mapStyle === 'street' ? 'Street View' : 'Satellite View'}
          </button>
        </div>
        
        <MapContainer center={[10.8505, 76.2711]} zoom={7} style={{ height: '100%', width: '100%' }} zoomControl={false} className="z-0 cursor-crosshair">
          {mapStyle === 'satellite' ? (
            <TileLayer key="satellite" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri" />
          ) : (
            <TileLayer key="street" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' />
          )}
          <ZoomControl position="bottomright" />
          <MapEvents />
          
          {keralaGeoJSON && (
            <GeoJSON data={keralaGeoJSON} style={() => ({ color: '#3b82f6', weight: 2, fillOpacity: 0.0 })} />
          )}

          {heatmapGrid.map((gridItem, i) => (
            <Rectangle 
              key={`grid-${i}`} 
              bounds={gridItem.bounds} 
              pathOptions={{ color: gridItem.color, weight: 0, fillOpacity: 0.45 }} 
            >
              <Popup className="custom-popup">
                <div className="p-1">
                  <p className="text-xs font-bold mb-1" style={{ color: gridItem.color }}>{gridItem.riskLevel} Risk</p>
                  <p className="text-[10px] text-gray-300">Predicted Altitude: <strong>{gridItem.altitude.toFixed(1)}m</strong></p>
                </div>
              </Popup>
            </Rectangle>
          ))}

          {markers.map((marker, i) => (
            <CircleMarker 
              key={`marker-${i}`}
              center={[marker.lat, marker.lon]}
              radius={8}
              pathOptions={{ color: '#fff', weight: 2, fillColor: marker.risk.color, fillOpacity: 1 }}
            >
              <Popup className="custom-popup min-w-[200px]">
                <div className="bg-[#0B0F19] p-3 -m-3 rounded-lg border border-[#1F293D]">
                  <div className="flex items-center gap-2 mb-2">
                    <marker.risk.icon className="w-4 h-4" style={{ color: marker.risk.color }} />
                    <h4 className="font-bold text-sm" style={{ color: marker.risk.color }}>{marker.risk.level} Flood Risk</h4>
                  </div>
                  <div className="bg-[#161D30] p-2 rounded-md mb-2 border border-[#1F293D]">
                    <p className="text-xs text-[#9CA3AF]">Altitude: <span className="text-white font-mono">{marker.altitude.toFixed(1)}m</span></p>
                    <p className="text-[10px] text-[#9CA3AF] mt-1 font-mono">[{marker.lat.toFixed(4)}, {marker.lon.toFixed(4)}]</p>
                  </div>
                  <p className="text-[10px] text-gray-300 leading-relaxed border-t border-white/10 pt-2">
                    {marker.risk.desc}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* RIGHT PANE: Event History */}
      <div className="flex-1 lg:flex-[1] overflow-y-auto custom-scrollbar pr-2 pb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Droplets className="w-6 h-6 text-[#3b82f6]" /> Risk Registry
          </h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowUserGuide(!showUserGuide)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#161D30] hover:bg-[#1F293D] text-[#9CA3AF] hover:text-white text-xs font-bold rounded-lg border border-[#1F293D] transition-colors"
            >
              <Info className="w-4 h-4" />
              {showUserGuide ? 'Hide Guide' : 'User Guide'}
            </button>
            <button 
              onClick={() => setShowMapTutorial(!showMapTutorial)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#161D30] hover:bg-[#1F293D] text-[#9CA3AF] hover:text-white text-xs font-bold rounded-lg border border-[#1F293D] transition-colors"
            >
              {showMapTutorial ? <EyeOff className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
              {showMapTutorial ? 'Hide Scanning' : 'Scanning Tech'}
            </button>
            <button 
              onClick={() => setShowTutorial(!showTutorial)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#161D30] hover:bg-[#1F293D] text-[#9CA3AF] hover:text-white text-xs font-bold rounded-lg border border-[#1F293D] transition-colors"
            >
              {showTutorial ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showTutorial ? 'Hide AI Math' : 'How AI Works'}
            </button>
          </div>
        </div>

        {/* USER GUIDE */}
        {showUserGuide && (
        <div className="glass-panel p-5 rounded-2xl border border-[#1F293D] mb-6 bg-[#0B0F19]">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-[#22c55e]" /> How to Use This Page
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-[#9CA3AF]">
            <li><strong>Analyze an Area:</strong> Click anywhere on the map to trigger a Flood Risk scan.</li>
            <li><strong>Data Extraction:</strong> The system will drop a marker, then mathematically analyze the surrounding topography to build a local depression matrix.</li>
            <li><strong>Review Alerts:</strong> If the area is a geographic "sink" (lower than its surroundings) or near sea level, it will be flagged High Risk and added to your registry.</li>
            <li><strong>View Heatmaps:</strong> The map will draw bounding boxes and circles to highlight the specific impact zones around your clicked coordinate.</li>
          </ol>
        </div>
        )}

        {/* MAP & SCANNING ARCHITECTURE */}
        {showMapTutorial && (
        <div className="glass-panel p-5 rounded-2xl border border-[#1F293D] mb-6 bg-[#0B0F19]">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <MapIcon className="w-4 h-4 text-[#3b82f6]" /> Map & Scanning Architecture
          </h3>
          <div className="flex flex-col xl:flex-row gap-6 items-center">
            {/* Diagram */}
            <div className="w-full xl:w-1/3 bg-[#161D30] rounded-xl border border-[#1F293D] p-4 flex items-center justify-center relative overflow-hidden h-32">
              <svg viewBox="0 0 200 100" className="w-full h-full">
                <circle cx="40" cy="50" r="20" fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" />
                <circle cx="40" cy="50" r="3" fill="#3b82f6" />
                <text x="40" y="85" fill="white" fontSize="10" textAnchor="middle" fontWeight="bold">Click Event</text>
                
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
                 <strong className="text-white">Mapping Engine:</strong> We use <strong className="text-[#3b82f6]">React-Leaflet</strong> over satellite tiles to provide a visual topographic base layer.
               </p>
               <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                 <strong className="text-white">Spatial Grid Sampling:</strong> When you click the map, the app generates a localized bounding box. We extract a dense grid of Lat/Lon coordinates from this box to map out the surrounding area.
               </p>
               <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                 <strong className="text-white">Data Pipeline:</strong> This matrix of points is sent to our Python FastAPI backend. The <strong className="text-[#f97316]">XGBoost Model</strong> predicts the altitude for every coordinate, allowing the frontend to generate flood risk heatmaps and identify topographic sinks.
               </p>
            </div>
          </div>
        </div>
        )}

        {/* HOW IT WORKS (LAYMAN'S GUIDE) */}
        {showTutorial && (
        <div className="glass-panel p-5 rounded-2xl border border-[#1F293D] mb-6 bg-[#0B0F19]">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <Droplets className="w-4 h-4 text-[#3b82f6]" /> How it Works (AI & Physics Model)
          </h3>
          
          <div className="flex flex-col xl:flex-row gap-6 items-center">
            {/* Animated SVG Pictorial */}
            <div className="w-full xl:w-1/3 bg-[#161D30] rounded-xl border border-[#1F293D] p-4 flex items-center justify-center relative overflow-hidden h-32">
              <svg viewBox="0 0 200 100" className="w-full h-full">
                {/* Terrain */}
                <path d="M 0 50 Q 50 10 100 80 T 200 40 L 200 100 L 0 100 Z" fill="#1F293D" />
                {/* Rain */}
                <motion.g animate={{ y: [0, 40], opacity: [0, 1, 0] }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <line x1="50" y1="0" x2="45" y2="10" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
                  <line x1="150" y1="10" x2="145" y2="20" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
                  <line x1="100" y1="-10" x2="95" y2="0" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
                </motion.g>
                {/* Water pooling in depression */}
                <motion.path 
                  initial={{ d: "M 70 80 Q 100 80 130 80 Z" }}
                  animate={{ d: "M 60 70 Q 100 75 140 70 L 130 80 Q 100 85 70 80 Z" }}
                  transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
                  fill="#ef4444" opacity="0.8"
                />
                <text x="75" y="60" fill="#ef4444" fontSize="10" fontWeight="bold">Flood Sink</text>
                <text x="10" y="30" fill="#22c55e" fontSize="10" fontWeight="bold">Safe Peak</text>
              </svg>
            </div>
            
             <div className="w-full xl:w-2/3 space-y-3">
               <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                 <strong className="text-white">The Math (Topographic Depression Analysis):</strong> Water always flows downhill. The AI scans the Lat/Lons in an area to build a 3D grid of altitudes. It then runs a sink-detection algorithm:
               </p>
               <div className="bg-[#161D30] p-2 rounded border border-[#1F293D] font-mono text-[10px] text-[#3b82f6] space-y-1">
                 <p>Sink Condition: Alt(x,y) &lt; min(Alt(neighbors))</p>
                 <p className="text-[#9CA3AF]">If true, the point is a localized topological depression.</p>
               </div>
               <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                 <strong className="text-white">Why we take it:</strong> Because water has nowhere to flow out of a sink, these lowest-altitude coordinates are flagged as "Red Zones" (highly vulnerable to flooding). Urban planners use this to avoid building critical infrastructure in invisible geographic bowls.
               </p>
            </div>
          </div>
        </div>
        )}


        {markers.length === 0 ? (
          <div className="glass-panel h-64 rounded-2xl border border-[#1F293D] flex flex-col items-center justify-center text-center p-10 bg-[#0B0F19]">
            <CloudRain className="w-12 h-12 text-[#3b82f6]/20 mb-4 animate-pulse" />
            <p className="text-white font-bold">No locations scanned</p>
            <p className="text-xs text-[#9CA3AF] mt-2">Click on the map or scan the viewport to populate the registry.</p>
          </div>
        ) : (
          <AnimatePresence>
            <div className="space-y-3">
              {markers.map((marker, idx) => (
                <motion.div 
                  key={marker.timestamp}
                  initial={{ opacity: 0, x: 20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  className="glass-panel p-4 rounded-xl border flex items-center justify-between bg-[#0B0F19]"
                  style={{ borderColor: `${marker.risk.color}30` }}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${marker.risk.color}20` }}>
                      <marker.risk.icon className="w-5 h-5" style={{ color: marker.risk.color }} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">{marker.risk.level} Risk Zone</h4>
                      <p className="text-[10px] text-[#9CA3AF] mt-0.5">Altitude: {marker.altitude.toFixed(1)}m | Coords: {marker.lat.toFixed(3)}, {marker.lon.toFixed(3)}</p>
                      <p className="text-[10px] text-gray-400 mt-1 line-clamp-1">{marker.risk.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
        
        <div className="mt-6 glass-panel p-4 rounded-xl border border-[#1F293D] bg-gradient-to-br from-[#161D30] to-[#0B0F19]">
          <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1"><Activity className="w-3 h-3 text-[#3b82f6]" /> Future Capabilities</h4>
          <p className="text-[10px] text-[#9CA3AF] leading-relaxed">
            The GeoAltitude Flood Risk engine currently uses AI topological inference to determine structural vulnerability. Future modules are designed to integrate real-time rainfall APIs (e.g. IMD, Open-Meteo) to dynamically offset these baseline risk scores based on localized precipitation density and river discharge rates.
          </p>
        </div>
      </div>
    </div>
  );
}
