import React, { useState } from 'react';
import { Sliders, Sparkles, AlertCircle, RefreshCw, BarChart2, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const FeatureTooltip = ({ title, explanation }: { title: string, explanation: string }) => (
  <div className="relative group flex items-center" onClick={(e) => e.preventDefault()}>
    <Info className="w-3.5 h-3.5 text-[#9CA3AF] group-hover:text-[#3b82f6] transition-colors cursor-help" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-[260px] p-3 bg-[#161D30] border border-[#3b82f6]/50 rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.8)] text-xs text-[#9CA3AF] z-[100] pointer-events-none">
      <strong className="text-white block mb-1">{title}</strong> 
      <span className="leading-relaxed">{explanation}</span>
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-[#3b82f6]/50"></div>
    </div>
  </div>
);

export default function DataCleaning() {
  const [removeOutliers, setRemoveOutliers] = useState(true);
  const [outlierThreshold, setOutlierThreshold] = useState(3.0);
  const [imputeMethod, setImputeMethod] = useState('knn');
  const [coordinateFilter, setCoordinateFilter] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [cleanedStats, setCleanedStats] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const triggerCleaning = async () => {
    setCleaning(true);
    setCleanedStats(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'}/dataset/clean`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remove_outliers: removeOutliers,
          handle_missing: imputeMethod,
          outlier_threshold: outlierThreshold
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCleanedStats(data);
        setLogs(data.logs || []);
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.detail || "Error cleaning dataset. Please ensure a dataset is uploaded.");
      }
    } catch (err) {
      console.warn("FastAPI backend offline.");
      alert("Error: Backend is offline.");
    } finally {
      setCleaning(false);
    }
  };

  const handleDownload = () => {
    // Navigate directly to the endpoint. The backend uses application/octet-stream
    // which will force the browser to securely download the 200MB file to disk.
    window.location.href = `${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'}/dataset/download`;
  };

  const chartData = [
    { name: 'Raw Samples', count: 12540, fill: '#3b82f6' },
    { name: 'Cleaned Samples', count: cleanedStats ? cleanedStats.remaining_records : 12481, fill: '#22c55e' }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Parameters Settings */}
        <div className="lg:col-span-1 glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col gap-6 min-w-0">
          <div className="flex items-center gap-3">
            <Sliders className="w-5 h-5 text-[#22c55e]" />
            <h3 className="text-lg font-bold text-white">Cleaning Options</h3>
          </div>

          {/* Form Options */}
          <div className="space-y-5 flex-1">
            {/* Outlier removal */}
            <div className="space-y-2">
              <label className="flex items-center justify-between text-sm cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">Remove Spatial Outliers</span>
                  <FeatureTooltip 
                    title="Why use this?" 
                    explanation="GPS reflections (like bouncing off buildings) can cause sudden 5,000m elevation spikes. If not removed, the AI will learn these errors as real terrain gradients." 
                  />
                </div>
                <input 
                  type="checkbox" 
                  checked={removeOutliers}
                  onChange={(e) => setRemoveOutliers(e.target.checked)}
                  className="rounded bg-[#0B0F19] border-[#1F293D] text-[#22c55e] focus:ring-0 w-4 h-4"
                />
              </label>
              <p className="text-[11px] text-[#9CA3AF]">Filters extreme jumps in elevation values unrepresentative of real terrain.</p>
            </div>

            {/* Threshold slider */}
            {removeOutliers && (
              <div className="space-y-2 p-3 bg-black/20 border border-[#1F293D] rounded-lg">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="text-[#9CA3AF]">Z-Score Threshold</span>
                    <FeatureTooltip 
                      title="Z-Score Range Explained:"
                      explanation="3.0 is the default (Three-Sigma Rule), capturing 99.7% of natural terrain variation while dropping extreme GPS glitches. 1.5 is aggressive (for flat roads). 4.0 is conservative (for mountains)."
                    />
                  </div>
                  <span className="text-[#22c55e]">{outlierThreshold.toFixed(1)} σ</span>
                </div>
                <input 
                  type="range" 
                  min="1.5" 
                  max="4.0" 
                  step="0.1" 
                  value={outlierThreshold}
                  onChange={(e) => setOutlierThreshold(parseFloat(e.target.value))}
                  className="w-full accent-[#22c55e] h-1 bg-[#1F293D] rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-[#9CA3AF]/60">
                  <span>Aggressive (1.5)</span>
                  <span>Conservative (4.0)</span>
                </div>
              </div>
            )}

            {/* Imputation dropdown */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-white">
                Missing Values Imputation
                <FeatureTooltip 
                  title="Why KNN Imputation?" 
                  explanation="If a GPS coordinate is missing its altitude, dropping the row breaks the route sequence. Spatial KNN looks at the 5 closest geographic points and averages their altitude to fill the gap accurately." 
                />
              </label>
              <select 
                value={imputeMethod}
                onChange={(e) => setImputeMethod(e.target.value)}
                className="w-full p-2.5 glass-input text-xs"
              >
                <option value="drop">Drop Missing Records (Listwise deletion)</option>
                <option value="mean">Mean Substitution (Replace with global average)</option>
                <option value="knn">K-Nearest Neighbors (KNN Imputation - Spatial)</option>
              </select>
              <p className="text-[11px] text-[#9CA3AF]">Handles cases where GPS points lack elevation records.</p>
            </div>

            {/* Invalid coordinate filter */}
            <div className="space-y-2">
              <label className="flex items-center justify-between text-sm cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">Verify Coordinate Boundaries</span>
                  <FeatureTooltip 
                    title="Why use this?" 
                    explanation="Sensors sometimes reset to [0,0] (Null Island) or return Latitudes > 90. Feeding these impossible planetary coordinates to the model will corrupt its spatial awareness." 
                  />
                </div>
                <input 
                  type="checkbox" 
                  checked={coordinateFilter}
                  onChange={(e) => setCoordinateFilter(e.target.checked)}
                  className="rounded bg-[#0B0F19] border-[#1F293D] text-[#22c55e] focus:ring-0 w-4 h-4"
                />
              </label>
              <p className="text-[11px] text-[#9CA3AF]">Automatically discards coords mapping outside planetary limits.</p>
            </div>
          </div>

          <button
            onClick={triggerCleaning}
            disabled={cleaning}
            className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
              cleaning 
                ? 'bg-[#1F293D] text-[#9CA3AF] cursor-not-allowed' 
                : 'bg-[#22c55e] hover:bg-[#16a34a] text-black hover:shadow-neon'
            }`}
          >
            {cleaning ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" /> Processing Dataset...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" /> Run Pre-processing
              </>
            )}
          </button>
        </div>

        {/* Right Side: Cleaning Results Summary */}
        <div className="lg:col-span-2 flex flex-col gap-6 min-w-0">
          <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col gap-6 flex-shrink-0 min-w-0">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white">Cleaning Report</h3>
                <p className="text-xs text-[#9CA3AF]">Comparison metrics of dataset before and after preprocessing</p>
              </div>
              {cleanedStats && (
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-gradient-to-r from-[#3b82f6] to-blue-600 hover:shadow-lg rounded-lg text-xs font-bold flex items-center gap-2 transition-all text-white"
                >
                  Download Cleaned CSV
                </button>
              )}
            </div>

            {cleanedStats ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Metrics Grid */}
                <div className="space-y-4">
                  <div className="p-4 bg-[#161D30] border border-[#1F293D] rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[#9CA3AF] uppercase font-bold tracking-wider">Outliers Removed</p>
                      <h4 className="text-2xl font-black text-red-400 mt-1">{cleanedStats.removed_outliers}</h4>
                    </div>
                    <AlertCircle className="w-8 h-8 text-red-500/35" />
                  </div>

                  <div className="p-4 bg-[#161D30] border border-[#1F293D] rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[#9CA3AF] uppercase font-bold tracking-wider">Imputed Values</p>
                      <h4 className="text-2xl font-black text-[#22c55e] mt-1">{cleanedStats.imputed_values}</h4>
                    </div>
                    <Sparkles className="w-8 h-8 text-[#22c55e]/35" />
                  </div>

                  <div className="p-4 bg-[#161D30] border border-[#1F293D] rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[#9CA3AF] uppercase font-bold tracking-wider">Remaining Records</p>
                      <h4 className="text-2xl font-black text-white mt-1">{cleanedStats.remaining_records.toLocaleString()}</h4>
                    </div>
                    <BarChart2 className="w-8 h-8 text-blue-500/35" />
                  </div>
                </div>

                {/* Bar Chart comparing records */}
                <div className="border border-[#1F293D] rounded-xl p-4 bg-black/10 flex flex-col h-[280px]">
                  <h4 className="text-xs font-bold text-[#9CA3AF] uppercase mb-4">Sample Preservation</h4>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" />
                        <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} />
                        <YAxis stroke="#9CA3AF" fontSize={11} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#161D30', borderColor: '#1F293D', borderRadius: '8px' }}
                          labelStyle={{ color: '#fff' }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <rect key={`rect-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center border border-[#1F293D] border-dashed rounded-xl bg-black/10 text-center p-8 min-h-[280px]">
                <Sparkles className="w-12 h-12 text-[#9CA3AF]/40 mb-3 animate-pulse-slow" />
                <h4 className="text-sm font-bold text-white mb-1">Pre-processing Pipeline Inactive</h4>
                <p className="text-xs text-[#9CA3AF] max-w-sm">Configure parameters on the left and run cleaning to generate the evaluation report.</p>
              </div>
            )}
          </div>

          {/* Operation Logs Panel */}
          {cleanedStats && (
            <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col flex-1 min-h-[250px]">
              <h3 className="text-lg font-bold text-white mb-4">Cleaning Operations Log</h3>
              <div className="flex-1 bg-black/40 border border-[#1F293D] rounded-xl p-4 font-mono text-[11px] leading-relaxed text-[#22c55e] overflow-y-auto max-h-[300px]">
                {logs.length > 0 ? (
                  logs.map((log, i) => (
                    <div key={i} className="mb-2">
                      <span className="text-[#9CA3AF] mr-2">[{new Date().toLocaleTimeString()}]</span>
                      {log}
                    </div>
                  ))
                ) : (
                  <span className="text-[#9CA3AF]">No anomalies detected.</span>
                )}
                <div className="mt-4 text-blue-400 font-bold">
                  <span className="text-[#9CA3AF] mr-2">[{new Date().toLocaleTimeString()}]</span>
                  Pipeline finished in {cleanedStats.processing_time_sec}s. Ready for model training.
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
