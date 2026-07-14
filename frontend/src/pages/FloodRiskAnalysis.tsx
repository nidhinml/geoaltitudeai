import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, useMapEvents, ZoomControl, GeoJSON, Rectangle } from 'react-leaflet';
import L from 'leaflet';
import { 
  Activity, Map as MapIcon, Layers, Search, ShieldAlert, ShieldCheck, Droplets, Radar, Shield, Trash2, CloudRain
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
        </div>

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
