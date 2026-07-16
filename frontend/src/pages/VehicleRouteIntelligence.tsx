import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Navigation, Radar, Mountain, Compass, MapPin, 
  Clock, Zap, Fuel, AlertCircle, FileText, Download,
  Activity, ArrowDown, ArrowUp, Info, Map as MapIcon, Eye, EyeOff, CheckCircle, Brain, Search, Plus, Undo2, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import { 
  ComposedChart, AreaChart, Area, Scatter, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api');

const GlassCard = ({ title, icon: Icon, children, className = '', action }: any) => (
  <div className={`glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col ${className}`}>
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#3b82f6]/10 text-[#3b82f6] rounded-lg border border-[#3b82f6]/20">
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-bold text-white tracking-wide">{title}</h3>
      </div>
      {action}
    </div>
    <div className="flex-1 min-h-0">{children}</div>
  </div>
);

const customIcon = new L.DivIcon({
  className: 'custom-marker',
  html: `<div class="w-4 h-4 bg-[#3b82f6] border-2 border-white rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

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

export default function VehicleRouteIntelligence() {
  const [inputMethod, setInputMethod] = useState<'csv' | 'map'>('csv');
  
  // CSV State
  const [file, setFile] = useState<File | null>(null);
  
  // Map State
  const [routePoints, setRoutePoints] = useState<{lat: number, lon: number}[]>([]);
  const [searchLocations, setSearchLocations] = useState<string[]>(['', '']);
  const [routingMode, setRoutingMode] = useState<'manual' | 'auto'>('manual');
  const [mapStyle, setMapStyle] = useState<'osm' | 'satellite'>('osm');
  const [keralaGeoJSON, setKeralaGeoJSON] = useState<any>(null);

  // Physics Config State
  const [vehicleCategory, setVehicleCategory] = useState<'truck' | 'bus' | 'car' | 'bike'>('truck');
  const [fuelType, setFuelType] = useState<'diesel' | 'petrol' | 'ev'>('diesel');
  const [baseMileage, setBaseMileage] = useState<number>(3.0);
  const [mockSpeed, setMockSpeed] = useState<number>(40.0);

  // Common State
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const dashboardRef = useRef<HTMLDivElement>(null);

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
      }
    });
    return null;
  };

  const forwardGeocode = async (query: string) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      if (res.ok) {
        const d = await res.json();
        if (d && d.length > 0) return { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon) };
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
      if (!pt) { setLoading(false); return alert(`Could not find coordinates for: ${loc}`); }
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
        } else setRoutePoints(pts);
      } else setRoutePoints(pts);
    } catch (e) { setRoutePoints(pts); }
    setLoading(false);
  };

  const analyzeDrawnRoute = async () => {
    if (routePoints.length < 2) return alert("Please draw a route with at least 2 points.");
    setLoading(true);
    setError(null);
    setData(null);

    // Generate mock CSV data
    const csvRows = ['latitude,longitude,speed,timestamp'];
    let currentTime = new Date('2023-01-01T00:00:00Z').getTime();
    
    for (let i = 0; i < routePoints.length; i++) {
      const pt = routePoints[i];
      const isoTime = new Date(currentTime).toISOString();
      csvRows.push(`${pt.lat},${pt.lon},${mockSpeed},${isoTime}`);
      currentTime += 1000; // Increment 1 second
    }

    const csvBlob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const mockFile = new File([csvBlob], "drawn_route.csv", { type: "text/csv" });
    setFile(mockFile); // Sync state

    const formData = new FormData();
    formData.append('file', mockFile);
    formData.append('vehicle_category', vehicleCategory);
    formData.append('fuel_type', fuelType);
    formData.append('mileage', baseMileage.toString());

    try {
      const response = await fetch(`${API_BASE}/routes/analyze`, { method: 'POST', body: formData });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to analyze route");
      }
      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setData(null);
    }
  };

  const handleAnalyzeCSV = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setData(null);
    
    const formData = new FormData();
    formData.append('file', file);
    // Use defaults for CSV since user requested not to show config panel here
    formData.append('vehicle_category', 'truck');
    formData.append('fuel_type', 'diesel');
    formData.append('mileage', '3.0');
    
    try {
      const response = await fetch(`${API_BASE}/routes/analyze`, { method: 'POST', body: formData });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to analyze route");
      }
      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    if (!dashboardRef.current) return;
    try {
      const canvas = await html2canvas(dashboardRef.current, { backgroundColor: '#0B0F19' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`route_report_${new Date().getTime()}.pdf`);
    } catch (e) {
      console.error("PDF Export failed", e);
    }
  };

  const exportCSV = () => {
    if (!data) return;
    const csvRows = [];
    const headers = ['Distance (km)', 'Altitude (m)', 'Speed (km/h)', 'Gradient (%)'];
    csvRows.push(headers.join(','));
    for (const row of data.chart_data) {
      csvRows.push(`${row.distance_km},${row.altitude},${row.speed},${row.gradient}`);
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `route_data_${new Date().getTime()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-20">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-black text-white flex items-center gap-3">
          <Navigation className="w-8 h-8 text-[#3b82f6]" />
          Vehicle Route Intelligence
        </h1>
      </div>

      {/* Input Section */}
      {!data && (
        <div className="glass-panel p-6 rounded-xl border border-[#1F293D]">
          
          <div className="flex gap-4 mb-6 border-b border-[#1F293D] pb-4">
            <button 
              onClick={() => { setInputMethod('csv'); setError(null); }}
              className={`px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all ${inputMethod === 'csv' ? 'bg-[#3b82f6] text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-[#161D30] text-[#9CA3AF] border border-[#374151] hover:text-white'}`}
            >
              <FileText className="w-4 h-4" /> CSV Upload
            </button>
            <button 
              onClick={() => { setInputMethod('map'); setError(null); }}
              className={`px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all ${inputMethod === 'map' ? 'bg-[#3b82f6] text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-[#161D30] text-[#9CA3AF] border border-[#374151] hover:text-white'}`}
            >
              <MapIcon className="w-4 h-4" /> Interactive Map
            </button>
          </div>

          {inputMethod === 'csv' ? (
            <div className="flex flex-col items-center justify-center text-center p-8">
              <Upload className="w-16 h-16 text-[#3b82f6] mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Upload AIS-140 GPS Route Data</h3>
              <p className="text-[#9CA3AF] max-w-md mb-8 text-sm">
                Select a CSV file containing <code className="text-white bg-white/10 px-1 rounded">latitude</code>, 
                <code className="text-white bg-white/10 px-1 rounded">longitude</code>, 
                <code className="text-white bg-white/10 px-1 rounded">speed</code>, and 
                <code className="text-white bg-white/10 px-1 rounded">timestamp</code> columns.
              </p>
              
              <div className="flex items-center gap-4">
                <label className="cursor-pointer px-6 py-3 bg-[#161D30] border border-[#1F293D] rounded-lg text-white font-bold hover:bg-[#1F293D] transition-colors">
                  <span>Choose CSV File</span>
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                </label>
                
                <button 
                  onClick={handleAnalyzeCSV}
                  disabled={!file || loading}
                  className={`px-6 py-3 rounded-lg font-bold flex items-center gap-2 ${file && !loading ? 'bg-[#3b82f6] hover:bg-[#2563eb] text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-[#1F293D] text-gray-500 cursor-not-allowed'}`}
                >
                  {loading ? <span className="animate-pulse">Analyzing...</span> : <span><Activity className="w-5 h-5 inline-block mr-2" /> Analyze</span>}
                </button>
              </div>
              
              {file && <p className="text-green-400 mt-4 font-mono text-sm">Selected: {file.name}</p>}
              {error && <p className="text-red-400 mt-4 font-bold bg-red-400/10 p-3 rounded-lg border border-red-400/20">{error}</p>}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col lg:flex-row gap-4 mb-4">
                <div className="flex-1 flex flex-col gap-2">
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-green-500" />
                    <input 
                      type="text" 
                      placeholder="Start Location (e.g. Munnar)" 
                      value={searchLocations[0]}
                      onChange={(e) => {
                        const newLocs = [...searchLocations];
                        newLocs[0] = e.target.value;
                        setSearchLocations(newLocs);
                      }}
                      className="w-full bg-[#080B11] border border-[#1F293D] rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-[#3b82f6]"
                    />
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-red-500" />
                    <input 
                      type="text" 
                      placeholder="End Location (e.g. Kochi)" 
                      value={searchLocations[1]}
                      onChange={(e) => {
                        const newLocs = [...searchLocations];
                        newLocs[1] = e.target.value;
                        setSearchLocations(newLocs);
                      }}
                      className="w-full bg-[#080B11] border border-[#1F293D] rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-[#3b82f6]"
                    />
                  </div>
                  <button 
                    onClick={handleTextSearch}
                    disabled={loading}
                    className="w-full bg-[#1F293D] hover:bg-[#374151] text-white py-2 rounded-lg font-bold flex justify-center items-center gap-2 transition-colors border border-[#374151]"
                  >
                    <Search className="w-4 h-4" /> {loading ? "Searching..." : "Find Route"}
                  </button>
                </div>
                
                <div className="flex-1 flex flex-col gap-2">
                  <div className="bg-[#080B11] border border-[#1F293D] rounded-lg p-4 h-full">
                    <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Brain className="w-4 h-4 text-[#a855f7]" /> AI Physics Configuration</h4>
                    
                    <div className="grid grid-cols-2 gap-4 text-xs mb-4">
                      <div>
                        <label className="block text-[#9CA3AF] mb-1">Vehicle Category</label>
                        <select value={vehicleCategory} onChange={(e: any) => setVehicleCategory(e.target.value)} className="w-full bg-[#161D30] border border-[#374151] rounded p-2 text-white outline-none">
                          <option value="truck">Heavy Truck</option>
                          <option value="bus">Bus</option>
                          <option value="car">Car</option>
                          <option value="bike">Motorcycle</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[#9CA3AF] mb-1">Fuel Type</label>
                        <select value={fuelType} onChange={(e: any) => setFuelType(e.target.value)} className="w-full bg-[#161D30] border border-[#374151] rounded p-2 text-white outline-none">
                          <option value="diesel">Diesel</option>
                          <option value="petrol">Petrol</option>
                          <option value="ev">Electric (EV)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[#9CA3AF] mb-1">Base Mileage ({fuelType === 'ev' ? 'km/kWh' : 'km/L'})</label>
                        <input type="number" step="0.1" value={baseMileage} onChange={(e) => setBaseMileage(parseFloat(e.target.value))} className="w-full bg-[#161D30] border border-[#374151] rounded p-2 text-white outline-none" />
                      </div>
                      <div>
                        <label className="block text-[#9CA3AF] mb-1">Avg Speed (km/h)</label>
                        <input type="number" value={mockSpeed} onChange={(e) => setMockSpeed(parseFloat(e.target.value))} className="w-full bg-[#161D30] border border-[#374151] rounded p-2 text-white outline-none" />
                      </div>
                    </div>
                    
                    <div className="border-t border-[#1F293D] pt-3 mt-2">
                      <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><Info className="w-4 h-4 text-[#3b82f6]" /> Map Controls</h4>
                      <div className="flex items-center gap-4 text-xs mb-2">
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input type="radio" name="mode" checked={routingMode === 'auto'} onChange={() => setRoutingMode('auto')} className="text-[#3b82f6] bg-[#161D30] border-[#374151]" /> 
                        Auto-snap to roads (OSRM)
                      </label>
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input type="radio" name="mode" checked={routingMode === 'manual'} onChange={() => setRoutingMode('manual')} className="text-[#3b82f6] bg-[#161D30] border-[#374151]" /> 
                        Straight Lines
                      </label>
                    </div>
                    <p className="text-xs text-[#9CA3AF] mt-3 mb-2">Map Style</p>
                    <div className="flex items-center gap-4 text-xs">
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input type="radio" name="mapstyle" checked={mapStyle === 'osm'} onChange={() => setMapStyle('osm')} className="text-[#3b82f6] bg-[#161D30] border-[#374151]" /> 
                        OpenStreetMap
                      </label>
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input type="radio" name="mapstyle" checked={mapStyle === 'satellite'} onChange={() => setMapStyle('satellite')} className="text-[#3b82f6] bg-[#161D30] border-[#374151]" /> 
                        Satellite
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-[400px] w-full rounded-xl overflow-hidden border border-[#1F293D] relative">
                <MapContainer center={[10.8505, 76.2711]} zoom={7} className="w-full h-full" zoomControl={false}>
                  <TileLayer url={mapStyle === 'osm' ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"} />
                  <MapClickHandler />
                  <MapUpdater routePoints={routePoints} />
                  
                  {routePoints.length > 0 && (
                    <Polyline positions={routePoints.map(p => [p.lat, p.lon])} pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.8 }} />
                  )}
                  {routePoints.map((pt, idx) => (
                    <CircleMarker key={idx} center={[pt.lat, pt.lon]} radius={5} pathOptions={{ color: idx === 0 ? '#22c55e' : idx === routePoints.length - 1 ? '#ef4444' : '#3b82f6', fillColor: idx === 0 ? '#22c55e' : idx === routePoints.length - 1 ? '#ef4444' : '#3b82f6', fillOpacity: 1 }} />
                  ))}
                </MapContainer>
                
                {/* Floating Tools */}
                <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
                  <button onClick={() => setRoutePoints(prev => prev.slice(0, -1))} disabled={routePoints.length === 0} className="p-2 bg-[#161D30] border border-[#374151] rounded-lg text-white hover:bg-[#1F293D] disabled:opacity-50" title="Undo Last Point"><Undo2 className="w-5 h-5" /></button>
                  <button onClick={() => { setRoutePoints([]); setSearchLocations(['','']); }} disabled={routePoints.length === 0} className="p-2 bg-[#161D30] border border-[#374151] rounded-lg text-white hover:bg-[#1F293D] disabled:opacity-50" title="Clear Map"><X className="w-5 h-5" /></button>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="text-sm text-[#9CA3AF]">
                  <span className="font-bold text-white">{routePoints.length}</span> points selected
                </div>
                <button 
                  onClick={analyzeDrawnRoute}
                  disabled={routePoints.length < 2 || loading}
                  className={`px-6 py-3 rounded-lg font-bold flex items-center gap-2 ${routePoints.length >= 2 && !loading ? 'bg-[#3b82f6] hover:bg-[#2563eb] text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-[#1F293D] text-gray-500 cursor-not-allowed'}`}
                >
                  {loading ? <span className="animate-pulse">Processing Mock Physics...</span> : <span><Activity className="w-5 h-5 inline-block mr-2" /> Analyze Drawn Route</span>}
                </button>
              </div>
              {error && <p className="text-red-400 mt-4 font-bold bg-red-400/10 p-3 rounded-lg border border-red-400/20">{error}</p>}
            </div>
          )}
        </div>
      )}

      {/* Analytics Dashboard */}
      {data && (
        <div ref={dashboardRef} className="space-y-6 p-1 rounded-xl bg-transparent">
          
          <div className="flex justify-between items-center glass-panel p-4 rounded-xl border border-[#1F293D]">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-400" />
              <h2 className="text-xl font-bold text-white">Route Analysis Complete</h2>
            </div>
            <div className="flex gap-2">
              <button onClick={exportCSV} className="px-3 py-1.5 bg-[#161D30] hover:bg-[#1F293D] text-white border border-[#374151] rounded text-sm flex items-center gap-2 transition-colors">
                <FileText className="w-4 h-4" /> CSV Report
              </button>
              <button onClick={exportPDF} className="px-3 py-1.5 bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30 rounded text-sm flex items-center gap-2 transition-colors">
                <Download className="w-4 h-4" /> PDF Report
              </button>
              <button onClick={() => { setData(null); setFile(null); setRoutePoints([]); }} className="px-3 py-1.5 bg-[#3b82f6]/10 hover:bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/30 rounded text-sm flex items-center gap-2 transition-colors">
                New Route
              </button>
            </div>
          </div>

          {/* Core KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-panel p-5 rounded-xl border border-[#1F293D]">
              <div className="text-xs text-[#9CA3AF] uppercase font-bold tracking-wider mb-1">Total Distance</div>
              <div className="text-3xl font-black text-white">{data.stats.total_distance_km} <span className="text-sm font-normal text-gray-500">km</span></div>
            </div>
            <div className="glass-panel p-5 rounded-xl border border-[#1F293D]">
              <div className="text-xs text-[#9CA3AF] uppercase font-bold tracking-wider mb-1">Travel Difficulty</div>
              <div className="text-3xl font-black text-[#f59e0b]">{data.stats.tdi} <span className="text-sm font-normal text-gray-500">/ 10</span></div>
            </div>
            <div className="glass-panel p-5 rounded-xl border border-[#1F293D]">
              <div className="text-xs text-[#9CA3AF] uppercase font-bold tracking-wider mb-1">Road Category</div>
              <div className="text-lg mt-1 font-black text-[#a855f7] leading-tight">{data.stats.road_category}</div>
            </div>
            <div className="glass-panel p-5 rounded-xl border border-[#1F293D]">
              <div className="text-xs text-[#9CA3AF] uppercase font-bold tracking-wider mb-1">Total Stops</div>
              <div className="text-3xl font-black text-white">{data.stats.total_stops} <span className="text-sm font-normal text-gray-500">halts</span></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Speed & Altitude */}
            <div className="glass-panel p-5 rounded-xl border border-[#1F293D] flex flex-col gap-4">
              <h3 className="text-sm font-bold text-[#9CA3AF] flex items-center gap-2"><Radar className="w-4 h-4" /> Physics & Speed</h3>
              <div className="flex justify-between items-center border-b border-[#1F293D] pb-3">
                <span className="text-white text-sm">Avg Speed</span>
                <span className="text-white font-bold font-mono">{data.stats.avg_speed_kmh} km/h</span>
              </div>
              <div className="flex justify-between items-center border-b border-[#1F293D] pb-3">
                <span className="text-white text-sm">Max Speed</span>
                <span className="text-white font-bold font-mono text-red-400">{data.stats.max_speed_kmh} km/h</span>
              </div>
              <div className="flex justify-between items-center border-b border-[#1F293D] pb-3">
                <span className="text-white text-sm">Avg Gradient</span>
                <span className="text-white font-bold font-mono">{data.stats.avg_gradient_pct}%</span>
              </div>
              <div className="flex justify-between items-center pb-1">
                <span className="text-white text-sm">Max Gradient</span>
                <span className="text-white font-bold font-mono text-orange-400">{data.stats.max_gradient_pct}%</span>
              </div>
            </div>

            {/* Terrain Distribution */}
            <div className="glass-panel p-5 rounded-xl border border-[#1F293D] flex flex-col gap-4">
              <h3 className="text-sm font-bold text-[#9CA3AF] flex items-center gap-2"><Mountain className="w-4 h-4" /> Terrain Dynamics</h3>
              <div className="flex justify-between items-center border-b border-[#1F293D] pb-3">
                <span className="text-white text-sm flex items-center gap-1"><ArrowUp className="w-3 h-3 text-green-400"/> Elevation Gain</span>
                <span className="text-green-400 font-bold font-mono">{data.stats.elevation_gain_m} m</span>
              </div>
              <div className="flex justify-between items-center border-b border-[#1F293D] pb-3">
                <span className="text-white text-sm flex items-center gap-1"><ArrowDown className="w-3 h-3 text-red-400"/> Elevation Loss</span>
                <span className="text-red-400 font-bold font-mono">{data.stats.elevation_loss_m} m</span>
              </div>
              <div className="flex justify-between items-center border-b border-[#1F293D] pb-3">
                <span className="text-white text-sm">Max Altitude</span>
                <span className="text-white font-bold font-mono">{data.stats.max_altitude_m} m</span>
              </div>
              <div className="flex justify-between items-center pb-1">
                <span className="text-white text-sm">Avg Altitude</span>
                <span className="text-white font-bold font-mono">{data.stats.avg_altitude_m} m</span>
              </div>
            </div>

            {/* Fuel & Energy Impact */}
            <div className="glass-panel p-5 rounded-xl border border-[#1F293D] flex flex-col gap-4 bg-gradient-to-br from-[#161D30] to-[#1a2336]">
              <h3 className="text-sm font-bold text-[#9CA3AF] flex items-center gap-2"><Fuel className="w-4 h-4" /> Estimated Consumption</h3>
              
              <div className="flex-1 flex flex-col justify-center gap-6">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-sm font-bold flex items-center gap-2 capitalize">
                      {data.config?.fuel_type === 'ev' ? <Zap className="w-4 h-4 text-[#3b82f6]" /> : <Fuel className="w-4 h-4 text-orange-400" />}
                      {data.config?.fuel_type || 'Diesel'} ({data.config?.vehicle_category || 'Truck'})
                    </span>
                  </div>
                  <div className={`text-3xl font-black font-mono ${data.config?.fuel_type === 'ev' ? 'text-[#3b82f6]' : 'text-orange-400'}`}>
                    {data.config?.fuel_type === 'ev' ? data.stats.estimated_battery_kwh : data.stats.estimated_fuel_l} 
                    <span className={`text-sm ml-1 opacity-50`}>{data.config?.fuel_type === 'ev' ? 'kWh' : 'Liters'}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Base: {data.config?.mileage} {data.config?.fuel_type === 'ev' ? 'km/kWh' : 'km/L'}. Includes {data.config?.vehicle_category} climbing penalties {data.config?.fuel_type === 'ev' && '& regen braking'}.
                  </p>
                </div>
              </div>
            </div>
            
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GIS Map */}
            <GlassCard title="Route Telemetry Map" icon={MapPin} className="h-[450px] relative">
              
              <div className="absolute top-4 right-4 z-[400] bg-[#161D30] border border-[#1F293D] rounded-lg p-1.5 flex gap-1 shadow-lg">
                <button onClick={() => setMapStyle('osm')} className={`px-2 py-1 text-xs rounded font-bold transition-colors ${mapStyle === 'osm' ? 'bg-[#3b82f6] text-white' : 'text-[#9CA3AF] hover:text-white'}`}>Street</button>
                <button onClick={() => setMapStyle('satellite')} className={`px-2 py-1 text-xs rounded font-bold transition-colors ${mapStyle === 'satellite' ? 'bg-[#3b82f6] text-white' : 'text-[#9CA3AF] hover:text-white'}`}>Satellite</button>
              </div>

              <MapContainer 
                center={[data.raw_path[0].lat, data.raw_path[0].lon]} 
                zoom={13} 
                className="w-full h-full rounded-lg"
                zoomControl={false}
              >
                <TileLayer url={mapStyle === 'osm' ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"} />
                
                <Polyline positions={data.raw_path.map((p: any) => [p.lat, p.lon])} pathOptions={{ color: mapStyle === 'satellite' ? '#60a5fa' : '#3b82f6', weight: 4, opacity: 0.8 }} />
                
                {/* Start Point */}
                <CircleMarker center={[data.raw_path[0].lat, data.raw_path[0].lon]} radius={6} pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 1 }}>
                  <Popup className="custom-popup bg-[#0B0F19] text-white">Start</Popup>
                </CircleMarker>
                
                {/* End Point */}
                <CircleMarker center={[data.raw_path[data.raw_path.length-1].lat, data.raw_path[data.raw_path.length-1].lon]} radius={6} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 }}>
                  <Popup className="custom-popup bg-[#0B0F19] text-white">End</Popup>
                </CircleMarker>

                {/* Heatmap Overlay for Steep Gradients */}
                {data.chart_data.filter((d: any) => Math.abs(d.gradient) > 8).map((pt: any, i: number) => (
                  <CircleMarker key={i} center={[pt.latitude, pt.longitude]} radius={4} pathOptions={{ color: pt.gradient > 0 ? '#ef4444' : '#f59e0b', stroke: false, fillOpacity: 0.7 }}>
                    <Popup className="custom-popup bg-[#0B0F19] text-white border border-[#1F293D] p-2 rounded text-xs">
                      Steep Gradient: {pt.gradient}%
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </GlassCard>

            {/* 3D Elevation Profile Chart */}
            <GlassCard title="3D Elevation Profile (AI Predicted)" icon={Mountain} className="h-[450px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.chart_data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAlt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" vertical={false} />
                  <XAxis dataKey="distance_km" name="Distance (km)" unit="km" stroke="#9CA3AF" />
                  <YAxis name="Altitude (m)" unit="m" stroke="#9CA3AF" domain={['auto', 'auto']} />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#161D30', borderColor: '#1F293D', borderRadius: '8px', color: '#fff' }} />
                  <Area type="monotone" dataKey="altitude" stroke="#22c55e" fillOpacity={1} fill="url(#colorAlt)" />
                </AreaChart>
              </ResponsiveContainer>
            </GlassCard>
            
            {/* Speed & Gradient Dynamics */}
            <GlassCard title="Speed vs Gradient Dynamics" icon={Activity} className="h-[400px] lg:col-span-2">
               <ResponsiveContainer width="100%" height="100%">
                 <ComposedChart data={data.chart_data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" vertical={false} />
                    <XAxis dataKey="distance_km" name="Distance (km)" unit="km" stroke="#9CA3AF" />
                    <YAxis yAxisId="left" name="Speed" unit="km/h" stroke="#3b82f6" />
                    <YAxis yAxisId="right" orientation="right" name="Gradient" unit="%" stroke="#ef4444" />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#161D30', borderColor: '#1F293D', borderRadius: '8px', color: '#fff' }} />
                    
                    <ReferenceLine y={0} yAxisId="right" stroke="#9CA3AF" strokeDasharray="3 3" />
                    <Area yAxisId="right" type="step" dataKey="gradient" fill="#ef4444" stroke="#ef4444" fillOpacity={0.2} name="Gradient (%)" />
                    <Line yAxisId="left" type="monotone" dataKey="speed" stroke="#3b82f6" strokeWidth={2} dot={false} name="Speed (km/h)" />
                 </ComposedChart>
               </ResponsiveContainer>
            </GlassCard>
          </div>
          
          {/* Timeline Summary */}
          <GlassCard title="Trip Event Timeline" icon={Clock}>
            <div className="relative border-l border-[#374151] ml-4 py-2 space-y-6">
              {data.timeline.map((item: any, idx: number) => (
                <div key={idx} className="relative pl-6">
                  <div className="absolute -left-1.5 top-1.5 w-3 h-3 bg-[#3b82f6] rounded-full ring-4 ring-[#161D30]"></div>
                  <h4 className="text-white font-bold text-sm">{item.event}</h4>
                  <div className="flex gap-4 mt-1 text-xs font-mono text-[#9CA3AF]">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {item.distance_km} km</span>
                    <span className="flex items-center gap-1"><Mountain className="w-3 h-3" /> {item.altitude.toFixed(1)} m</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
          
        </div>
      )}
      
    </div>
  );
}
