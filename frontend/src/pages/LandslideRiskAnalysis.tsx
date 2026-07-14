import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents, ZoomControl, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import { 
  Activity, Map as MapIcon, Layers, Search, ShieldAlert, ShieldCheck, MountainSnow, AlertTriangle, Trash2, Shield, CloudRain
} from 'lucide-react';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api');

const getLandslideRisk = (altitude: number, slope: number) => {
  if (altitude > 500 && slope > 15) return { level: 'Very High', color: '#ef4444', icon: MountainSnow, desc: 'Extreme topological vulnerability. Immediate risk of major structural failure during heavy precipitation.' };
  if ((altitude > 500 && slope > 10) || (altitude > 100 && slope > 15)) return { level: 'High', color: '#f97316', icon: AlertTriangle, desc: 'High vulnerability to soil erosion and mudslides. Requires structural reinforcement.' };
  if (slope > 5) return { level: 'Moderate', color: '#eab308', icon: ShieldAlert, desc: 'Moderate risk. Minor landslides possible during prolonged monsoon events.' };
  if (slope > 2) return { level: 'Low', color: '#22c55e', icon: Shield, desc: 'Low risk. Generally stable terrain.' };
  return { level: 'Very Low', color: '#3b82f6', icon: ShieldCheck, desc: 'Very low risk. Flat or highly stable topological features.' };
};

// Haversine distance in km
const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export default function LandslideRiskAnalysis() {
  const [markers, setMarkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapStyle, setMapStyle] = useState<'street' | 'satellite'>('satellite');
  const [searchQuery, setSearchQuery] = useState('');
  const [keralaGeoJSON, setKeralaGeoJSON] = useState<any>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  useEffect(() => {
    fetch('/kerala.geojson')
      .then(res => res.json())
      .then(data => setKeralaGeoJSON(data))
      .catch(err => console.error("Error loading Kerala bounds", err));
  }, []);

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
          // Generate 5 points to calculate localized slope (center + N, S, E, W offset by ~100m)
          const offset = 0.001;
          const points = [
            { latitude: e.latlng.lat, longitude: e.latlng.lng }, // Center
            { latitude: e.latlng.lat + offset, longitude: e.latlng.lng }, // North
            { latitude: e.latlng.lat - offset, longitude: e.latlng.lng }, // South
            { latitude: e.latlng.lat, longitude: e.latlng.lng + offset }, // East
            { latitude: e.latlng.lat, longitude: e.latlng.lng - offset }  // West
          ];

          // Send parallel requests to /predict/live as POST with JSON payload
          const promises = points.map(p => 
            fetch(`${API_BASE}/predict/live`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ latitude: p.latitude, longitude: p.longitude })
            }).then(res => res.json())
          );
          
          const results = await Promise.all(promises);
          
          const centerAlt = results[0].predicted_altitude;
          
          // Calculate max slope among the 4 directional points
          let maxSlope = 0;
          for (let i = 1; i <= 4; i++) {
            const pAlt = results[i].predicted_altitude;
            const distKm = haversineDistance(points[0].latitude, points[0].longitude, points[i].latitude, points[i].longitude);
            const eleDiff = Math.abs(pAlt - centerAlt);
            if (distKm * 1000 > 0) {
              const slope = (eleDiff / (distKm * 1000)) * 100;
              if (slope > maxSlope) maxSlope = slope;
            }
          }

          const risk = getLandslideRisk(centerAlt, maxSlope);
            
            // Reverse geocode to get area name
            let areaName = 'Unknown Terrain';
            try {
              const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${e.latlng.lat}&longitude=${e.latlng.lng}&localityLanguage=en`);
              if (geoRes.ok) {
                const geoData = await geoRes.json();
                areaName = geoData.locality || geoData.city || geoData.principalSubdivision || 'Unknown Terrain';
              }
            } catch (e) {}

            const newMarker = {
              lat: e.latlng.lat,
              lon: e.latlng.lng,
              altitude: centerAlt,
              slope: maxSlope,
              risk,
              areaName,
              timestamp: Date.now()
            };
            
            setMarkers(prev => [newMarker, ...prev].slice(0, 50));
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

  const clearAll = () => setMarkers([]);

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 relative">
      {/* LEFT PANE: Map Container */}
      <div className="flex-1 lg:flex-[1.8] relative rounded-2xl overflow-hidden border border-[#1F293D] shadow-2xl bg-[#0B0F19]">
        <div className="absolute top-4 left-4 z-[400] bg-black/70 backdrop-blur-md border border-white/10 p-4 rounded-xl shadow-xl w-72 pointer-events-auto">
          <div className="flex items-center gap-3 mb-3">
            <MountainSnow className="w-5 h-5 text-[#f97316]" />
            <h3 className="text-white font-bold text-sm">Landslide Risk Scanner</h3>
          </div>
          <p className="text-xs text-[#9CA3AF] mb-4">Click anywhere to trigger a multi-point topology scan. The engine derives the localized slope to classify landslide vulnerability.</p>
          
          <div className="flex gap-2 mb-3">
            <input 
              type="text" 
              placeholder="Search mountainous area (e.g. Munnar)" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 bg-[#161D30] border border-[#1F293D] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#f97316]"
            />
            <button 
              onClick={handleSearch}
              disabled={loading || !searchQuery.trim()}
              className="px-3 py-2 bg-[#f97316] hover:bg-[#ea580c] text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              {loading ? <Activity className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>

          <button 
            onClick={clearAll} 
            disabled={loading || markers.length === 0}
            className="w-full py-2 bg-[#161D30] hover:bg-red-500/20 text-white hover:text-red-400 text-xs font-bold rounded-lg transition-colors border border-[#1F293D] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3" /> Clear Map
          </button>
          
          <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
            <h4 className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Risk Legend</h4>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="flex items-center gap-2 text-[10px] text-white"><div className="w-3 h-3 rounded-sm bg-[#ef4444]"></div> Very High</div>
              <div className="flex items-center gap-2 text-[10px] text-white"><div className="w-3 h-3 rounded-sm bg-[#f97316]"></div> High</div>
              <div className="flex items-center gap-2 text-[10px] text-white"><div className="w-3 h-3 rounded-sm bg-[#eab308]"></div> Moderate</div>
              <div className="flex items-center gap-2 text-[10px] text-white"><div className="w-3 h-3 rounded-sm bg-[#22c55e]"></div> Low</div>
              <div className="flex items-center gap-2 text-[10px] text-white col-span-2"><div className="w-3 h-3 rounded-sm bg-[#3b82f6]"></div> Very Low</div>
            </div>
          </div>
        </div>

        <div className="absolute top-4 right-4 z-[400] bg-black/70 backdrop-blur-md border border-white/10 p-1.5 rounded-xl shadow-xl pointer-events-auto">
          <button 
            onClick={() => setMapStyle(prev => prev === 'street' ? 'satellite' : 'street')}
            className="flex items-center gap-2 px-3 py-2 bg-[#161D30] hover:bg-[#1F293D] text-white text-xs font-bold rounded-lg transition-colors border border-white/10"
          >
            {mapStyle === 'street' ? <MapIcon className="w-4 h-4 text-[#22c55e]" /> : <Layers className="w-4 h-4 text-[#f97316]" />}
            {mapStyle === 'street' ? 'Street View' : 'Satellite View'}
          </button>
        </div>
        
        <MapContainer center={[10.0889, 77.0595]} zoom={9} style={{ height: '100%', width: '100%' }} zoomControl={false} className="z-0 cursor-crosshair">
          {mapStyle === 'satellite' ? (
            <TileLayer key="satellite" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri" />
          ) : (
            <TileLayer key="street" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' />
          )}
          <ZoomControl position="bottomright" />
          <MapEvents />
          
          {keralaGeoJSON && (
            <GeoJSON data={keralaGeoJSON} style={() => ({ color: '#f97316', weight: 2, fillOpacity: 0.0 })} />
          )}

          {markers.map((marker, i) => (
            <CircleMarker 
              key={`marker-${i}`}
              center={[marker.lat, marker.lon]}
              radius={8}
              pathOptions={{ color: '#fff', weight: 2, fillColor: marker.risk.color, fillOpacity: 1 }}
            >
              <Popup className="custom-popup min-w-[220px]">
                <div className="bg-[#0B0F19] p-3 -m-3 rounded-lg border border-[#1F293D]">
                  <div className="flex items-center gap-2 mb-2">
                    <marker.risk.icon className="w-4 h-4" style={{ color: marker.risk.color }} />
                    <h4 className="font-bold text-sm" style={{ color: marker.risk.color }}>{marker.risk.level} Landslide Risk</h4>
                  </div>
                  <div className="bg-[#161D30] p-2 rounded-md mb-2 border border-[#1F293D] grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-[#9CA3AF] uppercase">Altitude</p>
                      <p className="text-sm text-white font-mono">{marker.altitude.toFixed(1)}m</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#9CA3AF] uppercase">Slope</p>
                      <p className="text-sm text-white font-mono">{marker.slope.toFixed(1)}%</p>
                    </div>
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
            <MountainSnow className="w-6 h-6 text-[#f97316]" /> Terrain Integrity
          </h2>
        </div>

        {markers.length === 0 ? (
          <div className="glass-panel h-64 rounded-2xl border border-[#1F293D] flex flex-col items-center justify-center text-center p-10 bg-[#0B0F19]">
            <MountainSnow className="w-12 h-12 text-[#f97316]/20 mb-4 animate-pulse" />
            <p className="text-white font-bold">No topography scanned</p>
            <p className="text-xs text-[#9CA3AF] mt-2">Click on the map to run a multi-point topology scan and assess landslide vulnerability.</p>
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
                      <div className="flex items-center gap-3 mt-0.5">
                         <span className="text-[10px] text-[#9CA3AF] font-mono">Alt: {marker.altitude.toFixed(1)}m</span>
                         <span className="text-[10px] text-[#9CA3AF] font-mono">Slope: {marker.slope.toFixed(1)}%</span>
                      </div>
                      <p className="text-[10px] text-[#9CA3AF] mt-1 italic flex items-center gap-1"><MapIcon className="w-3 h-3"/> {marker.areaName}</p>
                      <p className="text-[10px] text-gray-400 mt-1 line-clamp-2 leading-relaxed">{marker.risk.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
        
        <div className="mt-6 glass-panel p-4 rounded-xl border border-[#1F293D] bg-gradient-to-br from-[#161D30] to-[#0B0F19]">
          <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1"><Activity className="w-3 h-3 text-[#f97316]" /> Real-time Integration</h4>
          <p className="text-[10px] text-[#9CA3AF] leading-relaxed">
            The Landslide Risk Assessment model utilizes multi-point topological sampling to mathematically derive localized slope percentages. Future infrastructure upgrades will natively integrate IMD Live Rainfall APIs to flag "Red Alerts" when high-slope areas experience precipitation exceeding 150mm/day.
          </p>
        </div>
      </div>
    </div>
  );
}
