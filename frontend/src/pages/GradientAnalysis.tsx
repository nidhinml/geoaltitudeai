import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, ZoomControl, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import { 
  Activity, Play, Undo2, Map as MapIcon, Layers, Car, Ruler, Search, Plus, X, AlertTriangle, TrendingUp, TrendingDown, GripHorizontal, Eye, EyeOff, Info
} from 'lucide-react';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api');

const customIcon = new L.DivIcon({
  className: 'custom-marker',
  html: `<div class="w-4 h-4 bg-[#3b82f6] border-2 border-white rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

const RADIUS_OF_EARTH_IN_KM = 6371;
const toRadian = (degree: number) => (degree * Math.PI) / 180;
const distance = (lat1: number, lat2: number) => toRadian(lat2 - lat1);

const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const dLat = distance(lat2, lat1);
  const dLon = distance(lon2, lon1);
  lat1 = toRadian(lat1);
  lat2 = toRadian(lat2);
  const a = Math.pow(Math.sin(dLat / 2), 2) + Math.pow(Math.sin(dLon / 2), 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.asin(Math.sqrt(a));
  return RADIUS_OF_EARTH_IN_KM * c;
};

const getGradientColor = (slope: number) => {
  if (slope < 3) return '#22c55e'; // Green
  if (slope < 6) return '#eab308'; // Yellow
  if (slope < 10) return '#f97316'; // Orange
  return '#ef4444'; // Red
};

const MapUpdater = ({ routePoints }: { routePoints: {lat: number, lon: number}[] }) => {
  const map = useMapEvents({});
  useEffect(() => {
    if (routePoints.length > 1) {
      const bounds = L.latLngBounds(routePoints.map(p => [p.lat, p.lon]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [routePoints, map]);
  return null;
};

export default function GradientAnalysis() {
  const [routePoints, setRoutePoints] = useState<{lat: number, lon: number}[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[] | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [mapStyle, setMapStyle] = useState<'street' | 'satellite'>('street');
  const [routingMode, setRoutingMode] = useState<'manual' | 'auto'>('manual');
  const [keralaGeoJSON, setKeralaGeoJSON] = useState<any>(null);
  const [searchLocations, setSearchLocations] = useState<string[]>(['', '']);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showMapTutorial, setShowMapTutorial] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/kerala.geojson')
      .then(res => res.json())
      .then(data => setKeralaGeoJSON(data))
      .catch(err => console.error("Error loading Kerala bounds", err));
  }, []);

  const MapClickHandler = () => {
    useMapEvents({
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

        const newPoint = { lat: e.latlng.lat, lon: e.latlng.lng };
        
        if (routingMode === 'auto' && routePoints.length > 0) {
          const lastPoint = routePoints[routePoints.length - 1];
          setLoading(true);
          try {
            const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${lastPoint.lon},${lastPoint.lat};${newPoint.lon},${newPoint.lat}?overview=full&geometries=geojson`);
            if (res.ok) {
              const data = await res.json();
              if (data.routes && data.routes.length > 0) {
                const coords = data.routes[0].geometry.coordinates;
                const path = coords.map((c: number[]) => ({ lat: c[1], lon: c[0] }));
                setRoutePoints(prev => [...prev, ...path.slice(1)]);
              } else {
                setRoutePoints(prev => [...prev, newPoint]);
              }
            } else {
              setRoutePoints(prev => [...prev, newPoint]);
            }
          } catch (err) {
            setRoutePoints(prev => [...prev, newPoint]);
          }
          setLoading(false);
        } else {
          setRoutePoints(prev => [...prev, newPoint]);
        }
        setSegments([]);
        setChartData(null);
        setStats(null);
      }
    });
    return null;
  };

  const undoLastPoint = () => {
    setRoutePoints(prev => prev.slice(0, -1));
    setSegments([]);
    setChartData(null);
    setStats(null);
  };

  const clearRoute = () => {
    setRoutePoints([]);
    setSegments([]);
    setChartData(null);
    setStats(null);
    setSearchLocations(['', '']);
  };

  const forwardGeocode = async (query: string) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        }
      }
    } catch (e) {
      console.warn("Forward geocoding error", e);
    }
    return null;
  };

  const handleTextSearch = async () => {
    const validLocs = searchLocations.filter(loc => loc.trim() !== '');
    if (validLocs.length < 2) return alert("Please enter at least a start and end location.");
    setLoading(true);
    
    let pts: {lat: number, lon: number}[] = [];
    
    for (let loc of validLocs) {
      const pt = await forwardGeocode(loc);
      if (!pt) {
        setLoading(false);
        return alert(`Could not find coordinates for: ${loc}`);
      }
      if (keralaGeoJSON) {
        const isInside = keralaGeoJSON.features.some((feature: any) => booleanPointInPolygon(point([pt.lon, pt.lat]), feature));
        if (!isInside) {
          setLoading(false);
          return alert(`Location "${loc}" is outside the trained region.`);
        }
      }
      pts.push(pt);
    }
    
    setRoutingMode('auto');
    
    try {
      const coordsString = pts.map(p => `${p.lon},${p.lat}`).join(';');
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`);
      if (res.ok) {
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const coords = data.routes[0].geometry.coordinates;
          const newRoute = coords.map((c: number[]) => ({ lat: c[1], lon: c[0] }));
          setRoutePoints(newRoute);
        } else {
          setRoutePoints(pts);
        }
      } else {
        setRoutePoints(pts);
      }
    } catch (e) {
      setRoutePoints(pts);
    }
    setSegments([]);
    setChartData(null);
    setStats(null);
    setLoading(false);
  };

  const generateGradient = async () => {
    if (routePoints.length < 2) {
      alert("Please select at least 2 points.");
      return;
    }
    
    setLoading(true);
    
    try {
      let processPoints = routePoints;
      
      const MAX_POINTS = 200;
      if (processPoints.length > MAX_POINTS) {
        const step = Math.ceil(processPoints.length / MAX_POINTS);
        processPoints = processPoints.filter((_, i) => i % step === 0 || i === processPoints.length - 1);
      }
      
      const predictions = await Promise.all(
        processPoints.map(async (pt, index) => {
          const res = await fetch(`${API_BASE}/predict/live`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude: pt.lat, longitude: pt.lon })
          });
          if (!res.ok) throw new Error("Failed to predict for point " + index);
          const data = await res.json();
          return { ...pt, altitude: data.predicted_altitude };
        })
      );
      
      let totalDist = 0;
      let maxGradient = 0;
      let sumGradient = 0;
      let ascendingDist = 0;
      let descendingDist = 0;
      let flatDist = 0;
      
      const segs = [];
      const chart = [];
      
      chart.push({ distance: 0, gradient: 0, lat: predictions[0].lat, lon: predictions[0].lon });
      
      for (let i = 1; i < predictions.length; i++) {
        const pt1 = predictions[i-1];
        const pt2 = predictions[i];
        const distKm = haversineDistance(pt1.lat, pt1.lon, pt2.lat, pt2.lon);
        const distM = distKm * 1000;
        const eleDiff = pt2.altitude - pt1.altitude;
        
        let slope = 0;
        if (distM > 0) {
          slope = Math.abs(eleDiff / distM) * 100;
        }
        
        if (slope > maxGradient) maxGradient = slope;
        sumGradient += slope;
        
        totalDist += distKm;
        
        if (eleDiff > 1) ascendingDist += distKm;
        else if (eleDiff < -1) descendingDist += distKm;
        else flatDist += distKm;
        
        const color = getGradientColor(slope);
        
        segs.push({
          positions: [[pt1.lat, pt1.lon], [pt2.lat, pt2.lon]],
          gradient: slope,
          color
        });
        
        chart.push({
          distance: parseFloat(totalDist.toFixed(2)),
          gradient: parseFloat(slope.toFixed(1)),
          lat: pt2.lat,
          lon: pt2.lon
        });
      }

      setStats({
        maxGradient: parseFloat(maxGradient.toFixed(1)),
        avgGradient: parseFloat((sumGradient / (predictions.length - 1)).toFixed(1)),
        totalDist: parseFloat(totalDist.toFixed(2)),
        ascending: parseFloat(ascendingDist.toFixed(2)),
        descending: parseFloat(descendingDist.toFixed(2)),
        flat: parseFloat(flatDist.toFixed(2))
      });
      
      setSegments(segs);
      setChartData(chart);
    } catch (err) {
      console.error(err);
      alert("Error generating gradient analysis. Ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 relative">
      
      {/* LEFT PANE: Map Container */}
      <div className="flex-1 lg:flex-[1.5] relative rounded-2xl overflow-hidden border border-[#1F293D] shadow-2xl bg-[#0B0F19]">
        <div className="absolute top-4 left-4 z-[400] bg-black/70 backdrop-blur-md border border-white/10 p-4 rounded-xl shadow-xl w-64 pointer-events-auto max-h-[80vh] overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-3 mb-3">
            <Ruler className="w-5 h-5 text-[#f97316]" />
            <h3 className="text-white font-bold text-sm">Gradient Engine</h3>
          </div>
          <p className="text-xs text-[#9CA3AF] mb-4">Route points selected: {routePoints.length}</p>
          
          <div className="flex flex-col gap-2 mb-4">
            {searchLocations.map((loc, i) => (
              <div key={i} className="flex gap-1 items-center">
                <input 
                  type="text" 
                  placeholder={i === 0 ? "Start Location" : i === searchLocations.length - 1 ? "End Location" : "Via Location"} 
                  value={loc} 
                  onChange={e => {
                    const newLocs = [...searchLocations];
                    newLocs[i] = e.target.value;
                    setSearchLocations(newLocs);
                  }} 
                  className="w-full bg-[#161D30] border border-[#1F293D] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#f97316]" 
                />
                {searchLocations.length > 2 && (
                  <button onClick={() => setSearchLocations(searchLocations.filter((_, idx) => idx !== i))} className="p-1.5 bg-[#1F293D] hover:bg-red-500/20 text-red-400 rounded-lg">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            <button 
              onClick={() => {
                const newLocs = [...searchLocations];
                newLocs.splice(newLocs.length - 1, 0, '');
                setSearchLocations(newLocs);
              }} 
              disabled={loading} 
              className="w-full py-1.5 border border-dashed border-[#1F293D] hover:border-[#f97316] text-[#9CA3AF] hover:text-[#f97316] text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add Stop
            </button>
            <button onClick={handleTextSearch} disabled={loading} className="w-full mt-1 py-1.5 bg-[#f97316] hover:bg-[#ea580c] text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1 shadow-neon">
              <Search className="w-3 h-3" /> Search Route
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button 
                onClick={() => setRoutingMode(prev => prev === 'manual' ? 'auto' : 'manual')} 
                disabled={loading}
                className="flex-1 py-2 bg-[#161D30] hover:bg-[#1F293D] text-white text-xs font-bold rounded-lg transition-colors border border-[#1F293D] flex items-center justify-center gap-1"
              >
                {routingMode === 'manual' ? <Ruler className="w-3 h-3 text-yellow-400" /> : <Car className="w-3 h-3 text-[#3b82f6]" />}
                {routingMode === 'manual' ? 'Manual Line' : 'Auto Route'}
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={clearRoute} disabled={loading || routePoints.length === 0} className="flex-1 py-2 bg-[#161D30] hover:bg-red-500/20 text-white hover:text-red-400 text-xs font-bold rounded-lg transition-colors border border-[#1F293D]">
                Clear
              </button>
              <button onClick={undoLastPoint} disabled={loading || routePoints.length === 0} className="flex-1 py-2 bg-[#161D30] hover:bg-[#1F293D] text-white text-xs font-bold rounded-lg transition-colors border border-[#1F293D] flex items-center justify-center gap-1">
                <Undo2 className="w-3 h-3" /> Undo
              </button>
            </div>
            <button 
              onClick={generateGradient} 
              disabled={loading || routePoints.length < 2}
              className="w-full py-2 bg-gradient-to-r from-[#22c55e] to-[#3b82f6] hover:opacity-90 text-white text-sm font-black rounded-lg transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(59,130,246,0.5)] disabled:opacity-50"
            >
              {loading ? <Activity className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
              {loading ? 'Analyzing...' : 'Analyze Steepness'}
            </button>
          </div>
          
          <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
            <h4 className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest">Gradient Legend</h4>
            <div className="flex items-center gap-2 text-xs text-white"><div className="w-3 h-3 rounded-full bg-[#22c55e]"></div> Flat / Mild ({"<"} 3%)</div>
            <div className="flex items-center gap-2 text-xs text-white"><div className="w-3 h-3 rounded-full bg-[#eab308]"></div> Moderate (3% - 6%)</div>
            <div className="flex items-center gap-2 text-xs text-white"><div className="w-3 h-3 rounded-full bg-[#f97316]"></div> Steep (6% - 10%)</div>
            <div className="flex items-center gap-2 text-xs text-white"><div className="w-3 h-3 rounded-full bg-[#ef4444]"></div> Extreme ({">"} 10%)</div>
          </div>
        </div>

        <div className="absolute top-4 right-4 z-[400] bg-black/70 backdrop-blur-md border border-white/10 p-1.5 rounded-xl shadow-xl pointer-events-auto">
          <button 
            onClick={() => setMapStyle(prev => prev === 'street' ? 'satellite' : 'street')}
            className="flex items-center gap-2 px-3 py-2 bg-[#161D30] hover:bg-[#1F293D] text-white text-xs font-bold rounded-lg transition-colors border border-white/10"
          >
            {mapStyle === 'street' ? <Layers className="w-4 h-4 text-[#3b82f6]" /> : <MapIcon className="w-4 h-4 text-[#22c55e]" />}
            {mapStyle === 'street' ? 'Satellite' : 'Street'}
          </button>
        </div>
        
        <MapContainer center={[10.8505, 76.2711]} zoom={7} style={{ height: '100%', width: '100%' }} zoomControl={false} className="z-0">
          {mapStyle === 'satellite' ? (
            <TileLayer key="satellite" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri" />
          ) : (
            <TileLayer key="street" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' />
          )}
          <ZoomControl position="bottomleft" />
          <MapClickHandler />
          <MapUpdater routePoints={routePoints} />
          
          {keralaGeoJSON && (
            <GeoJSON data={keralaGeoJSON} style={() => ({ color: '#3b82f6', weight: 1, fillOpacity: 0.05, dashArray: '5, 5' })} />
          )}

          {routePoints.map((pt, index) => (
            <Marker key={index} position={[pt.lat, pt.lon]} icon={customIcon} />
          ))}

          {segments.length > 0 ? (
            segments.map((seg, i) => (
              <Polyline key={`seg-${i}`} positions={seg.positions} color={seg.color} weight={6} opacity={0.9} />
            ))
          ) : routePoints.length > 1 ? (
            <Polyline positions={routePoints.map(p => [p.lat, p.lon])} color="#3b82f6" weight={4} dashArray="5, 10" />
          ) : null}
        </MapContainer>
      </div>

      {/* RIGHT PANE: Analysis */}
      <div className="flex-1 lg:flex-[1.5] overflow-y-auto custom-scrollbar pr-2 pb-10" ref={reportRef}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Ruler className="w-6 h-6 text-[#f97316]" /> Gradient Analysis Report
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
              {showMapTutorial ? 'Hide Routing' : 'Routing Tech'}
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
            <li><strong>Define a Route:</strong> Click anywhere on the map to drop a Start point, then click again for an End point. You can add as many waypoints as you need.</li>
            <li><strong>Auto-Routing vs Manual:</strong> Use the "Auto Route" toggle to snap your points to physical roads via OSRM, or "Manual Line" to draw straight point-to-point lines (useful for pipelines or off-road).</li>
            <li><strong>Analyze:</strong> Click the <strong className="text-[#3b82f6]">Generate</strong> button below the map.</li>
            <li><strong>Review Report:</strong> The system will chunk your route into 500m segments, classifying each section as flat, uphill, steep, or dangerous based on the calculated gradient %.</li>
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
                 <strong className="text-white">Data Pipeline:</strong> We sample points along this OSRM route and stream them to our Python FastAPI backend. The <strong className="text-[#f97316]">XGBoost Model</strong> predicts the altitude for each point, allowing the frontend to calculate the physical Gradient metrics.
               </p>
            </div>
          </div>
        </div>
        )}

        {/* HOW IT WORKS (LAYMAN'S GUIDE) */}
        {showTutorial && (
        <div className="glass-panel p-5 rounded-2xl border border-[#1F293D] mb-6 bg-[#0B0F19]">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <Ruler className="w-4 h-4 text-[#3b82f6]" /> How it Works (AI & Physics Model)
          </h3>
          
          <div className="flex flex-col xl:flex-row gap-6 items-center">
            {/* Animated SVG Pictorial */}
            <div className="w-full xl:w-1/3 bg-[#161D30] rounded-xl border border-[#1F293D] p-4 flex items-center justify-center relative overflow-hidden h-32">
              <svg viewBox="0 0 200 100" className="w-full h-full">
                <path d="M 10 80 L 150 20" stroke="#1F293D" strokeWidth="2" strokeDasharray="4 4" fill="none" />
                <path d="M 10 80 L 150 80" stroke="#22c55e" strokeWidth="2" fill="none" />
                <path d="M 150 80 L 150 20" stroke="#ef4444" strokeWidth="2" fill="none" />
                
                <text x="70" y="95" fill="#22c55e" fontSize="10" fontWeight="bold">Run (Distance)</text>
                <text x="155" y="55" fill="#ef4444" fontSize="10" fontWeight="bold">Rise (Altitude)</text>
                
                <motion.g
                  animate={{ x: [0, 140], y: [0, -60] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <rect x="0" y="70" width="16" height="10" fill="#3b82f6" rx="2" transform="rotate(-23 10 80)" />
                  <circle cx="5" cy="80" r="3" fill="white" transform="rotate(-23 10 80)" />
                  <circle cx="15" cy="80" r="3" fill="white" transform="rotate(-23 10 80)" />
                </motion.g>
              </svg>
            </div>
            
            <div className="w-full xl:w-2/3 space-y-3">
               <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                 <strong className="text-white">The Math (Trigonometric Gradient):</strong> To calculate the steepness of any road, the AI combines two technical formulas:
               </p>
               <div className="bg-[#161D30] p-2 rounded border border-[#1F293D] font-mono text-[10px] text-[#3b82f6] space-y-1">
                 <p>1. Horizontal Dist = Haversine(Lat₁, Lon₁, Lat₂, Lon₂)</p>
                 <p>2. Vertical Rise = XGBoost_Predict(Alt₂) - XGBoost_Predict(Alt₁)</p>
                 <p className="text-[#f97316]">3. Gradient (%) = (Vertical Rise / Horizontal Dist) × 100</p>
               </div>
               <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                 <strong className="text-white">Why we take it:</strong> By mathematically dividing the Vertical Rise by the Horizontal Run, the system perfectly maps out which segments of your route are flat (safe), and which are dangerously steep mountainsides.
               </p>
            </div>
          </div>
        </div>
        )}


        {!stats ? (
          <div className="glass-panel h-64 rounded-2xl border border-[#1F293D] flex flex-col items-center justify-center text-center p-10 bg-[#0B0F19]">
            <AlertTriangle className="w-12 h-12 text-[#f97316]/20 mb-4 animate-pulse" />
            <p className="text-white font-bold">Waiting for route analysis</p>
            <p className="text-xs text-[#9CA3AF] mt-2">Draw a route on the map and click Analyze Steepness.</p>
          </div>
        ) : (
          <AnimatePresence>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-panel p-4 rounded-xl border border-[#1F293D] bg-gradient-to-br from-[#ef4444]/10 to-transparent relative group">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[10px] text-[#ef4444] font-bold uppercase tracking-widest flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Max Steepness</p>
                    <Info className="w-3 h-3 text-[#ef4444]/70 cursor-help" />
                    <div className="absolute bottom-full left-0 mb-2 w-72 p-3 bg-[#111827] border border-[#1F293D] rounded-lg shadow-2xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50">
                      <strong className="text-[#ef4444] block mb-2">Max Gradient (Steepness)</strong>
                      <p className="mb-2">The steepest single section of the route, indicating the most extreme incline a vehicle would face.</p>
                      <svg viewBox="0 0 200 80" className="w-full h-20 bg-[#0B0F19] rounded border border-[#1F293D] mt-2">
                        <path d="M 10 70 Q 40 70, 70 50 T 130 20 T 190 60" stroke="#9CA3AF" strokeWidth="2" fill="none" />
                        <line x1="80" y1="46" x2="110" y2="28" stroke="#ef4444" strokeWidth="4" />
                        <circle cx="95" cy="37" r="15" stroke="#ef4444" strokeWidth="1" fill="none" strokeDasharray="2 2" />
                        <text x="95" y="15" fill="#ef4444" fontSize="10" textAnchor="middle">Steepest Peak</text>
                      </svg>
                    </div>
                  </div>
                  <p className="text-2xl font-black text-white">{stats.maxGradient} <span className="text-sm font-normal text-[#9CA3AF]">%</span></p>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-[#1F293D] bg-gradient-to-br from-[#3b82f6]/10 to-transparent relative group">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[10px] text-[#3b82f6] font-bold uppercase tracking-widest flex items-center gap-1"><Activity className="w-3 h-3" /> Average Gradient</p>
                    <Info className="w-3 h-3 text-[#3b82f6]/70 cursor-help" />
                    <div className="absolute bottom-full left-0 mb-2 w-72 p-3 bg-[#111827] border border-[#1F293D] rounded-lg shadow-2xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50">
                      <strong className="text-[#3b82f6] block mb-2">Average Gradient</strong>
                      <p className="mb-2">The overall steepness of the entire route, calculated as total elevation change over total distance.</p>
                      <svg viewBox="0 0 200 80" className="w-full h-20 bg-[#0B0F19] rounded border border-[#1F293D] mt-2">
                        <path d="M 20 60 L 180 20" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" fill="none" />
                        <path d="M 20 60 Q 80 80, 120 40 T 180 20" stroke="#9CA3AF" strokeWidth="1" fill="none" opacity="0.5" />
                        <circle cx="20" cy="60" r="4" fill="#22c55e" />
                        <circle cx="180" cy="20" r="4" fill="#ef4444" />
                        <text x="100" y="30" fill="#3b82f6" fontSize="10" textAnchor="middle" transform="rotate(-11 100 40)">Mean Slope</text>
                      </svg>
                    </div>
                  </div>
                  <p className="text-2xl font-black text-white">{stats.avgGradient} <span className="text-sm font-normal text-[#9CA3AF]">%</span></p>
                </div>
              </div>

              <div className="glass-panel p-5 rounded-xl border border-[#1F293D]">
                <h4 className="text-sm font-bold text-white mb-4">Terrain Composition (Total: {stats.totalDist} km)</h4>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#9CA3AF] flex items-center gap-1"><TrendingUp className="w-3 h-3 text-red-400"/> Ascending</span>
                      <span className="text-white font-bold">{stats.ascending} km ({((stats.ascending / stats.totalDist) * 100).toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-[#161D30] rounded-full h-2">
                      <div className="bg-red-500 h-2 rounded-full" style={{ width: `${(stats.ascending / stats.totalDist) * 100}%` }}></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#9CA3AF] flex items-center gap-1"><TrendingDown className="w-3 h-3 text-blue-400"/> Descending</span>
                      <span className="text-white font-bold">{stats.descending} km ({((stats.descending / stats.totalDist) * 100).toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-[#161D30] rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(stats.descending / stats.totalDist) * 100}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#9CA3AF] flex items-center gap-1"><GripHorizontal className="w-3 h-3 text-green-400"/> Flat</span>
                      <span className="text-white font-bold">{stats.flat} km ({((stats.flat / stats.totalDist) * 100).toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-[#161D30] rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(stats.flat / stats.totalDist) * 100}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {chartData && (
                <div className="glass-panel p-6 rounded-2xl border border-[#1F293D] h-72 bg-[#0B0F19]">
                  <h4 className="text-xs text-[#9CA3AF] font-bold uppercase tracking-widest mb-4">Gradient Profile Chart</h4>
                  <ResponsiveContainer width="100%" height="80%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" vertical={false} />
                      <XAxis dataKey="distance" name="Distance" unit=" km" stroke="#9CA3AF" fontSize={11} minTickGap={30} tickFormatter={(v) => v + 'km'} />
                      <YAxis dataKey="gradient" name="Gradient" unit="%" stroke="#9CA3AF" fontSize={11} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#161D30', borderColor: '#1F293D', borderRadius: '8px', color: '#fff' }}
                        labelStyle={{ color: '#9CA3AF' }}
                        formatter={(value: any) => [`${value?.toFixed(1)}%`, 'Gradient']}
                        labelFormatter={(label) => `Distance: ${label} km`}
                      />
                      <Area type="monotone" dataKey="gradient" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#colorGrad)" animationDuration={1500} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
