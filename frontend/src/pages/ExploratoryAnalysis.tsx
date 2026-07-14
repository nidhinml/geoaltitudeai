import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Cell
} from 'recharts';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function ExploratoryAnalysis() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'}/dataset/eda`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch EDA data. Ensure dataset is uploaded.");
        return res.json();
      })
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-[600px]">
        <Loader2 className="w-12 h-12 text-[#3b82f6] animate-spin mb-4" />
        <p className="text-[#9CA3AF]">Analyzing dataset distribution...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center border border-[#1F293D] border-dashed rounded-xl bg-black/10 text-center p-8 h-[600px]">
        <AlertCircle className="w-12 h-12 text-red-500/40 mb-3" />
        <h4 className="text-sm font-bold text-white mb-1">Exploratory Analysis Unavailable</h4>
        <p className="text-xs text-[#9CA3AF] max-w-sm">{error}</p>
      </div>
    );
  }

  const { histograms, scatter, correlation, missing, stats } = data;

  // Correlation heatmap helpers
  const cols = Array.from(new Set(correlation.map((c: any) => c.x)));
  const getCorrColor = (val: number) => {
    // -1 to 1 => red to green
    if (val === 1) return 'bg-[#3b82f6] text-white';
    if (val > 0.5) return 'bg-[#22c55e]/80 text-white';
    if (val > 0.1) return 'bg-[#22c55e]/40 text-white';
    if (val > -0.1) return 'bg-[#1F293D] text-[#9CA3AF]';
    if (val > -0.5) return 'bg-red-500/40 text-white';
    return 'bg-red-500/80 text-white';
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Overview stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-xl border border-[#1F293D]">
          <span className="text-xs text-[#9CA3AF] uppercase font-bold tracking-wider">Elevation Skewness</span>
          <h4 className="text-2xl font-black text-white mt-1">{stats.skewness}</h4>
          <p className="text-[10px] text-[#9CA3AF] mt-1">Measures asymmetry of altitude</p>
        </div>
        <div className="glass-panel p-5 rounded-xl border border-[#1F293D]">
          <span className="text-xs text-[#9CA3AF] uppercase font-bold tracking-wider">Kurtosis</span>
          <h4 className="text-2xl font-black text-white mt-1">{stats.kurtosis}</h4>
          <p className="text-[10px] text-[#9CA3AF] mt-1">Measures tailedness of distribution</p>
        </div>
        <div className="glass-panel p-5 rounded-xl border border-[#1F293D]">
          <span className="text-xs text-[#9CA3AF] uppercase font-bold tracking-wider">Spatial Variance</span>
          <h4 className="text-2xl font-black text-white mt-1">{stats.spatial_variance}</h4>
          <p className="text-[10px] text-[#9CA3AF] mt-1">Geographic spread of data</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Histograms */}
        <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col h-[350px]">
          <h3 className="text-sm font-bold text-white mb-4">Altitude Distribution</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histograms.altitude} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" />
              <XAxis dataKey="range" stroke="#9CA3AF" fontSize={10} tick={{fill: '#9CA3AF'}} />
              <YAxis stroke="#9CA3AF" fontSize={10} tick={{fill: '#9CA3AF'}} />
              <Tooltip contentStyle={{ backgroundColor: '#161D30', borderColor: '#1F293D', borderRadius: '8px', fontSize: '12px', color: '#fff' }} cursor={{fill: '#1F293D'}} />
              <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col h-[350px]">
          <h3 className="text-sm font-bold text-white mb-4">Latitude Distribution</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histograms.latitude} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" />
              <XAxis dataKey="range" stroke="#9CA3AF" fontSize={10} />
              <YAxis stroke="#9CA3AF" fontSize={10} />
              <Tooltip contentStyle={{ backgroundColor: '#161D30', borderColor: '#1F293D', borderRadius: '8px', fontSize: '12px', color: '#fff' }} cursor={{fill: '#1F293D'}} />
              <Bar dataKey="count" fill="#22c55e" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col h-[350px]">
          <h3 className="text-sm font-bold text-white mb-4">Longitude Distribution</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histograms.longitude} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" />
              <XAxis dataKey="range" stroke="#9CA3AF" fontSize={10} />
              <YAxis stroke="#9CA3AF" fontSize={10} />
              <Tooltip contentStyle={{ backgroundColor: '#161D30', borderColor: '#1F293D', borderRadius: '8px', fontSize: '12px', color: '#fff' }} cursor={{fill: '#1F293D'}} />
              <Bar dataKey="count" fill="#f59e0b" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Missing Values */}
        <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col h-[350px]">
          <h3 className="text-sm font-bold text-white mb-4">Missing Values Profile</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={missing} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" />
              <XAxis type="number" dataKey="missing_pct" stroke="#9CA3AF" fontSize={10} unit="%" />
              <YAxis type="category" dataKey="column" stroke="#9CA3AF" fontSize={10} width={80} />
              <Tooltip contentStyle={{ backgroundColor: '#161D30', borderColor: '#1F293D', borderRadius: '8px', fontSize: '12px', color: '#fff' }} cursor={{fill: '#1F293D'}} />
              <Bar dataKey="missing_pct" fill="#ef4444" radius={[0, 4, 4, 0]}>
                {missing && missing.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.missing_pct > 50 ? '#ef4444' : '#f59e0b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Scatter: Alt vs Lat */}
        <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col h-[400px]">
          <h3 className="text-sm font-bold text-white mb-4">Altitude vs Latitude</h3>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" />
              <XAxis type="number" dataKey="lat" name="Latitude" unit="°N" stroke="#9CA3AF" fontSize={11} domain={['auto', 'auto']} />
              <YAxis type="number" dataKey="alt" name="Altitude" unit="m" stroke="#9CA3AF" fontSize={11} domain={['auto', 'auto']} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#161D30', borderColor: '#1F293D', borderRadius: '8px', fontSize: '12px', color: '#fff' }} />
              <Scatter name="Points" data={scatter.alt_vs_lat} fill="#3b82f6" opacity={0.5} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Scatter: Alt vs Lon */}
        <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col h-[400px]">
          <h3 className="text-sm font-bold text-white mb-4">Altitude vs Longitude</h3>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" />
              <XAxis type="number" dataKey="lon" name="Longitude" unit="°E" stroke="#9CA3AF" fontSize={11} domain={['auto', 'auto']} />
              <YAxis type="number" dataKey="alt" name="Altitude" unit="m" stroke="#9CA3AF" fontSize={11} domain={['auto', 'auto']} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#161D30', borderColor: '#1F293D', borderRadius: '8px', fontSize: '12px', color: '#fff' }} />
              <Scatter name="Points" data={scatter.alt_vs_lon} fill="#22c55e" opacity={0.5} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Spatial Density Map & Correlation Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        
        {/* Vehicle Density Map */}
        <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col h-[400px]">
          <h3 className="text-sm font-bold text-white mb-4">Geospatial Density (Lat/Lon)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" />
              <XAxis type="number" dataKey="lon" name="Longitude" unit="°E" stroke="#9CA3AF" fontSize={11} domain={['auto', 'auto']} />
              <YAxis type="number" dataKey="lat" name="Latitude" unit="°N" stroke="#9CA3AF" fontSize={11} domain={['auto', 'auto']} />
              <ZAxis type="number" dataKey="alt" range={[10, 50]} name="Altitude" unit="m" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#161D30', borderColor: '#1F293D', borderRadius: '8px', fontSize: '12px', color: '#fff' }} />
              <Scatter name="Geospatial Layout" data={scatter.density} fill="#f59e0b" opacity={0.4} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Correlation Matrix Heatmap */}
        <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col h-[400px]">
          <h3 className="text-sm font-bold text-white mb-4">Correlation Matrix Heatmap</h3>
          <div className="flex-1 overflow-auto rounded-lg border border-[#1F293D]">
            <div className="grid h-full" style={{ gridTemplateColumns: `auto repeat(${cols.length}, 1fr)` }}>
              {/* Header row */}
              <div className="p-3 bg-[#161D30] border-b border-r border-[#1F293D]"></div>
              {cols.map((c: any) => (
                <div key={`header-${c}`} className="p-3 bg-[#161D30] border-b border-r border-[#1F293D] text-[10px] uppercase font-bold text-[#9CA3AF] text-center truncate flex items-center justify-center">
                  {c}
                </div>
              ))}
              
              {/* Matrix rows */}
              {cols.map((rowCol: any) => (
                <React.Fragment key={`row-${rowCol}`}>
                  <div className="p-3 bg-[#161D30] border-b border-r border-[#1F293D] text-[10px] uppercase font-bold text-[#9CA3AF] flex items-center justify-end pr-4">
                    {rowCol}
                  </div>
                  {cols.map((colCol: any) => {
                    const corrItem = correlation.find((c: any) => c.x === colCol && c.y === rowCol);
                    const val = corrItem ? corrItem.value : 0;
                    return (
                      <div 
                        key={`cell-${rowCol}-${colCol}`} 
                        className={`p-3 border-b border-r border-black/20 flex items-center justify-center text-xs font-mono font-bold transition-colors ${getCorrColor(val)}`}
                        title={`${rowCol} ↔ ${colCol}: ${val}`}
                      >
                        {val.toFixed(2)}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
