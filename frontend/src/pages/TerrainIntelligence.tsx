import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, ZoomControl, GeoJSON } from 'react-leaflet';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Waves, TreePine, Trees, Tent, Mountain, MountainSnow, 
  MapPin, Target, Activity, Compass, Info, Loader2, Eye, EyeOff, Map as MapIcon
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api');

const classifyTerrain = (altitude: number) => {
  if (altitude < 50) return { type: 'Very Lowland', color: 'from-[#22c55e] to-[#15803d]', hex: '#22c55e', text: 'text-[#22c55e]', zone: 'Coastal / Plains', slope: 'Gentle', icon: Waves, desc: 'Flat terrains typically near sea level. Ideal for agriculture and dense settlements.' };
  if (altitude < 200) return { type: 'Lowland', color: 'from-[#eab308] to-[#a16207]', hex: '#eab308', text: 'text-[#eab308]', zone: 'Lower Plains', slope: 'Gentle to Moderate', icon: TreePine, desc: 'Slightly elevated plains or rolling hills. Supports diverse vegetation and farming.' };
  if (altitude < 500) return { type: 'Midland', color: 'from-[#f97316] to-[#c2410c]', hex: '#f97316', text: 'text-[#f97316]', zone: 'Hilly Region', slope: 'Moderate', icon: Trees, desc: 'Hilly terrains with moderate elevation. Often features forests and terraced farming.' };
  if (altitude < 1000) return { type: 'Highland', color: 'from-[#ef4444] to-[#b91c1c]', hex: '#ef4444', text: 'text-[#ef4444]', zone: 'Lower Mountains', slope: 'Steep', icon: Tent, desc: 'Significant elevation characterized by steep slopes, cooler climates, and dense forests.' };
  if (altitude < 2000) return { type: 'Mountain', color: 'from-[#78350f] to-[#451a03]', hex: '#78350f', text: 'text-[#fb923c]', zone: 'Mountainous', slope: 'Very Steep', icon: Mountain, desc: 'High altitude mountain ranges with rugged topography. Sparse settlements and alpine flora.' };
  return { type: 'High Mountain', color: 'from-[#f3f4f6] to-[#9ca3af]', hex: '#f3f4f6', text: 'text-[#f3f4f6]', zone: 'Alpine / Peak', slope: 'Extreme', icon: MountainSnow, desc: 'Extreme altitudes often featuring rocky peaks, snowcaps, and harsh climatic conditions.' };
};

// Map click listener component
const MapClickHandler = ({ onLocationSelect }: { onLocationSelect: (lat: number, lon: number) => void }) => {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
};

// Custom Marker Icon
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

export default function TerrainIntelligence() {
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lon: number} | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showMapTutorial, setShowMapTutorial] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [keralaGeoJSON, setKeralaGeoJSON] = useState<any>(null);

  useEffect(() => {
    fetch('/kerala.geojson')
      .then(res => res.json())
      .then(data => setKeralaGeoJSON(data))
      .catch(console.error);
  }, []);
  
  const predictMutation = useMutation({
    mutationFn: async (coords: { latitude: number, longitude: number }) => {
      const res = await fetch(`${API_BASE}/predict/live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coords)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Prediction failed');
      }
      return res.json();
    }
  });

  const handleLocationSelect = (lat: number, lon: number) => {
    if (keralaGeoJSON) {
      const pt = point([lon, lat]);
      const isInside = keralaGeoJSON.features.some((feature: any) => 
        booleanPointInPolygon(pt, feature)
      );

      if (!isInside) {
        alert("This location is outside the trained region. Please select a point within Kerala.");
        return;
      }
    }

    setSelectedLocation({ lat, lon });
    predictMutation.mutate({ latitude: lat, longitude: lon });
  };

  const terrain = predictMutation.data ? classifyTerrain(predictMutation.data.predicted_altitude) : null;

  return (
    <div className="h-[calc(100vh-6rem)] flex gap-6 overflow-hidden">
      
      {/* LEFT PANE: Map Container */}
      <div className="flex-[2] relative rounded-2xl overflow-hidden border border-[#1F293D] shadow-2xl bg-[#0B0F19]">
        <div className="absolute top-4 left-4 z-[400] bg-black/50 backdrop-blur-md border border-white/10 p-3 rounded-xl flex items-center gap-3">
          <MapPin className="w-5 h-5 text-[#3b82f6]" />
          <div>
            <h3 className="text-white font-bold text-sm">Interactive Topography</h3>
            <p className="text-xs text-[#9CA3AF]">Click anywhere on the map to analyze terrain.</p>
          </div>
        </div>
        
        <MapContainer 
          center={[10.8505, 76.2711]} 
          zoom={7} 
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          className="z-0"
        >
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
          />
          <ZoomControl position="bottomleft" />
          <MapClickHandler onLocationSelect={handleLocationSelect} />
          
          {keralaGeoJSON && (
            <GeoJSON 
              data={keralaGeoJSON}
              style={{
                color: '#3b82f6',
                weight: 2,
                fillColor: '#3b82f6',
                fillOpacity: 0.1,
              }}
            />
          )}

          {selectedLocation && (
            <Marker position={[selectedLocation.lat, selectedLocation.lon]} icon={customIcon} />
          )}
        </MapContainer>
      </div>

      {/* RIGHT PANE: Intelligence Dashboard */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Mountain className="w-6 h-6 text-[#22c55e]" /> Terrain Intelligence
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
        <div className="glass-panel p-5 rounded-2xl border border-[#1F293D] mb-4 bg-[#0B0F19]">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-[#22c55e]" /> How to Use This Page
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-[#9CA3AF]">
            <li><strong>Analyze Terrain:</strong> Click anywhere on the map to trigger a Terrain Intelligence scan.</li>
            <li><strong>Data Extraction:</strong> The system will process the surrounding geospatial data to generate a centralized altitude profile.</li>
            <li><strong>Review Geography:</strong> The AI will instantly classify the overarching macro-geography (e.g. is this a Mountain Peak, a Valley floor, or a Coastal Plain?).</li>
            <li><strong>Live Telemetry:</strong> An animated visualization will plot the topographic structure in real-time, providing an immediate understanding of the physical environment.</li>
          </ol>
        </div>
        )}

        {/* MAP & SCANNING ARCHITECTURE */}
        {showMapTutorial && (
        <div className="glass-panel p-5 rounded-2xl border border-[#1F293D] mb-4 bg-[#0B0F19]">
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
                 <strong className="text-white">Mapping Engine:</strong> We use <strong className="text-[#3b82f6]">React-Leaflet</strong> over topographical bounds to render the visual UI.
               </p>
               <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                 <strong className="text-white">Spatial Grid Sampling:</strong> When you click the map, the app extracts the exact Latitude and Longitude. It then mathematically builds a radial grid surrounding this central point.
               </p>
               <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                 <strong className="text-white">Data Pipeline:</strong> The matrix of coordinates is passed into our FastAPI <strong className="text-[#f97316]">XGBoost Model</strong> to instantly classify the geography (e.g. Mountain, Valley, Plain) by predicting and comparing the altitudes.
               </p>
            </div>
          </div>
        </div>
        )}

        {/* HOW IT WORKS (LAYMAN'S GUIDE) */}
        {showTutorial && (
        <div className="glass-panel p-5 rounded-2xl border border-[#1F293D] mb-4 bg-[#0B0F19]">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <Mountain className="w-4 h-4 text-[#22c55e]" /> How it Works (AI & Physics Model)
          </h3>
          
          <div className="flex flex-col xl:flex-row gap-6 items-center">
            {/* Animated SVG Pictorial */}
            <div className="w-full xl:w-1/3 bg-[#161D30] rounded-xl border border-[#1F293D] p-4 flex items-center justify-center relative overflow-hidden h-32">
              <svg viewBox="0 0 200 100" className="w-full h-full">
                {/* 3D Wireframe Mesh */}
                <path d="M 10 70 L 50 30 L 100 60 L 150 20 L 190 80" fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="2 2" />
                <path d="M 10 90 L 50 50 L 100 80 L 150 40 L 190 100" fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="2 2" />
                <path d="M 50 30 L 50 50 M 100 60 L 100 80 M 150 20 L 150 40" fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="2 2" />
                
                {/* Scanner line */}
                <motion.rect 
                  x="0" y="0" width="2" height="100" fill="#22c55e" 
                  animate={{ x: [0, 200] }} 
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
                
                <circle cx="150" cy="20" r="4" fill="#ef4444" />
                <text x="120" y="15" fill="#ef4444" fontSize="10" fontWeight="bold">Peak Found</text>
              </svg>
            </div>
            
            <div className="w-full xl:w-2/3 space-y-3">
               <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                 <strong className="text-white">The Math (Spatial Autocorrelation & Moran's I):</strong> The AI doesn't just look at one point. It rapidly scans a massive grid of Latitude and Longitude coordinates around your click, predicting thousands of altitudes to measure spatial dependence:
               </p>
               <div className="bg-[#161D30] p-2 rounded border border-[#1F293D] font-mono text-[10px] text-[#22c55e] space-y-1">
                 <p>I = (N / W) × [ Σ_i Σ_j w_ij(x_i - X̄)(x_j - X̄) / Σ_i (x_i - X̄)² ]</p>
                 <p className="text-[#9CA3AF]">x = Altitude at coordinate, w = Spatial weight matrix</p>
               </div>
               <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                 <strong className="text-white">Why we take it:</strong> By comparing all these altitudes simultaneously using this mathematical theorem, it builds a 3D wireframe mesh. This allows it to classify the "Macro Geography" (e.g., determining if a point is a valley floor, a mountain plateau, or a coastal plain).
               </p>
            </div>
          </div>
        </div>
        )}


        {!selectedLocation ? (
          <div className="flex-1 glass-panel rounded-2xl border border-[#1F293D] flex flex-col items-center justify-center text-center p-10">
            <Target className="w-16 h-16 text-[#3b82f6]/30 mb-4 animate-pulse" />
            <h3 className="text-xl font-bold text-white mb-2">Awaiting Coordinates</h3>
            <p className="text-[#9CA3AF] text-sm">Select a location on the map to run the XGBoost classification pipeline and generate terrain intelligence.</p>
          </div>
        ) : predictMutation.isPending ? (
          <div className="flex-1 glass-panel rounded-2xl border border-[#1F293D] flex flex-col items-center justify-center p-10">
            <Loader2 className="w-12 h-12 text-[#3b82f6] animate-spin mb-4" />
            <p className="text-white font-bold animate-pulse">Running Neural Inference...</p>
          </div>
        ) : predictMutation.isError ? (
          <div className="glass-panel rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <p className="text-red-400 font-bold">Failed to analyze terrain.</p>
            <p className="text-sm text-red-400/80 mt-2">{predictMutation.error?.message}</p>
          </div>
        ) : terrain && (
          <AnimatePresence mode="wait">
            <motion.div 
              key={`${selectedLocation.lat}-${selectedLocation.lon}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              {/* Coordinates Card */}
              <div className="glass-panel p-5 rounded-2xl border border-[#1F293D] flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mb-1">Target Coordinates</p>
                  <p className="text-white font-mono text-sm">
                    {Math.abs(selectedLocation.lat).toFixed(4)}° {selectedLocation.lat >= 0 ? 'N' : 'S'},{' '}
                    {Math.abs(selectedLocation.lon).toFixed(4)}° {selectedLocation.lon >= 0 ? 'E' : 'W'}
                  </p>
                </div>
                <div className="p-3 bg-[#161D30] rounded-xl border border-[#1F293D]">
                  <Compass className="w-5 h-5 text-[#3b82f6]" />
                </div>
              </div>

              {/* Primary Altitude Hero */}
              <div className={`p-8 rounded-2xl border border-white/10 bg-gradient-to-br ${terrain.color} shadow-2xl relative overflow-hidden group`}>
                <div className="absolute inset-0 bg-black/20 mix-blend-overlay group-hover:bg-black/10 transition-colors" />
                <terrain.icon className="absolute -right-6 -bottom-6 w-48 h-48 text-white/10 transform -rotate-12 group-hover:rotate-0 transition-transform duration-700" />
                
                <div className="relative z-10">
                  <p className="text-white/80 font-bold text-sm uppercase tracking-widest mb-2">Predicted Elevation</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-6xl font-black text-white">{predictMutation.data.predicted_altitude.toFixed(1)}</span>
                    <span className="text-2xl font-bold text-white/80">meters</span>
                  </div>
                  <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-black/30 backdrop-blur-md rounded-full text-white font-bold text-sm">
                    <Activity className="w-4 h-4" /> AI Confidence: {predictMutation.data.confidence_score}%
                  </div>
                </div>
              </div>

              {/* Terrain Intelligence Badges */}
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-panel p-5 rounded-2xl border border-[#1F293D]">
                  <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mb-2">Terrain Type</p>
                  <div className="flex items-center gap-2">
                    <terrain.icon className={`w-5 h-5 ${terrain.text}`} />
                    <span className="text-lg font-bold text-white">{terrain.type}</span>
                  </div>
                </div>
                
                <div className="glass-panel p-5 rounded-2xl border border-[#1F293D]">
                  <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mb-2">Elevation Zone</p>
                  <p className="text-lg font-bold text-white">{terrain.zone}</p>
                </div>
                
                <div className="glass-panel p-5 rounded-2xl border border-[#1F293D] col-span-2">
                  <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mb-2">Estimated Slope Profile</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-[#161D30] rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }} 
                        animate={{ width: terrain.slope === 'Gentle' ? '20%' : terrain.slope.includes('Moderate') ? '40%' : terrain.slope === 'Steep' ? '70%' : '95%' }} 
                        className={`h-full bg-gradient-to-r ${terrain.color}`} 
                      />
                    </div>
                    <span className={`text-sm font-bold ${terrain.text}`}>{terrain.slope} Gradient</span>
                  </div>
                </div>
              </div>

              {/* Ecosystem Description */}
              <div className="glass-panel p-6 rounded-2xl border border-[#1F293D] bg-[#0B0F19]">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-[#3b82f6]" />
                  <h4 className="text-sm font-bold text-white">Topological Ecosystem</h4>
                </div>
                <p className="text-[#9CA3AF] text-sm leading-relaxed">
                  {terrain.desc}
                </p>
              </div>

            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
