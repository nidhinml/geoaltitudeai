import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, ZoomControl, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { 
  Mountain, MapPin, TrendingUp, TrendingDown, Maximize2, 
  Minimize2, RefreshCw, Download, Activity, Play,
  Undo2, Save, Map as MapIcon, Layers, Car, Ruler, Search, Plus, X, Eye, EyeOff, Info
} from 'lucide-react';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api');

// Custom Marker Icon
const dotIcon = new L.DivIcon({
  className: 'custom-dot-icon',
  html: `<div class="w-3 h-3 bg-[#3b82f6] border-2 border-white rounded-full shadow-lg"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRadian = (angle: number) => (Math.PI / 180) * angle;
  const distance = (a: number, b: number) => (Math.PI / 180) * (a - b);
  const RADIUS_OF_EARTH_IN_KM = 6371;

  const dLat = distance(lat2, lat1);
  const dLon = distance(lon2, lon1);

  lat1 = toRadian(lat1);
  lat2 = toRadian(lat2);

  const a = Math.pow(Math.sin(dLat / 2), 2) + Math.pow(Math.sin(dLon / 2), 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.asin(Math.sqrt(a));

  return RADIUS_OF_EARTH_IN_KM * c; // returns distance in km
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

export default function ElevationProfile() {
  const [routePoints, setRoutePoints] = useState<{lat: number, lon: number}[]>([]);
  const [profileData, setProfileData] = useState<any[] | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [mapStyle, setMapStyle] = useState<'street' | 'satellite'>('street');
  const [routingMode, setRoutingMode] = useState<'manual' | 'auto'>('manual');
  const [keralaGeoJSON, setKeralaGeoJSON] = useState<any>(null);
  const [locationNames, setLocationNames] = useState<Record<number, string>>({});
  const [waypointIndices, setWaypointIndices] = useState<number[]>([]);
  const [searchLocations, setSearchLocations] = useState<string[]>(['', '']);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showMapTutorial, setShowMapTutorial] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/kerala.geojson')
      .then(res => res.json())
      .then(data => setKeralaGeoJSON(data))
      .catch(console.error);
  }, []);

  const MapClickHandler = () => {
    useMapEvents({
      async click(e) {
        if (loading) return;
        const lat = e.latlng.lat;
        const lon = e.latlng.lng;
        
        if (keralaGeoJSON) {
          const pt = point([lon, lat]);
          const isInside = keralaGeoJSON.features.some((feature: any) => booleanPointInPolygon(pt, feature));
          if (!isInside) {
            alert("This point is outside the trained region. Please select a point within Kerala.");
            return;
          }
        }
        if (routingMode === 'auto' && routePoints.length > 0) {
          setLoading(true);
          const lastPoint = routePoints[routePoints.length - 1];
          try {
            const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${lastPoint.lon},${lastPoint.lat};${lon},${lat}?overview=full&geometries=geojson`);
            if (res.ok) {
              const data = await res.json();
              if (data.routes && data.routes.length > 0) {
                const coords = data.routes[0].geometry.coordinates;
                const newRoute = coords.map((c: number[]) => ({ lat: c[1], lon: c[0] }));
                setRoutePoints(prev => [...prev, ...newRoute.slice(1)]);
              } else {
                setRoutePoints(prev => [...prev, { lat, lon }]);
              }
            } else {
              setRoutePoints(prev => [...prev, { lat, lon }]);
            }
          } catch (e) {
            setRoutePoints(prev => [...prev, { lat, lon }]);
          }
          setLoading(false);
        } else {
          setRoutePoints(prev => [...prev, { lat, lon }]);
        }
        
        setProfileData(null); // Reset profile when route changes
      }
    });
    return null;
  };

  const clearRoute = () => {
    setRoutePoints([]);
    setProfileData(null);
    setStats(null);
    setLocationNames({});
    setWaypointIndices([]);
    setSearchLocations(['', '']);
  };

  const forwardGeocode = async (query: string) => {
    try {
      // TODO: CHECKPOINT - Pre-Production Geocoder 
      // Switch back to OpenStreetMap for production hosting.
      // Production URL: `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
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
          setProfileData(null);
        } else {
          setRoutePoints(pts);
        }
      } else {
        setRoutePoints(pts);
      }
    } catch (e) {
      setRoutePoints(pts);
    }
    
    setLoading(false);
  };

  const removePoint = (index: number) => {
    setRoutePoints(prev => prev.filter((_, i) => i !== index));
    setProfileData(null);
  };

  const undoLastPoint = () => {
    setRoutePoints(prev => prev.slice(0, -1));
    setProfileData(null);
  };

  const saveRouteToGeoJSON = () => {
    if (routePoints.length < 2) return alert("Not enough points to save a route.");
    const geojson = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: { name: "GeoAltitude Route Profile", generatedAt: new Date().toISOString() },
        geometry: {
          type: "LineString",
          coordinates: routePoints.map(pt => [pt.lon, pt.lat])
        }
      }]
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geoaltitude_route_${new Date().getTime()}.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const fetchLocationNames = async (chartData: any[], indices: number[]) => {
    setLocationNames({});
    for (let i of indices) {
      try {
        const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${chartData[i].lat}&longitude=${chartData[i].lon}&localityLanguage=en`);
        if (res.ok) {
          const data = await res.json();
          const name = data.locality || data.city || data.principalSubdivision;
          if (name) {
            setLocationNames(prev => ({ ...prev, [i]: name }));
          }
        }
      } catch (e) {
        console.warn("Geocoding error", e);
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  };

  const generateProfile = async () => {
    if (routePoints.length < 2) {
      alert("Please select at least 2 points to generate a route profile.");
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
      let totalGain = 0;
      let totalLoss = 0;
      let maxSlope = 0;
      let maxEle = -Infinity;
      let minEle = Infinity;
      let sumEle = 0;
      
      const chartData = predictions.map((pt, i) => {
        let dist = 0;
        let delta = 0;
        if (i > 0) {
          dist = haversineDistance(predictions[i-1].lat, predictions[i-1].lon, pt.lat, pt.lon);
          totalDist += dist;
          delta = pt.altitude - predictions[i-1].altitude;
          if (delta > 0) totalGain += delta;
          if (delta < 0) totalLoss += Math.abs(delta);
          const slope = Math.abs(delta) / (dist * 1000 || 1); // slope in m/m
          if (slope > maxSlope) maxSlope = slope;
        }
        if (pt.altitude > maxEle) maxEle = pt.altitude;
        if (pt.altitude < minEle) minEle = pt.altitude;
        sumEle += pt.altitude;
        
        return {
          distance: parseFloat(totalDist.toFixed(2)),
          altitude: parseFloat(pt.altitude.toFixed(1)),
          lat: pt.lat,
          lon: pt.lon
        };
      });

      setStats({
        maxEle: parseFloat(maxEle.toFixed(1)),
        minEle: parseFloat(minEle.toFixed(1)),
        avgEle: parseFloat((sumEle / predictions.length).toFixed(1)),
        totalGain: parseFloat(totalGain.toFixed(1)),
        totalLoss: parseFloat(totalLoss.toFixed(1)),
        totalDist: parseFloat(totalDist.toFixed(2)),
        maxSlope: parseFloat((maxSlope * 100).toFixed(1)) // % grade
      });
      
      setProfileData(chartData);
      
      let wIndices = [];
      let targetPoints = Math.floor(totalDist / 2);
      if (targetPoints < 30) targetPoints = 30;
      if (targetPoints > 70) targetPoints = 70;
      targetPoints = Math.min(targetPoints, chartData.length);
      
      if (chartData.length <= targetPoints) {
        wIndices = chartData.map((_, i) => i);
      } else {
        const step = (chartData.length - 1) / (targetPoints - 1);
        for (let i = 0; i < targetPoints; i++) {
          wIndices.push(Math.round(i * step));
        }
      }
      setWaypointIndices(wIndices);
      fetchLocationNames(chartData, wIndices);
    } catch (err) {
      console.error(err);
      alert("Error generating profile. Ensure the AI backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    try {
      const canvas = await html2canvas(reportRef.current, { backgroundColor: '#080B11' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`elevation_profile_${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Failed to generate PDF.");
    }
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col lg:flex-row gap-6 overflow-hidden">
      
      {/* LEFT PANE: Interactive Route Map */}
      <div className="flex-1 lg:flex-[1.5] relative rounded-2xl overflow-hidden border border-[#1F293D] shadow-2xl bg-[#0B0F19]">
        <div className="absolute top-4 left-4 z-[400] bg-black/70 backdrop-blur-md border border-white/10 p-4 rounded-xl shadow-xl w-64 pointer-events-auto">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="w-5 h-5 text-[#3b82f6]" />
            <h3 className="text-white font-bold text-sm">Route Builder</h3>
          </div>
          <p className="text-xs text-[#9CA3AF] mb-4">Click multiple points on the map to draw a route. (Points selected: {routePoints.length})</p>
          
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
                  className="w-full bg-[#161D30] border border-[#1F293D] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#3b82f6]" 
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
              className="w-full py-1.5 border border-dashed border-[#1F293D] hover:border-[#3b82f6] text-[#9CA3AF] hover:text-[#3b82f6] text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add Stop
            </button>
            <button onClick={handleTextSearch} disabled={loading} className="w-full mt-1 py-1.5 bg-[#22c55e] hover:bg-[#16a34a] text-black text-xs font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1 shadow-neon">
              <Search className="w-3 h-3" /> Search & Plot Route
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
              <button 
                onClick={clearRoute} 
                disabled={loading || routePoints.length === 0}
                className="flex-1 py-2 bg-[#161D30] hover:bg-red-500/20 text-white hover:text-red-400 text-xs font-bold rounded-lg transition-colors border border-[#1F293D]"
              >
                Clear
              </button>
              <button 
                onClick={undoLastPoint} 
                disabled={loading || routePoints.length === 0}
                className="flex-1 py-2 bg-[#161D30] hover:bg-[#1F293D] text-white text-xs font-bold rounded-lg transition-colors border border-[#1F293D] flex items-center justify-center gap-1"
              >
                <Undo2 className="w-3 h-3" /> Undo
              </button>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={saveRouteToGeoJSON} 
                disabled={routePoints.length < 2}
                className="flex-1 py-2 bg-[#161D30] hover:bg-[#1F293D] text-white text-xs font-bold rounded-lg transition-colors border border-[#1F293D] flex items-center justify-center gap-1"
              >
                <Save className="w-3 h-3 text-[#22c55e]" /> Save
              </button>
              <button 
                onClick={generateProfile} 
                disabled={loading || routePoints.length < 2}
                className="flex-1 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 shadow-neon"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
                Generate
              </button>
            </div>
          </div>
        </div>

        <div className="absolute top-4 right-4 z-[400] bg-black/70 backdrop-blur-md border border-white/10 p-1.5 rounded-xl shadow-xl pointer-events-auto">
          <button 
            onClick={() => setMapStyle(prev => prev === 'street' ? 'satellite' : 'street')}
            className="flex items-center gap-2 px-3 py-2 bg-[#161D30] hover:bg-[#1F293D] text-white text-xs font-bold rounded-lg transition-colors border border-white/10"
          >
            {mapStyle === 'street' ? <Layers className="w-4 h-4 text-[#3b82f6]" /> : <MapIcon className="w-4 h-4 text-[#22c55e]" />}
            {mapStyle === 'street' ? 'Switch to Satellite' : 'Switch to Street'}
          </button>
        </div>
        
        <MapContainer 
          center={[10.8505, 76.2711]} 
          zoom={7} 
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          className="z-0"
        >
          {mapStyle === 'satellite' ? (
            <TileLayer
              key="satellite"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri"
            />
          ) : (
            <TileLayer
              key="street"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            />
          )}
          <ZoomControl position="bottomleft" />
          <MapClickHandler />
          <MapUpdater routePoints={routePoints} />
          
          {keralaGeoJSON && (
            <GeoJSON 
              data={keralaGeoJSON}
              style={{ color: '#3b82f6', weight: 2, fillColor: '#3b82f6', fillOpacity: 0.1 }}
            />
          )}

          {routePoints.map((pt, i) => (
            <Marker 
              key={i} 
              position={[pt.lat, pt.lon]} 
              icon={dotIcon} 
              eventHandlers={{
                click: () => removePoint(i)
              }}
            />
          ))}
          {routePoints.length > 1 && (
            <Polyline positions={routePoints.map(p => [p.lat, p.lon])} color="#3b82f6" weight={3} dashArray="5, 10" />
          )}
        </MapContainer>
      </div>

      {/* RIGHT PANE: Elevation Profile & Stats */}
      <div className="flex-1 lg:flex-[1.5] overflow-y-auto custom-scrollbar pr-2 pb-10" ref={reportRef}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Mountain className="w-6 h-6 text-[#22c55e]" /> Route Elevation Profile
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
            {profileData && (
              <button onClick={downloadPDF} className="flex items-center gap-2 px-3 py-1.5 bg-[#1F293D] hover:bg-[#263554] text-white text-xs font-bold rounded-lg transition-all border border-white/10">
                <Download className="w-4 h-4" /> Export PDF
              </button>
            )}
          </div>
        </div>

        {/* USER GUIDE */}
        {showUserGuide && (
        <div className="glass-panel p-5 rounded-2xl border border-[#1F293D] mb-6 bg-[#0B0F19]">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-[#22c55e]" /> How to Use This Page
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-[#9CA3AF]">
            <li><strong>Define a Route:</strong> Click the map to set waypoints, or use the Route Builder search box to automatically find locations.</li>
            <li><strong>Auto-Routing vs Manual:</strong> Toggle between "Auto Route" to snap to roads (via OSRM) or "Manual Line" for straight-line connections.</li>
            <li><strong>Analyze:</strong> Click the <strong className="text-[#3b82f6]">Generate</strong> button below the map.</li>
            <li><strong>Review Profile:</strong> The system extracts altitudes for hundreds of points along the route to build a 2D elevation cross-section, calculating total climb and max slope.</li>
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
                 <strong className="text-white">Data Pipeline:</strong> We sample points along this OSRM route and stream them to our Python FastAPI backend. The <strong className="text-[#f97316]">XGBoost Model</strong> predicts the altitude for each point, rendering the full elevation cross-section.
               </p>
            </div>
          </div>
        </div>
        )}

        {/* HOW IT WORKS (AI & PHYSICS MODEL) */}
        {showTutorial && (
        <div className="glass-panel p-5 rounded-2xl border border-[#1F293D] mb-6 bg-[#0B0F19]">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <Mountain className="w-4 h-4 text-[#22c55e]" /> How it Works (AI & Physics Model)
          </h3>
          <div className="flex flex-col xl:flex-row gap-6 items-center">
            <div className="w-full xl:w-1/3 bg-[#161D30] rounded-xl border border-[#1F293D] p-4 flex items-center justify-center relative overflow-hidden h-32">
              <svg viewBox="0 0 200 100" className="w-full h-full">
                <path d="M 10 90 Q 50 20 100 80 T 190 30" fill="none" stroke="#22c55e" strokeWidth="4" />
                
                <motion.circle 
                  cx="10" cy="90" r="4" fill="white"
                  animate={{ cx: [10, 50, 100, 145, 190], cy: [90, 50, 80, 55, 30] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                />
              </svg>
            </div>
            
            <div className="w-full xl:w-2/3 space-y-3">
               <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                 <strong className="text-white">The Math (Trigonometric Trajectory Tracking):</strong> The AI connects the predicted altitude coordinates by running Haversine calculations over the route array:
               </p>
               <div className="bg-[#161D30] p-2 rounded border border-[#1F293D] font-mono text-[10px] text-[#22c55e] space-y-1">
                 <p>Total Dist = Σ Haversine(P_i, P_i+1)</p>
                 <p className="text-[#9CA3AF]">Δ Elev = Alt(P_i+1) - Alt(P_i)</p>
                 <p className="text-[#f97316]">If Δ Elev &gt; 0: Gain += Δ Elev</p>
               </div>
               <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                 <strong className="text-white">Why we take it:</strong> By measuring every incremental rise and fall along the trajectory path, we accurately compute the Total Elevation Gain/Loss and Maximum Steepness (%) for long-haul routes.
               </p>
            </div>
          </div>
        </div>
        )}

        {!profileData ? (
          <div className="glass-panel h-64 rounded-2xl border border-[#1F293D] flex flex-col items-center justify-center text-center p-10 bg-[#0B0F19]">
            <Activity className="w-12 h-12 text-[#3b82f6]/20 mb-4 animate-pulse" />
            <p className="text-white font-bold">Waiting for route definition</p>
            <p className="text-xs text-[#9CA3AF] mt-2">Draw a route on the map and click Generate.</p>
          </div>
        ) : (
          <AnimatePresence>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              
              {/* Profile Chart */}
              <div className="glass-panel p-6 rounded-2xl border border-[#1F293D] h-72 bg-[#0B0F19]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={profileData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAlt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" vertical={false} />
                    <XAxis dataKey="distance" name="Distance" unit=" km" stroke="#9CA3AF" fontSize={11} minTickGap={30} tickFormatter={(v) => v + 'km'} />
                    <YAxis dataKey="altitude" name="Elevation" unit="m" stroke="#9CA3AF" fontSize={11} domain={['auto', 'auto']} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#161D30', borderColor: '#1F293D', borderRadius: '8px', color: '#fff' }}
                      labelStyle={{ color: '#9CA3AF' }}
                      formatter={(value: any) => [`${value?.toFixed(1)}m`, 'Altitude']}
                      labelFormatter={(label) => `Distance: ${label} km`}
                    />
                    <Area type="monotone" dataKey="altitude" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorAlt)" animationDuration={1500} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="glass-panel p-4 rounded-xl border border-[#1F293D]">
                  <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mb-1 flex items-center gap-1"><Maximize2 className="w-3 h-3 text-red-400" /> Highest Point</p>
                  <p className="text-xl font-black text-white">{stats.maxEle} <span className="text-xs font-normal text-[#9CA3AF]">m</span></p>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-[#1F293D]">
                  <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mb-1 flex items-center gap-1"><Minimize2 className="w-3 h-3 text-blue-400" /> Lowest Point</p>
                  <p className="text-xl font-black text-white">{stats.minEle} <span className="text-xs font-normal text-[#9CA3AF]">m</span></p>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-[#1F293D]">
                  <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mb-1 flex items-center gap-1"><Activity className="w-3 h-3 text-yellow-400" /> Avg Elevation</p>
                  <p className="text-xl font-black text-white">{stats.avgEle} <span className="text-xs font-normal text-[#9CA3AF]">m</span></p>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-[#1F293D]">
                  <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3 text-green-400" /> Total Gain</p>
                  <p className="text-xl font-black text-green-400">+{stats.totalGain} <span className="text-xs font-normal">m</span></p>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-[#1F293D]">
                  <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mb-1 flex items-center gap-1"><TrendingDown className="w-3 h-3 text-red-400" /> Total Loss</p>
                  <p className="text-xl font-black text-red-400">-{stats.totalLoss} <span className="text-xs font-normal">m</span></p>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-[#1F293D]">
                  <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mb-1 flex items-center gap-1"><Mountain className="w-3 h-3 text-purple-400" /> Route Distance</p>
                  <p className="text-xl font-black text-white">{stats.totalDist} <span className="text-xs font-normal text-[#9CA3AF]">km</span></p>
                </div>
              </div>

              {/* Route Waypoints (For PDF Context) */}
              <div className="glass-panel p-4 rounded-xl border border-[#1F293D] mt-4">
                <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mb-3 flex items-center gap-1"><MapPin className="w-3 h-3 text-[#3b82f6]" /> Route Waypoints</p>
                <div className="flex flex-wrap gap-2">
                  {profileData && waypointIndices.map((index, i) => {
                    const pt = profileData[index];
                    return (
                      <div key={i} className="bg-[#161D30] border border-[#1F293D] rounded-lg px-2 py-1 text-[10px] text-white font-mono flex items-center gap-2">
                        <span className="text-[#3b82f6] font-bold">P{i+1}</span>
                        <span>{locationNames[index] ? `${locationNames[index]} (${pt.lat.toFixed(2)}°, ${pt.lon.toFixed(2)}°)` : `${pt.lat.toFixed(4)}°, ${pt.lon.toFixed(4)}°`}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
