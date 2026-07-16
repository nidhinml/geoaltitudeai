import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, ZoomControl, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import { motion } from 'framer-motion';
import { 
  Activity, Play, Square, Car, Search, Plus, X, TrendingUp, Navigation, Radar, Zap, Compass, Layers, Map as MapIcon, Droplets, MountainSnow, Fuel, Info, TrendingDown, Eye, EyeOff
} from 'lucide-react';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api');

const vehicleIcon = new L.DivIcon({
  className: 'custom-vehicle-marker',
  html: `<div class="w-5 h-5 bg-[#ef4444] border-2 border-white rounded-full shadow-[0_0_15px_rgba(239,68,68,0.9)] flex items-center justify-center animate-pulse"><div class="w-1.5 h-1.5 bg-white rounded-full"></div></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

const startIcon = new L.DivIcon({
  className: 'start-marker',
  html: `<div class="w-3 h-3 bg-[#22c55e] border-2 border-white rounded-full shadow-lg"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

const RADIUS_OF_EARTH_IN_KM = 6371;
const toRadian = (degree: number) => (degree * Math.PI) / 180;
const toDegrees = (radian: number) => (radian * 180) / Math.PI;

const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const dLat = toRadian(lat2 - lat1);
  const dLon = toRadian(lon2 - lon1);
  const a = Math.pow(Math.sin(dLat / 2), 2) + Math.pow(Math.sin(dLon / 2), 2) * Math.cos(toRadian(lat1)) * Math.cos(toRadian(lat2));
  const c = 2 * Math.asin(Math.sqrt(a));
  return RADIUS_OF_EARTH_IN_KM * c;
};

const calculateHeading = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const phi1 = toRadian(lat1);
  const phi2 = toRadian(lat2);
  const deltaLambda = toRadian(lon2 - lon1);
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  let theta = Math.atan2(y, x);
  let bearing = (toDegrees(theta) + 360) % 360;
  return bearing;
};

const getCardinalDirection = (heading: number) => {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(heading / 45) % 8];
};

const getDifficulty = (gradient: number) => {
  if (gradient > 8) return { label: 'Extreme Climb', color: '#ef4444' };
  if (gradient > 5) return { label: 'Steep Climb', color: '#f97316' };
  if (gradient > 2) return { label: 'Moderate Climb', color: '#eab308' };
  if (gradient > 0.5) return { label: 'Mild Climb', color: '#84cc16' };
  if (gradient < -8) return { label: 'Steep Descent', color: '#3b82f6' };
  if (gradient < -2) return { label: 'Moderate Descent', color: '#60a5fa' };
  return { label: 'Flat Road', color: '#22c55e' };
};

const getFloodRisk = (altitude: number) => {
  if (altitude <= 5) return { level: 'Very High Risk', color: '#ef4444' };
  if (altitude <= 15) return { level: 'High Risk', color: '#f97316' };
  if (altitude <= 50) return { level: 'Moderate Risk', color: '#eab308' };
  if (altitude <= 150) return { level: 'Low Risk', color: '#22c55e' };
  return { level: 'Very Low Risk', color: '#3b82f6' };
};

const getLandslideRisk = (altitude: number, slope: number) => {
  if (altitude > 500 && slope > 15) return { level: 'Very High Risk', color: '#ef4444' };
  if ((altitude > 500 && slope > 10) || (altitude > 100 && slope > 15)) return { level: 'High Risk', color: '#f97316' };
  if (slope > 5) return { level: 'Moderate Risk', color: '#eab308' };
  if (slope > 2) return { level: 'Low Risk', color: '#22c55e' };
  return { level: 'Very Low Risk', color: '#3b82f6' };
};

const AutoPanMap = ({ center, isTracking, routePoints }: { center: {lat: number, lon: number} | null, isTracking: boolean, routePoints: any[] }) => {
  const map = useMapEvents({});
  useEffect(() => {
    if (isTracking && center) {
      map.flyTo([center.lat, center.lon], 16, { animate: true, duration: 1 });
    } else if (!isTracking && routePoints.length > 0) {
      const bounds = L.latLngBounds(routePoints.map(p => [p.lat, p.lon]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [center, isTracking, routePoints, map]);
  return null;
};

export default function VehicleIntelligence() {
  const [routePoints, setRoutePoints] = useState<{lat: number, lon: number}[]>([]);
  const [searchLocations, setSearchLocations] = useState<string[]>(['', '']);
  const [loading, setLoading] = useState(false);
  const [mapStyle, setMapStyle] = useState<'street' | 'satellite' | 'traffic'>('traffic');
  const [keralaGeoJSON, setKeralaGeoJSON] = useState<any>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showMapTutorial, setShowMapTutorial] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);
  
  const [isTracking, setIsTracking] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [currentRoad, setCurrentRoad] = useState<string>("Detecting road...");
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [fuelEstimates, setFuelEstimates] = useState<any[]>([]);
  const [totalFuelLoss, setTotalFuelLoss] = useState<number>(0);
  
  const [telemetry, setTelemetry] = useState({
    vehicleId: 'KL-01-AIS-9943',
    speed: 0,
    heading: 0,
    altitude: 0,
    gradient: 0,
    difficulty: { label: 'Stationary', color: '#9CA3AF' },
    floodRisk: { level: 'Unknown', color: '#9CA3AF' },
    landslideRisk: { level: 'Unknown', color: '#9CA3AF' },
    totalAscent: 0,
    totalDescent: 0,
    distanceTraveled: 0,
    fuelImpact: 0
  });

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/kerala.geojson')
      .then(res => res.json())
      .then(data => setKeralaGeoJSON(data))
      .catch(err => console.error("Error loading Kerala bounds", err));
  }, []);

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  const forwardGeocode = async (query: string) => {
    try {
      // TODO: CHECKPOINT - Pre-Production Geocoder 
      // Switch back to OpenStreetMap for production hosting to avoid Open-Meteo's fuzzy-search edge cases.
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

  const handleRouteSearch = async () => {
    const validLocs = searchLocations.filter(loc => loc.trim() !== '');
    if (validLocs.length < 2) return alert("Please enter at least a start and end location to generate a simulated route.");
    setLoading(true);
    
    let pts: {lat: number, lon: number}[] = [];
    
    for (let i = 0; i < validLocs.length; i++) {
      if (i > 0) await delay(1000);
      const loc = validLocs[i];
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
    
    try {
      const coordsString = pts.map(p => `${p.lon},${p.lat}`).join(';');
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`);
      if (res.ok) {
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const coords = data.routes[0].geometry.coordinates;
          const newRoute = coords.map((c: number[]) => ({ lat: c[1], lon: c[0] }));
          setRoutePoints(newRoute);
          setCurrentIndex(0);
          setHistory([]);
          setIsTracking(false);
          setTelemetry(prev => ({ ...prev, speed: 0, heading: 0, altitude: 0, gradient: 0, totalAscent: 0, totalDescent: 0, distanceTraveled: 0, fuelImpact: 0 }));
          
          try {
            const fuelRes = await fetch(`${API_BASE}/fuel/estimate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ route: newRoute.map((p: any) => ({ latitude: p.lat, longitude: p.lon })) })
            });
            if (fuelRes.ok) {
              const fuelData = await fuelRes.json();
              setFuelEstimates(fuelData.route_analysis || []);
              setTotalFuelLoss(fuelData.summary?.avg_fuel_impact || 0);
            } else {
              setFuelEstimates([]);
              setTotalFuelLoss(0);
            }
          } catch (e) {
            console.error("Failed to fetch fuel estimates", e);
            setFuelEstimates([]);
          }
        }
      }
    } catch (e) {
      alert("Failed to generate route.");
    }
    setLoading(false);
  };

  useEffect(() => {
    let timeoutId: any;

    const processNextPoint = async () => {
      if (!isTracking || currentIndex >= routePoints.length) {
        setIsTracking(false);
        return;
      }

      const currentPt = routePoints[currentIndex];
      
      try {
        const res = await fetch(`${API_BASE}/predict/live`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude: currentPt.lat, longitude: currentPt.lon })
        });
        
        if (res.ok) {
          const data = await res.json();
          const altitude = data.predicted_altitude;
          
          let gradient = telemetry.gradient;
          let heading = telemetry.heading;
          let speed = 40 + (Math.random() * 20); 
          let newAscent = telemetry.totalAscent;
          let newDescent = telemetry.totalDescent;
          let newDistance = telemetry.distanceTraveled;
          let roadName = currentRoad;
          let currentFuelImpact = 0;
          
          if (fuelEstimates.length > currentIndex) {
            currentFuelImpact = fuelEstimates[currentIndex].fuel_impact || 0;
          }
          
          if (currentIndex % 25 === 0 || currentIndex === 1) {
             fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${currentPt.lat}&lon=${currentPt.lon}&zoom=10`)
              .then(res => { if (res.ok) return res.json(); throw new Error('Geocoding failed'); })
              .then(data => {
                 if (data && data.address) {
                    const name = data.address.city || data.address.town || data.address.village || data.address.county || "Unknown Road";
                    setCurrentRoad(name);
                    roadName = name;
                 }
              }).catch(() => {});
          }

          if (currentIndex > 0 && history.length > 0) {
            let prevPt = history[history.length - 1];
            for (let i = history.length - 1; i >= 0; i--) {
               if (haversineDistance(history[i].lat, history[i].lon, currentPt.lat, currentPt.lon) > 0.15) {
                   prevPt = history[i];
                   break;
               }
            }

            const immediatePrev = history[history.length - 1];
            const distKmImmediate = haversineDistance(immediatePrev.lat, immediatePrev.lon, currentPt.lat, currentPt.lon);
            newDistance += distKmImmediate;
            
            const distKmStable = haversineDistance(prevPt.lat, prevPt.lon, currentPt.lat, currentPt.lon);
            const eleDiff = altitude - prevPt.altitude;
            
            if (distKmStable * 1000 > 0) {
              gradient = (eleDiff / (distKmStable * 1000)) * 100;
            }
            if (altitude > immediatePrev.altitude) {
               newAscent += (altitude - immediatePrev.altitude);
            } else if (altitude < immediatePrev.altitude) {
               newDescent += (immediatePrev.altitude - altitude);
            }
            
            heading = calculateHeading(immediatePrev.lat, immediatePrev.lon, currentPt.lat, currentPt.lon);
            
            if (gradient > 6) speed = 20 + (Math.random() * 10);
            if (speed > 80) speed = 80;
          }
          
          const pointData = { ...currentPt, altitude, gradient, road: roadName, timestamp: new Date().toISOString(), fuelImpact: currentFuelImpact };
          
          setHistory(prev => [...prev, pointData]);
          setTelemetry({
            vehicleId: telemetry.vehicleId,
            speed: Math.round(speed),
            heading: Math.round(heading),
            altitude: parseFloat(altitude.toFixed(1)),
            gradient: parseFloat(gradient.toFixed(1)),
            difficulty: getDifficulty(gradient),
            floodRisk: getFloodRisk(parseFloat(altitude.toFixed(1))),
            landslideRisk: getLandslideRisk(parseFloat(altitude.toFixed(1)), gradient),
            totalAscent: parseFloat(newAscent.toFixed(1)),
            totalDescent: parseFloat(newDescent.toFixed(1)),
            distanceTraveled: parseFloat(newDistance.toFixed(2)),
            fuelImpact: parseFloat(currentFuelImpact.toFixed(1))
          });
          
          setCurrentIndex(prev => prev + 1);
        } else {
          const errData = await res.json().catch(() => ({}));
          console.error("Live predict failed:", errData);
          alert("Simulation failed: " + (errData.detail || "Server error"));
          setIsTracking(false);
          return;
        }
      } catch (e) {
        console.error("AI Inference Failed", e);
      }
      
      if (isTracking) {
        timeoutId = setTimeout(processNextPoint, 1500);
      }
    };

    if (isTracking && currentIndex < routePoints.length) {
      processNextPoint();
    }

    return () => clearTimeout(timeoutId);
  }, [isTracking, currentIndex, routePoints]);

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: '#0B0F19' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`AIS140_Log_${telemetry.vehicleId}_${new Date().getTime()}.pdf`);
    } catch (e) {
      alert("Failed to export PDF.");
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 relative">
      <div className="flex-1 lg:flex-[1.5] relative rounded-2xl overflow-hidden border border-[#1F293D] shadow-2xl bg-[#0B0F19]">
        <div className="absolute top-4 left-4 z-[400] bg-black/70 backdrop-blur-md border border-white/10 p-4 rounded-xl shadow-xl w-64 pointer-events-auto">
          <div className="flex items-center gap-3 mb-3">
            <Radar className="w-5 h-5 text-[#3b82f6]" />
            <h3 className="text-white font-bold text-sm">AIS-140 Simulator</h3>
          </div>
          
          {!isTracking && currentIndex === 0 && (
            <div className="flex flex-col gap-2 mb-4">
              <p className="text-xs text-[#9CA3AF] mb-2">Define a route to simulate live vehicle tracking.</p>
              {searchLocations.map((loc, i) => (
                <div key={i} className="flex gap-1 items-center">
                  <input 
                    type="text" 
                    placeholder={i === 0 ? "Start City" : i === searchLocations.length - 1 ? "End City" : "Via City"} 
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
              <button onClick={handleRouteSearch} disabled={loading} className="w-full mt-1 py-1.5 bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
                <Search className="w-3 h-3" /> Load Route
              </button>
            </div>
          )}

          {routePoints.length > 0 && (
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setIsTracking(!isTracking)} 
                className={`w-full py-2 ${isTracking ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white text-sm font-black rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg`}
              >
                {isTracking ? <Square className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                {isTracking ? 'Stop Simulation' : currentIndex > 0 ? 'Resume Trip' : 'Start Engine'}
              </button>
              {!isTracking && currentIndex > 0 && (
                <>
                  <button onClick={() => setShowAnalytics(true)} className="w-full py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-90 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 shadow-lg mt-1">
                    <Activity className="w-4 h-4" /> View Trip Analytics
                  </button>
                  <button onClick={() => { setCurrentIndex(0); setHistory([]); setShowAnalytics(false); }} className="w-full py-1.5 bg-[#161D30] hover:bg-[#1F293D] text-white text-xs font-bold rounded-lg border border-[#1F293D]">
                    Reset Trip
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="absolute top-4 right-4 z-[400] bg-black/70 backdrop-blur-md border border-white/10 p-1.5 rounded-xl shadow-xl pointer-events-auto">
          <button 
            onClick={() => setMapStyle(prev => prev === 'street' ? 'satellite' : prev === 'satellite' ? 'traffic' : 'street')}
            className="flex items-center gap-2 px-3 py-2 bg-[#161D30] hover:bg-[#1F293D] text-white text-xs font-bold rounded-lg transition-colors border border-white/10"
          >
            {mapStyle === 'street' ? <MapIcon className="w-4 h-4 text-[#22c55e]" /> : mapStyle === 'satellite' ? <Layers className="w-4 h-4 text-[#3b82f6]" /> : <Car className="w-4 h-4 text-[#f97316]" />}
            {mapStyle === 'street' ? 'Street View' : mapStyle === 'satellite' ? 'Satellite View' : 'Traffic View'}
          </button>
        </div>

        <MapContainer center={[10.8505, 76.2711]} zoom={7} style={{ height: '100%', width: '100%' }} zoomControl={false} className="z-0">
          {mapStyle === 'satellite' ? (
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri" />
          ) : mapStyle === 'traffic' ? (
            <TileLayer url="https://mt1.google.com/vt/lyrs=m@221097413,traffic&x={x}&y={y}&z={z}" attribution="&copy; Google" />
          ) : (
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' />
          )}
          <ZoomControl position="bottomright" />
          <AutoPanMap center={isTracking && routePoints[currentIndex] ? routePoints[currentIndex] : null} isTracking={isTracking} routePoints={routePoints} />
          
          {keralaGeoJSON && (
            <GeoJSON data={keralaGeoJSON} style={() => ({ color: '#3b82f6', weight: 1, fillOpacity: 0.05, dashArray: '5, 5' })} />
          )}

          {routePoints.length > 0 && (
            <Polyline positions={routePoints.map(p => [p.lat, p.lon])} color="#475569" weight={3} dashArray="5, 5" opacity={0.5} />
          )}

          {history.length > 0 && (
            <Polyline positions={history.map(p => [p.lat, p.lon])} color="#3b82f6" weight={5} opacity={0.8} />
          )}

          {routePoints.length > 0 && (
            <Marker position={[routePoints[0].lat, routePoints[0].lon]} icon={startIcon} />
          )}

          {routePoints.length > 0 && currentIndex < routePoints.length && (
            <Marker position={[routePoints[currentIndex].lat, routePoints[currentIndex].lon]} icon={vehicleIcon} />
          )}
        </MapContainer>
      </div>

      <div className="flex-1 lg:flex-[1.2] overflow-y-auto custom-scrollbar pr-2 pb-10" ref={reportRef}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <Car className="w-6 h-6 text-[#3b82f6]" /> Live Telemetry
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 bg-[#3b82f6]/20 border border-[#3b82f6]/30 rounded text-[#3b82f6] text-[10px] font-mono font-bold">
                {telemetry.vehicleId}
              </span>
              <span className={`px-2 py-0.5 border rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${isTracking ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-red-500/20 border-red-500/30 text-red-400'}`}>
                {isTracking ? <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div> : <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>}
                {isTracking ? 'ONLINE - RECEIVING' : 'OFFLINE'}
              </span>
            </div>
          </div>
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
              className="flex items-center gap-2 px-3 py-1.5 bg-[#161D30] hover:bg-[#1F293D] text-[#9CA3AF] hover:text-white text-xs font-bold rounded-lg transition-all border border-white/10"
            >
              {showMapTutorial ? <EyeOff className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
              {showMapTutorial ? 'Hide Routing' : 'Routing Tech'}
            </button>
            <button 
              onClick={() => setShowTutorial(!showTutorial)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#161D30] hover:bg-[#1F293D] text-[#9CA3AF] hover:text-white text-xs font-bold rounded-lg transition-all border border-white/10"
            >
              {showTutorial ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showTutorial ? 'Hide AI Math' : 'How AI Works'}
            </button>
            <button onClick={downloadPDF} disabled={history.length === 0} className="flex items-center gap-2 px-3 py-1.5 bg-[#1F293D] hover:bg-[#263554] text-white text-xs font-bold rounded-lg transition-all border border-white/10 disabled:opacity-50">
              Export Log
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
            <li><strong>Configure Vehicle:</strong> Use the Vehicle Profile controls to set the weight class (e.g., Heavy Duty Truck) and Engine Torque limits.</li>
            <li><strong>Define a Route:</strong> Use the Route Builder to search for a Start and End location, or click directly on the map.</li>
            <li><strong>Start Simulation:</strong> Click the <strong className="text-[#3b82f6]">Start Telemetry</strong> button.</li>
            <li><strong>Monitor Live Data:</strong> Watch the simulated dashboard gauges as the vehicle drives the route. The system will flag Torque Limits if the altitude gradient is too steep for the configured vehicle weight.</li>
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
                 <strong className="text-white">Data Pipeline:</strong> We sample points along this OSRM route and stream them to our Python FastAPI backend. The <strong className="text-[#f97316]">XGBoost Model</strong> predicts the altitude for each point, allowing the frontend to calculate the Gradient and simulate live Telemetry.
               </p>
            </div>
          </div>
        </div>
        )}

        {/* HOW IT WORKS (LAYMAN'S GUIDE) */}
        {showTutorial && (
        <div className="glass-panel p-5 rounded-2xl border border-[#1F293D] mb-6 bg-[#0B0F19]">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <Car className="w-4 h-4 text-[#f97316]" /> How it Works (AI & Physics Model)
          </h3>
          
          <div className="flex flex-col xl:flex-row gap-6 items-center">
            {/* Animated SVG Pictorial */}
            <div className="w-full xl:w-1/3 bg-[#161D30] rounded-xl border border-[#1F293D] p-4 flex items-center justify-center relative overflow-hidden h-32">
              <svg viewBox="0 0 200 100" className="w-full h-full">
                <path d="M 10 90 L 100 90 L 190 20" fill="none" stroke="#1F293D" strokeWidth="4" />
                
                {/* Truck */}
                <motion.g animate={{ x: [0, 90, 180], y: [0, 0, -70], rotate: [0, 0, -38] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}>
                  <rect x="10" y="75" width="25" height="12" fill="#f97316" rx="2" />
                  <rect x="35" y="77" width="10" height="10" fill="#f97316" rx="1" />
                  <circle cx="15" cy="88" r="3" fill="white" />
                  <circle cx="30" cy="88" r="3" fill="white" />
                  <circle cx="42" cy="88" r="3" fill="white" />
                </motion.g>
                
                {/* Engine Temp Warning */}
                <motion.g animate={{ opacity: [0, 0, 1] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}>
                  <path d="M 170 5 L 180 20 L 160 20 Z" fill="#ef4444" />
                  <text x="168" y="17" fill="white" fontSize="8" fontWeight="bold">!</text>
                  <text x="120" y="15" fill="#ef4444" fontSize="10" fontWeight="bold">Torque Limit</text>
                </motion.g>
              </svg>
            </div>
            
            <div className="w-full xl:w-2/3 space-y-3">
               <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                 <strong className="text-white">The Math (Powertrain Simulation):</strong> A heavy truck driving on flat ground requires standard torque. But when the AI detects a steep altitude spike ahead, it calculates the massive gravitational force pulling the vehicle backward using Grade Resistance:
               </p>
               <div className="bg-[#161D30] p-2 rounded border border-[#1F293D] font-mono text-[10px] text-[#f97316] space-y-1">
                 <p>Grade Resistance (GR) = Vehicle Mass × Gravity × sin(Gradient Angle)</p>
                 <p className="text-[#9CA3AF]">Required Engine Torque (T) = (GR + Rolling Resistance) × Tire Radius</p>
               </div>
               <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                 <strong className="text-white">Why we take it:</strong> We mathematically combine the XGBoost slope prediction with the vehicle's mass and engine power. This proves whether a specific truck physically has enough torque to climb a mountain pass, preventing fleet managers from routing heavy cargo into dangerous stall-out zones.
               </p>
            </div>
          </div>
        </div>
        )}

        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="glass-panel p-5 rounded-xl border border-[#1F293D] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 opacity-10"><Zap className="w-16 h-16" /></div>
              <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mb-1 flex items-center gap-1">Speed</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-white tabular-nums">{telemetry.speed}</span>
                <span className="text-sm font-bold text-[#9CA3AF]">km/h</span>
              </div>
            </div>
            
            <div className="glass-panel p-5 rounded-xl border border-[#1F293D] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 opacity-10"><Compass className="w-16 h-16" /></div>
              <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mb-1 flex items-center gap-1">Heading</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-white tabular-nums">{telemetry.heading}°</span>
                <span className="text-sm font-bold text-[#3b82f6]">{getCardinalDirection(telemetry.heading)}</span>
              </div>
            </div>
            
            <div className="glass-panel p-5 rounded-xl border border-rose-500/20 bg-rose-500/5 relative overflow-hidden overflow-visible">
              <div className="absolute top-0 right-0 p-2 opacity-10"><Fuel className="w-16 h-16 text-rose-500" /></div>
              <div className="flex items-center gap-2 mb-1 relative group">
                <p className="text-[10px] text-rose-400 font-bold uppercase tracking-widest flex items-center gap-1">Fuel Loss % (Instant)</p>
                <Info className="w-3 h-3 text-rose-400/70 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-[#1F293D] text-[#E5E7EB] text-xs rounded-lg shadow-xl border border-[#374151] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <p className="font-bold mb-1 text-rose-400">How is this calculated?</p>
                  <p className="mb-2">Calculated dynamically using XGBoost terrain gradient predictions.</p>
                  <div className="bg-black/50 p-2 rounded border border-white/5 font-mono text-[10px]">
                    Example: A +5% uphill gradient requires ~7.5% more fuel/battery compared to driving on a perfectly flat road.
                  </div>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-rose-400 tabular-nums">{telemetry.fuelImpact > 0 ? '+' : ''}{telemetry.fuelImpact}</span>
                <span className="text-sm font-bold text-rose-500/70">%</span>
              </div>
              <div className="mt-2 pt-2 border-t border-rose-500/20 flex items-center justify-between">
                <span className="text-[10px] text-rose-500/80 font-bold uppercase tracking-wider">Est. Total Route Loss</span>
                <span className="text-xs font-black text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/30 shadow-sm">
                  {totalFuelLoss > 0 ? '+' : ''}{totalFuelLoss.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-xl border border-[#1F293D] bg-gradient-to-br from-[#0B0F19] to-[#161D30]">
            <h4 className="text-[10px] text-[#3b82f6] font-bold uppercase tracking-widest mb-4 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Activity className="w-3 h-3" /> Live Terrain Prediction
              </div>
              <span className="text-[#3b82f6]/60 bg-[#3b82f6]/10 px-2 py-0.5 rounded-full border border-[#3b82f6]/20">AT THIS POINT</span>
            </h4>
            
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <div>
                <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold mb-1">Predicted Altitude</p>
                <div className="text-2xl font-black text-white tabular-nums">{telemetry.altitude} <span className="text-xs text-[#9CA3AF]">m</span></div>
              </div>
              
              <div>
                <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold mb-1">Road Gradient</p>
                <div className="text-2xl font-black tabular-nums" style={{ color: telemetry.difficulty.color }}>
                  {telemetry.gradient} <span className="text-xs text-[#9CA3AF]">%</span>
                </div>
              </div>
              
              <div className="col-span-2">
                <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold mb-1">Travel Difficulty</p>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10" style={{ backgroundColor: `${telemetry.difficulty.color}20` }}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: telemetry.difficulty.color }}></div>
                  <span className="text-sm font-bold tracking-wide" style={{ color: telemetry.difficulty.color }}>
                    {telemetry.difficulty.label}
                  </span>
                </div>
                
                <div className="flex flex-col gap-2 mt-4">
                  <div className="bg-[#0B0F19] border border-[#1F293D] p-3 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-[#3b82f6]" />
                      <span className="text-xs font-bold text-white">Live Flood Risk</span>
                    </div>
                    <span className="px-2 py-1 rounded text-xs font-black shadow-lg" style={{ backgroundColor: `${telemetry.floodRisk.color}20`, color: telemetry.floodRisk.color, border: `1px solid ${telemetry.floodRisk.color}40` }}>
                      {telemetry.floodRisk.level}
                    </span>
                  </div>

                  <div className="bg-[#0B0F19] border border-[#1F293D] p-3 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MountainSnow className="w-4 h-4 text-[#f97316]" />
                      <span className="text-xs font-bold text-white">Live Landslide Risk</span>
                    </div>
                    <span className="px-2 py-1 rounded text-xs font-black shadow-lg" style={{ backgroundColor: `${telemetry.landslideRisk.color}20`, color: telemetry.landslideRisk.color, border: `1px solid ${telemetry.landslideRisk.color}40` }}>
                      {telemetry.landslideRisk.level}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="glass-panel p-4 rounded-xl border border-[#1F293D]">
              <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mb-1 flex items-center gap-1"><Navigation className="w-3 h-3 text-[#3b82f6]" /> Dist. Traveled</p>
              <p className="text-xl font-black text-white">{telemetry.distanceTraveled} <span className="text-xs font-normal text-[#9CA3AF]">km</span></p>
            </div>
            <div className="glass-panel p-4 rounded-xl border border-[#1F293D]">
              <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3 text-green-400" /> Elevation Gain</p>
              <p className="text-xl font-black text-white">+{telemetry.totalAscent} <span className="text-xs font-normal text-[#9CA3AF]">m</span></p>
            </div>
            <div className="glass-panel p-4 rounded-xl border border-[#1F293D]">
              <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mb-1 flex items-center gap-1"><TrendingDown className="w-3 h-3 text-blue-400" /> Elevation Loss</p>
              <p className="text-xl font-black text-white">-{telemetry.totalDescent} <span className="text-xs font-normal text-[#9CA3AF]">m</span></p>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-[#1F293D]">
             <h4 className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mb-3">Raw Payload Feed</h4>
             <div className="bg-black/50 border border-white/5 rounded-lg p-3 h-32 overflow-y-auto font-mono text-[10px] text-[#9CA3AF] space-y-1 custom-scrollbar flex flex-col-reverse">
                {history.slice(-10).map((pt, i) => (
                  <div key={i} className="flex justify-between border-b border-white/5 pb-1 gap-2">
                    <span className="text-[#3b82f6] whitespace-nowrap">{new Date(pt.timestamp).toLocaleTimeString()}</span>
                    <span className="truncate flex-1">{pt.road ? pt.road : 'Driving...'}</span>
                    <span className="text-white whitespace-nowrap">A:{pt.altitude.toFixed(0)}m G:{pt.gradient.toFixed(1)}% F:{pt.fuelImpact ? pt.fuelImpact.toFixed(1) : '0.0'}%</span>
                  </div>
                ))}
                {history.length === 0 && <div className="text-center text-white/30 italic mt-10">Awaiting simulation start...</div>}
             </div>
          </div>
        </div>
      </div>
      
      {/* Post-Trip Analytics Modal */}
      {showAnalytics && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-[#0B0F19] border border-[#1F293D] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-[#1F293D] flex justify-between items-center bg-[#161D30]">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-orange-500" /> Post-Trip Terrain Analytics
              </h2>
              <button onClick={() => setShowAnalytics(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-5 gap-4 mb-6">
                <div className="bg-[#161D30] border border-[#1F293D] p-4 rounded-xl text-center">
                  <p className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider mb-1">Total Points</p>
                  <p className="text-xl font-black text-white">{history.length}</p>
                </div>
                <div className="bg-[#161D30] border border-[#1F293D] p-4 rounded-xl text-center">
                  <p className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider mb-1">Steep Events</p>
                  <p className="text-xl font-black text-orange-500">{history.filter(p => p.gradient > 6).length}</p>
                </div>
                <div className="bg-[#161D30] border border-[#1F293D] p-4 rounded-xl text-center relative group">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <p className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider">Max Gradient</p>
                    <Info className="w-3 h-3 text-[#9CA3AF] cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-[#111827] border border-[#1F293D] rounded-lg shadow-2xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 text-left">
                      <strong className="text-[#ef4444] block mb-2">Max Gradient (Steepness)</strong>
                      <p className="mb-2">The steepest single section of the route.</p>
                      <svg viewBox="0 0 200 80" className="w-full h-16 bg-[#0B0F19] rounded border border-[#1F293D] mt-2">
                        <path d="M 10 70 Q 40 70, 70 50 T 130 20 T 190 60" stroke="#9CA3AF" strokeWidth="2" fill="none" />
                        <line x1="80" y1="46" x2="110" y2="28" stroke="#ef4444" strokeWidth="4" />
                        <circle cx="95" cy="37" r="15" stroke="#ef4444" strokeWidth="1" fill="none" strokeDasharray="2 2" />
                        <text x="95" y="15" fill="#ef4444" fontSize="10" textAnchor="middle">Steepest Peak</text>
                      </svg>
                    </div>
                  </div>
                  <p className="text-xl font-black text-red-500">{Math.max(0, ...history.map(p => p.gradient)).toFixed(1)}%</p>
                </div>
                <div className="bg-[#161D30] border border-[#1F293D] p-4 rounded-xl text-center">
                  <p className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider mb-1">Flood Risk</p>
                  <p className="text-xl font-black text-[#ef4444]">{history.filter(p => p.altitude <= 15).length}</p>
                </div>
                <div className="bg-[#161D30] border border-[#1F293D] p-4 rounded-xl text-center">
                  <p className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider mb-1">Landslide Risk</p>
                  <p className="text-xl font-black text-[#f97316]">{history.filter(p => getLandslideRisk(p.altitude, p.gradient).level.includes('High')).length}</p>
                </div>
              </div>

              <h3 className="text-sm font-bold text-white mb-3">Significant Terrain Anomalies Log (Steepness, Flood & Landslide)</h3>
              <div className="border border-[#1F293D] rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#161D30] text-[#9CA3AF]">
                    <tr>
                      <th className="p-3 font-semibold">Time</th>
                      <th className="p-3 font-semibold">Location / Road</th>
                      <th className="p-3 font-semibold">Coords</th>
                      <th className="p-3 font-semibold">Altitude</th>
                      <th className="p-3 font-semibold">Flood Risk</th>
                      <th className="p-3 font-semibold">Landslide Risk</th>
                      <th className="p-3 font-semibold">Gradient Spike</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F293D]">
                    {history.filter(pt => pt.gradient > 3 || pt.altitude <= 15 || getLandslideRisk(pt.altitude, pt.gradient).level.includes('High')).length === 0 ? (
                      <tr><td colSpan={7} className="p-6 text-center text-[#9CA3AF]">No significant terrain or risk anomalies detected on this route.</td></tr>
                    ) : (
                      history.filter(pt => pt.gradient > 3 || pt.altitude <= 15 || getLandslideRisk(pt.altitude, pt.gradient).level.includes('High')).map((pt, i) => (
                        <tr key={i} className="hover:bg-white/5 transition-colors">
                          <td className="p-3 text-[#3b82f6]">{new Date(pt.timestamp).toLocaleTimeString()}</td>
                          <td className="p-3 text-white truncate max-w-[150px]">{pt.road || 'Unknown'}</td>
                          <td className="p-3 text-[#9CA3AF] font-mono">[{pt.lat.toFixed(4)}, {pt.lon.toFixed(4)}]</td>
                          <td className="p-3 text-white">{pt.altitude.toFixed(1)}m</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: `${getFloodRisk(pt.altitude).color}20`, color: getFloodRisk(pt.altitude).color }}>
                              {getFloodRisk(pt.altitude).level}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: `${getLandslideRisk(pt.altitude, pt.gradient).color}20`, color: getLandslideRisk(pt.altitude, pt.gradient).color }}>
                              {getLandslideRisk(pt.altitude, pt.gradient).level}
                            </span>
                          </td>
                          <td className="p-3 font-bold" style={{ color: getDifficulty(pt.gradient).color }}>
                            {pt.gradient.toFixed(1)}% ({getDifficulty(pt.gradient).label})
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
