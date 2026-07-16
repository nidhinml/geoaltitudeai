import React, { useState, useEffect } from 'react';
import { 
  Activity, CheckCircle, AlertTriangle, XCircle, Map as MapIcon, 
  BarChart2, List, RefreshCw, Server, ArrowRight, UploadCloud, Play, Eye, EyeOff, Brain, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api');

export default function ModelFeedback() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'predictions' | 'analytics' | 'map' | 'versions'>('dashboard');
  
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [mapPoints, setMapPoints] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showMapTutorial, setShowMapTutorial] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dashRes, recRes, anRes, mapRes, verRes] = await Promise.all([
        fetch(`${API_BASE}/feedback/dashboard`),
        fetch(`${API_BASE}/feedback/records`),
        fetch(`${API_BASE}/feedback/analytics`),
        fetch(`${API_BASE}/feedback/map`),
        fetch(`${API_BASE}/model/versions`)
      ]);
      
      setDashboardData(await dashRes.json());
      setRecords(await recRes.json());
      setAnalytics(await anRes.json());
      setMapPoints(await mapRes.json());
      setVersions(await verRes.json());
    } catch (e) {
      console.error("Failed to load feedback data:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const activateVersion = async (versionId: string) => {
    try {
      const res = await fetch(`${API_BASE}/model/versions/activate/${versionId}`, { method: 'POST' });
      if (res.ok) {
        alert(`Successfully activated model version ${versionId}`);
        fetchData();
      } else {
        alert("Failed to activate version.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getHealthIcon = (score: string) => {
    if (score === 'Excellent') return <CheckCircle className="w-8 h-8 text-green-500" />;
    if (score === 'Good') return <CheckCircle className="w-8 h-8 text-blue-500" />;
    if (score === 'Fair') return <AlertTriangle className="w-8 h-8 text-yellow-500" />;
    return <XCircle className="w-8 h-8 text-red-500" />;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto h-[calc(100vh-2rem)] flex flex-col">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <RefreshCw className="w-8 h-8 text-[#3b82f6]" />
            Model Feedback & Versioning
          </h1>
          <p className="text-[#9CA3AF] mt-2">
            Continuously evaluate AI model performance against ground truth and manage training pipelines.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
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
            {showMapTutorial ? 'Hide Architecture' : 'Tech Architecture'}
          </button>
          <button 
            onClick={() => setShowTutorial(!showTutorial)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#161D30] hover:bg-[#1F293D] text-[#9CA3AF] hover:text-white text-xs font-bold rounded-lg border border-[#1F293D] transition-colors"
          >
            {showTutorial ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showTutorial ? 'Hide AI Logic' : 'How AI Works'}
          </button>
          <button 
            onClick={fetchData}
            className="bg-[#1F293D] hover:bg-[#263554] border border-white/10 text-white px-4 py-1.5 text-xs font-bold rounded-lg flex items-center gap-2 transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Refresh Data
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
          <li><strong>Check Health:</strong> Review the Dashboard to see the overall AI Health Score and Mean Error across all user sessions.</li>
          <li><strong>Review Log:</strong> Navigate to the Predictions tab to see raw incoming telemetry from active users.</li>
          <li><strong>Spot Mistakes:</strong> Use the Map View to visually locate where the AI makes the biggest mistakes (red dots).</li>
          <li><strong>Hot-Swap Models:</strong> If the current model degrades, go to Version Control and Activate a previous/better version without downtime.</li>
        </ol>
      </div>
      )}

      {/* TECH ARCHITECTURE */}
      {showMapTutorial && (
      <div className="glass-panel p-5 rounded-2xl border border-[#1F293D] mb-6 bg-[#0B0F19]">
        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
          <MapIcon className="w-4 h-4 text-[#3b82f6]" /> Platform Architecture
        </h3>
        <p className="text-sm text-[#9CA3AF] leading-relaxed">
          <strong className="text-white">Continuous Learning Pipeline:</strong> When users query the AI in production, their GPS points and predictions are logged into a PostgreSQL table. Later, verified Ground Truth data (via a trusted DEM API) is fetched asynchronously by a background Celery worker to calculate the error rates. 
          This feedback loop is automatically monitored, and retraining jobs can be triggered dynamically.
        </p>
      </div>
      )}

      {/* HOW AI WORKS */}
      {showTutorial && (
      <div className="glass-panel p-5 rounded-2xl border border-[#1F293D] mb-6 bg-[#0B0F19]">
        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
          <Brain className="w-4 h-4 text-[#22c55e]" /> Drift & Performance Degradation
        </h3>
        <p className="text-sm text-[#9CA3AF] leading-relaxed">
          <strong className="text-white">Why Models Fail:</strong> Over time, the types of locations users query might shift. If users start querying high-altitude mountainous areas but the model was heavily trained on coastal plains, the Error Distribution (Analytics Tab) will start skewing right. 
          This phenomenon is called <em>Data Drift</em>. Monitoring MAE (Mean Absolute Error) ensures we detect this drift before the predictions become dangerous for routing applications.
        </p>
      </div>
      )}

      <div className="flex gap-2 border-b border-[#1F293D] pb-1 mb-6">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: Activity },
          { id: 'predictions', label: 'Predictions', icon: List },
          { id: 'analytics', label: 'Error Analytics', icon: BarChart2 },
          { id: 'map', label: 'Map View', icon: MapIcon },
          { id: 'versions', label: 'Version Control', icon: Server }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-t-lg flex items-center gap-2 text-sm font-bold transition-all ${
              activeTab === tab.id 
                ? 'bg-[#3b82f6]/20 text-[#3b82f6] border-b-2 border-[#3b82f6]' 
                : 'text-[#9CA3AF] hover:bg-[#1F293D]'
            }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-8 h-8 border-4 border-[#3b82f6] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* DASHBOARD TAB */}
              {activeTab === 'dashboard' && dashboardData && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex items-center gap-4">
                      {getHealthIcon(dashboardData.health_score)}
                      <div>
                        <p className="text-[10px] text-[#9CA3AF] font-bold uppercase">AI Health Score</p>
                        <h3 className="text-2xl font-black text-white">{dashboardData.health_score}</h3>
                      </div>
                    </div>
                    <div className="glass-panel p-6 rounded-xl border border-[#1F293D]">
                      <p className="text-[10px] text-[#9CA3AF] font-bold uppercase">Total Feedback Points</p>
                      <h3 className="text-3xl font-black text-white mt-1">{dashboardData.total_predictions}</h3>
                    </div>
                    <div className="glass-panel p-6 rounded-xl border border-[#1F293D]">
                      <p className="text-[10px] text-[#9CA3AF] font-bold uppercase">Average Abs. Error</p>
                      <div className="flex items-baseline gap-1 mt-1">
                        <h3 className="text-3xl font-black text-white">{dashboardData.avg_error.toFixed(1)}</h3>
                        <span className="text-sm text-[#9CA3AF]">m</span>
                      </div>
                    </div>
                    <div className="glass-panel p-6 rounded-xl border border-[#1F293D]">
                      <p className="text-[10px] text-[#9CA3AF] font-bold uppercase">Max Recorded Error</p>
                      <div className="flex items-baseline gap-1 mt-1">
                        <h3 className="text-3xl font-black text-rose-500">{dashboardData.max_error.toFixed(1)}</h3>
                        <span className="text-sm text-[#9CA3AF]">m</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PREDICTIONS TAB */}
              {activeTab === 'predictions' && (
                <div className="glass-panel rounded-xl border border-[#1F293D] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-[#9CA3AF]">
                      <thead className="text-xs uppercase bg-[#0B0F19] text-white border-b border-[#1F293D]">
                        <tr>
                          <th className="px-4 py-3">Timestamp</th>
                          <th className="px-4 py-3">Coords</th>
                          <th className="px-4 py-3">Predicted</th>
                          <th className="px-4 py-3">Actual</th>
                          <th className="px-4 py-3">Error</th>
                          <th className="px-4 py-3">Version</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1F293D]">
                        {records.map((r, i) => (
                          <tr key={i} className="hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3 font-mono text-[10px]">{new Date(r.timestamp).toLocaleString()}</td>
                            <td className="px-4 py-3 font-mono text-[10px]">{r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}</td>
                            <td className="px-4 py-3 font-bold text-white">{r.predicted_altitude.toFixed(1)}m</td>
                            <td className="px-4 py-3 font-bold text-[#3b82f6]">{r.actual_altitude.toFixed(1)}m</td>
                            <td className={`px-4 py-3 font-bold ${r.absolute_error > 10 ? 'text-rose-500' : 'text-green-500'}`}>
                              ±{r.absolute_error.toFixed(1)}m
                            </td>
                            <td className="px-4 py-3 text-[10px] bg-white/5 px-2 rounded-md">{r.model_version}</td>
                          </tr>
                        ))}
                        {records.length === 0 && (
                          <tr><td colSpan={6} className="text-center py-10 italic">No feedback data available yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ANALYTICS TAB */}
              {activeTab === 'analytics' && analytics && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="glass-panel p-5 rounded-xl border border-[#1F293D]">
                      <p className="text-xs text-[#9CA3AF] font-bold uppercase mb-1">MAE (Mean Abs Error)</p>
                      <h3 className="text-2xl font-black text-white">{analytics.mae} m</h3>
                    </div>
                    <div className="glass-panel p-5 rounded-xl border border-[#1F293D]">
                      <p className="text-xs text-[#9CA3AF] font-bold uppercase mb-1">RMSE</p>
                      <h3 className="text-2xl font-black text-white">{analytics.rmse}</h3>
                    </div>
                    <div className="glass-panel p-5 rounded-xl border border-[#1F293D]">
                      <p className="text-xs text-[#9CA3AF] font-bold uppercase mb-1">MAPE</p>
                      <h3 className="text-2xl font-black text-white">{analytics.mape}%</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="glass-panel p-5 rounded-xl border border-[#1F293D] h-[350px]">
                      <h3 className="text-sm font-bold text-white mb-4">Error Distribution</h3>
                      <ResponsiveContainer width="100%" height="80%">
                        <BarChart data={analytics.distribution}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" vertical={false} />
                          <XAxis dataKey="range" stroke="#9CA3AF" fontSize={10} />
                          <YAxis stroke="#9CA3AF" fontSize={10} />
                          <RechartsTooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#1F293D' }} />
                          <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="glass-panel p-5 rounded-xl border border-[#1F293D] h-[350px]">
                      <h3 className="text-sm font-bold text-white mb-4">Average Error by Elevation Zone</h3>
                      <ResponsiveContainer width="100%" height="80%">
                        <BarChart data={analytics.terrain_errors} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" horizontal={false} />
                          <XAxis type="number" stroke="#9CA3AF" fontSize={10} />
                          <YAxis dataKey="zone" type="category" stroke="#9CA3AF" fontSize={10} width={120} />
                          <RechartsTooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#1F293D' }} />
                          <Bar dataKey="avg_error" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Avg Error (m)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* MAP VIEW TAB */}
              {activeTab === 'map' && (
                <div className="glass-panel p-2 rounded-xl border border-[#1F293D] h-[600px] overflow-hidden relative">
                  <MapContainer center={[10.8505, 76.2711]} zoom={7} className="w-full h-full rounded-lg bg-[#0B0F19]">
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                    {mapPoints.map((pt, i) => (
                      <CircleMarker 
                        key={i} 
                        center={[pt.latitude, pt.longitude]} 
                        radius={6}
                        fillColor={pt.color}
                        color={pt.color}
                        weight={1}
                        fillOpacity={0.7}
                      >
                        <Popup className="custom-popup">
                          <div className="text-white p-1">
                            <h4 className="font-bold border-b border-white/20 pb-1 mb-2">{pt.status}</h4>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <span className="text-gray-400">Predicted:</span>
                              <span className="font-bold">{pt.predicted.toFixed(1)}m</span>
                              <span className="text-gray-400">Actual:</span>
                              <span className="font-bold text-blue-400">{pt.actual.toFixed(1)}m</span>
                              <span className="text-gray-400">Error:</span>
                              <span className={`font-bold ${pt.color === '#ef4444' ? 'text-red-400' : 'text-green-400'}`}>±{pt.error.toFixed(1)}m</span>
                            </div>
                            <p className="text-[9px] text-gray-500 mt-2 font-mono">{new Date(pt.timestamp).toLocaleString()}</p>
                          </div>
                        </Popup>
                      </CircleMarker>
                    ))}
                  </MapContainer>
                  
                  <div className="absolute top-4 right-4 bg-[#0B0F19]/90 backdrop-blur-md p-3 rounded-lg border border-[#1F293D] z-[1000] text-xs">
                    <h4 className="font-bold text-white mb-2">Error Severity</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#22c55e]"></div> <span className="text-gray-300">&lt; 2m (Excellent)</span></div>
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#eab308]"></div> <span className="text-gray-300">2m - 5m (Acceptable)</span></div>
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#f97316]"></div> <span className="text-gray-300">5m - 15m (Needs Impr.)</span></div>
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#ef4444]"></div> <span className="text-gray-300">&gt; 15m (Poor)</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* VERSIONS TAB */}
              {activeTab === 'versions' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-[#3b82f6]/10 border border-[#3b82f6]/30 p-4 rounded-xl">
                    <div>
                      <h3 className="text-white font-bold flex items-center gap-2"><Server className="w-4 h-4 text-[#3b82f6]" /> Model Registry</h3>
                      <p className="text-xs text-[#9CA3AF] mt-1">Manage trained iterations and hot-swap active models.</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {versions.map((v, i) => (
                      <div key={i} className="glass-panel p-5 rounded-xl border border-[#1F293D] flex items-center justify-between hover:border-[#3b82f6]/50 transition-all">
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-black text-white">{v.version}</h3>
                            {i === versions.length - 1 && <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded border border-green-500/30">LATEST</span>}
                          </div>
                          <p className="text-xs text-[#9CA3AF] mt-1 font-mono">Trained: {new Date(v.training_date).toLocaleString()} | Rows: {v.dataset_size}</p>
                          
                          <div className="flex items-center gap-4 mt-3">
                            <span className="text-xs font-bold text-white bg-black/50 px-2 py-1 rounded border border-white/5">R²: {v.r2_score.toFixed(3)}</span>
                            <span className="text-xs font-bold text-white bg-black/50 px-2 py-1 rounded border border-white/5">RMSE: {v.rmse.toFixed(2)}</span>
                            <span className="text-xs font-bold text-white bg-black/50 px-2 py-1 rounded border border-white/5">MAE: {v.mae.toFixed(2)}</span>
                          </div>
                        </div>
                        
                        <button 
                          onClick={() => activateVersion(v.version)}
                          className="bg-[#1F293D] hover:bg-[#3b82f6] text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                        >
                          <Play className="w-4 h-4" /> Activate
                        </button>
                      </div>
                    ))}
                    {versions.length === 0 && (
                      <div className="text-center p-10 text-gray-500 italic">No models registered yet. Go train one!</div>
                    )}
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
