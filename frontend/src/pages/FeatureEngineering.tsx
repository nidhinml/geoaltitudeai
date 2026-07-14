import React, { useState } from 'react';
import { Cpu, Check, AlertCircle, Loader2 } from 'lucide-react';

export default function FeatureEngineering() {
  const [config, setConfig] = useState({
    add_lat_sq: true,
    add_lon_sq: true,
    add_lat_lon: true,
    normalize: true,
    test_size: 0.2,
    random_state: 42,
    shuffle: true
  });
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleFeature = (key: string) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key as keyof typeof config] }));
  };

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'}/dataset/features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to run feature engineering.");
      }
      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Columns: Config Control */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="glass-panel p-6 rounded-xl border border-[#1F293D]">
            <h3 className="text-lg font-bold text-white mb-4">Polynomial Features</h3>
            <div className="space-y-3">
              {[
                { id: 'add_lat_sq', name: 'Latitude²' },
                { id: 'add_lon_sq', name: 'Longitude²' },
                { id: 'add_lat_lon', name: 'Latitude × Longitude' },
                { id: 'normalize', name: 'Normalize (StandardScaler)' },
              ].map((feat) => (
                <div 
                  key={feat.id} 
                  className={`p-3 rounded-lg border transition-all flex items-center gap-3 cursor-pointer ${
                    config[feat.id as keyof typeof config] 
                      ? 'bg-[#161D30] border-[#22c55e]/30' 
                      : 'bg-black/10 border-[#1F293D] opacity-60'
                  }`}
                  onClick={() => toggleFeature(feat.id)}
                >
                  <div className={`p-1 rounded-md border transition-all ${
                    config[feat.id as keyof typeof config] 
                      ? 'bg-[#22c55e] border-[#22c55e] text-black' 
                      : 'bg-transparent border-[#1F293D] text-transparent'
                  }`}>
                    <Check className="w-3 h-3" />
                  </div>
                  <span className="text-sm font-bold text-white">{feat.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel p-6 rounded-xl border border-[#1F293D]">
            <h3 className="text-lg font-bold text-white mb-4">Train / Test Split</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#9CA3AF] block mb-2">Test Size ({Math.round(config.test_size * 100)}%)</label>
                <input 
                  type="range" min="0.1" max="0.5" step="0.05"
                  value={config.test_size}
                  onChange={(e) => setConfig({...config, test_size: parseFloat(e.target.value)})}
                  className="w-full accent-[#3b82f6]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#9CA3AF] block mb-2">Random State</label>
                <input 
                  type="number"
                  value={config.random_state}
                  onChange={(e) => setConfig({...config, random_state: parseInt(e.target.value)})}
                  className="w-full bg-[#161D30] border border-[#1F293D] rounded-lg p-2 text-white text-sm focus:outline-none focus:border-[#3b82f6]"
                />
              </div>
              <div 
                className={`p-3 rounded-lg border transition-all flex items-center gap-3 cursor-pointer ${
                  config.shuffle 
                    ? 'bg-[#161D30] border-[#3b82f6]/30' 
                    : 'bg-black/10 border-[#1F293D] opacity-60'
                }`}
                onClick={() => toggleFeature('shuffle')}
              >
                <div className={`p-1 rounded-md border transition-all ${
                  config.shuffle 
                    ? 'bg-[#3b82f6] border-[#3b82f6] text-black' 
                    : 'bg-transparent border-[#1F293D] text-transparent'
                }`}>
                  <Check className="w-3 h-3" />
                </div>
                <span className="text-sm font-bold text-white">Shuffle Data</span>
              </div>
            </div>
          </div>

          <button 
            onClick={handleRun}
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-[#22c55e] to-emerald-600 hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] rounded-xl text-sm font-bold transition-all text-white flex justify-center items-center"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Run Feature Engineering'}
          </button>
        </div>

        {/* Right Column: Preview Matrix */}
        <div className="lg:col-span-8 glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col min-h-[550px]">
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <Cpu className="w-5 h-5 text-[#3b82f6]" />
              <h3 className="text-lg font-bold text-white">Feature Matrix Preview</h3>
            </div>
            <p className="text-xs text-[#9CA3AF] mt-1">Snapshot of the final engineered data ready for XGBoost.</p>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-400 text-sm mb-4">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {result ? (
            <div className="flex flex-col h-full gap-4">
              <div className="flex gap-4">
                <div className="flex-1 bg-[#161D30] border border-[#1F293D] p-4 rounded-xl">
                  <span className="text-xs text-[#9CA3AF] uppercase font-bold tracking-wider">Training Samples</span>
                  <h4 className="text-2xl font-black text-white mt-1">{result.train_samples.toLocaleString()}</h4>
                </div>
                <div className="flex-1 bg-[#161D30] border border-[#1F293D] p-4 rounded-xl">
                  <span className="text-xs text-[#9CA3AF] uppercase font-bold tracking-wider">Testing Samples</span>
                  <h4 className="text-2xl font-black text-[#3b82f6] mt-1">{result.test_samples.toLocaleString()}</h4>
                </div>
                <div className="flex-1 bg-[#161D30] border border-[#1F293D] p-4 rounded-xl">
                  <span className="text-xs text-[#9CA3AF] uppercase font-bold tracking-wider">Total Features</span>
                  <h4 className="text-2xl font-black text-[#22c55e] mt-1">{result.features.length}</h4>
                </div>
              </div>

              <div className="flex-1 overflow-auto rounded-xl border border-[#1F293D] bg-[#161D30]/50 mt-2">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#1F293D] text-[#9CA3AF] uppercase font-bold tracking-wider sticky top-0">
                    <tr>
                      {result.features.map((f: string) => (
                        <th key={f} className="p-3 whitespace-nowrap">{f}</th>
                      ))}
                      <th className="p-3 text-[#22c55e] bg-[#22c55e]/10">altitude_target</th>
                    </tr>
                  </thead>
                  <tbody className="text-white font-mono">
                    {result.preview.map((row: any, i: number) => (
                      <tr key={i} className="border-b border-[#1F293D]/50 hover:bg-[#1F293D]/30 transition-colors">
                        {result.features.map((f: string) => (
                          <td key={f} className="p-3 whitespace-nowrap">{row[f] !== undefined && row[f] !== null ? row[f] : 'NaN'}</td>
                        ))}
                        <td className="p-3 text-[#22c55e] bg-[#22c55e]/5 whitespace-nowrap">{row.altitude_target}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-[#9CA3AF] text-center mt-2">Showing first 5 rows of the Training Dataset. Data is normalized if configured.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center border border-[#1F293D] border-dashed rounded-xl bg-black/10 text-center p-8">
              <Cpu className="w-12 h-12 text-[#9CA3AF]/40 mb-3" />
              <h4 className="text-sm font-bold text-white mb-1">Awaiting Generation</h4>
              <p className="text-xs text-[#9CA3AF] max-w-sm">Configure your features on the left and run the process to generate the ML matrix.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
