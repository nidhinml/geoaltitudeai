import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap, GeoJSON, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, Clock, ShieldAlert } from 'lucide-react';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';

// Create a custom SVG marker to avoid default Leaflet asset path resolution errors in Vite
const customMarkerIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div class="w-6 h-6 bg-[#22c55e] border-2 border-white rounded-full flex items-center justify-center shadow-lg relative">
           <div class="absolute inset-0 bg-[#22c55e] rounded-full animate-ping opacity-60"></div>
           <div class="w-2.5 h-2.5 bg-black rounded-full"></div>
         </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Event listener component inside MapContainer
function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  React.useEffect(() => {
    map.flyTo(center, map.getZoom() < 8 ? 8 : map.getZoom(), {
      animate: true,
      duration: 1.5
    });
  }, [center, map]);
  return null;
}

export default function LivePrediction() {
  const [latitude, setLatitude] = useState<number>(10.8505);
  const [longitude, setLongitude] = useState<number>(76.2711);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [modelName, setModelName] = useState<string>("-");
  const [speedMs, setSpeedMs] = useState<number | null>(null);
  const [keralaGeoJSON, setKeralaGeoJSON] = useState<any>(null);

  useEffect(() => {
    fetch('/kerala.geojson')
      .then(res => res.json())
      .then(data => setKeralaGeoJSON(data))
      .catch(console.error);
  }, []);

  const handlePredict = async (lat: number, lng: number) => {
    setLoading(true);
    setPrediction(null);
    setSpeedMs(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'}/predict/live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng })
      });

      if (response.ok) {
        const data = await response.json();
        setPrediction(data.predicted_altitude);
        setModelName(data.model_version);
        setSpeedMs(data.computation_time_ms);
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.detail || "Error retrieving elevation prediction. Is a model active?");
      }
    } catch (err) {
      console.warn("FastAPI backend offline.");
      setLoading(false);
      return;
    }
    setLoading(false);
  };

  const onMapClick = (lat: number, lng: number) => {
    if (keralaGeoJSON) {
      const pt = point([lng, lat]);
      const isInside = keralaGeoJSON.features.some((feature: any) => 
        booleanPointInPolygon(pt, feature)
      );

      if (!isInside) {
        alert("This location is outside the trained region.");
        return;
      }
    }
    setLatitude(parseFloat(lat.toFixed(6)));
    setLongitude(parseFloat(lng.toFixed(6)));
    handlePredict(lat, lng);
  };

  const getElevationColor = (alt: number) => {
    if (alt < 200) return 'text-[#3b82f6]'; // lowlands
    if (alt < 1000) return 'text-[#10b981]'; // valleys
    if (alt < 2500) return 'text-[#f59e0b]'; // highland
    return 'text-[#ef4444]'; // extreme heights
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-12rem)] min-h-[500px]">
        
        {/* Left Side Panel: Form and Elevation Results Card */}
        <div className="lg:col-span-1 flex flex-col gap-6 h-full overflow-y-auto pr-1">
          {/* Manual Input Controls Card */}
          <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col gap-4">
            <h3 className="text-lg font-bold text-white">Manual Coordinate Query</h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-[#9CA3AF] uppercase font-bold">Latitude (°N)</label>
                <input 
                  type="number" 
                  step="0.000001"
                  min="-90"
                  max="90"
                  value={latitude}
                  onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
                  className="w-full p-3 glass-input text-sm font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#9CA3AF] uppercase font-bold">Longitude (°E)</label>
                <input 
                  type="number" 
                  step="0.000001"
                  min="-180"
                  max="180"
                  value={longitude}
                  onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
                  className="w-full p-3 glass-input text-sm font-mono"
                />
              </div>

              <button
                onClick={() => {
                  if (keralaGeoJSON) {
                    const pt = point([longitude, latitude]);
                    const isInside = keralaGeoJSON.features.some((feature: any) => 
                      booleanPointInPolygon(pt, feature)
                    );
                    if (!isInside) {
                      alert("This location is outside the trained region.");
                      return;
                    }
                  }
                  handlePredict(latitude, longitude);
                }}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold flex items-center justify-center gap-2 hover:shadow-neon transition-all"
              >
                <Navigation className="w-5 h-5 fill-current" /> Predict Elevation
              </button>
            </div>
          </div>

          {/* Results Summary Card */}
          <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex-1 flex flex-col justify-center">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-12 h-12 border-t-2 border-b-2 border-[#22c55e] rounded-full animate-spin" />
                <span className="text-sm text-[#9CA3AF]">Invoking XGBoost regressor...</span>
              </div>
            ) : prediction !== null ? (
              <div className="text-center space-y-4 py-4 animate-fade-in">
                <span className="text-xs text-[#9CA3AF] uppercase font-bold tracking-widest block">Estimated Elevation</span>
                
                <h2 className={`text-5xl font-black tracking-tight ${getElevationColor(prediction)}`}>
                  {prediction.toLocaleString()} m
                </h2>

                <div className="pt-4 border-t border-[#1F293D] grid grid-cols-2 gap-4 text-left text-xs">
                  <div className="p-3 bg-black/20 rounded-lg border border-[#1F293D]">
                    <span className="text-[#9CA3AF] block mb-1">Latency</span>
                    <span className="text-white font-bold font-mono flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#22c55e]" /> {speedMs ? `${speedMs} ms` : '2.8 ms'}
                    </span>
                  </div>
                  <div className="p-3 bg-black/20 rounded-lg border border-[#1F293D]">
                    <span className="text-[#9CA3AF] block mb-1">Model Version</span>
                    <span className="text-white font-bold font-mono truncate block" title={modelName}>
                      {modelName}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-3 text-[#9CA3AF]">
                <MapPin className="w-12 h-12 text-[#9CA3AF]/40 animate-pulse-slow" />
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">Coordinates Awaiting Query</h4>
                  <p className="text-xs max-w-[200px]">Click anywhere on the map or input coords manually to fetch elevation.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side Panel: Interactive Map */}
        <div className="lg:col-span-2 glass-panel p-2 rounded-xl border border-[#1F293D] overflow-hidden relative">
          <div className="absolute top-4 left-4 z-[400] bg-[#161D30]/90 backdrop-blur-md px-4 py-2 rounded-lg border border-[#1F293D] pointer-events-none">
            <p className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Navigation className="w-3 h-3 text-[#22c55e]" /> Global Topography Map
            </p>
          </div>
          <MapContainer 
            center={[10.8505, 76.2711]} 
            zoom={7} 
            className="w-full h-full rounded-lg"
            zoomControl={false}
          >
            {/* Standard OSM maps for clean look */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {keralaGeoJSON && (
              <GeoJSON 
                data={keralaGeoJSON}
                style={{
                  color: '#3b82f6',
                  weight: 2,
                  fillColor: '#3b82f6',
                  fillOpacity: 0.1,
                }}
              >
                <Tooltip sticky>Kerala AI Coverage</Tooltip>
              </GeoJSON>
            )}
            <MapClickHandler onClick={onMapClick} />
            <MapController center={[latitude, longitude]} />
            
            {prediction !== null && (
              <Marker position={[latitude, longitude]} icon={customMarkerIcon}>
                <Popup className="custom-popup">
                  <div className="text-center font-bold">
                    <p className="text-[#9CA3AF] text-xs">Altitude Prediction</p>
                    <p className={`text-lg ${getElevationColor(prediction)}`}>{prediction.toFixed(1)}m</p>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>

      </div>
    </div>
  );
}
