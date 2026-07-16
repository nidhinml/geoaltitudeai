import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Cell
} from 'recharts';
import { AlertCircle, Loader2, Info } from 'lucide-react';

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Histograms */}
        <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col h-[350px] relative group hover:z-50">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-sm font-bold text-white">Altitude Distribution</h3>
            <Info className="w-4 h-4 text-[#9CA3AF] cursor-help hover:text-white transition-colors" />
          </div>
          
          <div className="absolute top-12 right-6 w-72 p-3 bg-[#111827] border border-[#1F293D] rounded-lg shadow-2xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 translate-y-2 group-hover:translate-y-0">
            <strong className="text-white block mb-1">What it means:</strong>
            A bar chart showing how much of our data was recorded at specific heights (e.g., mostly sea level vs mountains).
            <strong className="text-white block mt-2 mb-1">Why it is taken:</strong>
            To ensure the AI is learning from diverse terrain. If the chart shows 99% flat data, we know the AI will fail to predict mountains unless more mountain data is added!
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histograms.altitude} margin={{ top: 10, right: 10, left: 20, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" />
              <XAxis dataKey="range" stroke="#9CA3AF" fontSize={10} tick={{fill: '#9CA3AF'}} label={{ value: "Altitude Range (meters)", position: "bottom", fill: '#9CA3AF', fontSize: 12, offset: 5 }} />
              <YAxis stroke="#9CA3AF" fontSize={10} tick={{fill: '#9CA3AF'}} label={{ value: "Frequency (GPS Points)", angle: -90, position: "insideLeft", fill: '#9CA3AF', fontSize: 12, offset: -10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#161D30', borderColor: '#1F293D', borderRadius: '8px', fontSize: '12px', color: '#fff' }} cursor={{fill: '#1F293D'}} />
              <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col h-[350px] relative group hover:z-50">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-sm font-bold text-white">Latitude Distribution</h3>
            <Info className="w-4 h-4 text-[#9CA3AF] cursor-help hover:text-white transition-colors" />
          </div>

          <div className="absolute top-12 right-6 w-72 p-3 bg-[#111827] border border-[#1F293D] rounded-lg shadow-2xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 translate-y-2 group-hover:translate-y-0">
            <strong className="text-white block mb-1">What it means:</strong>
            Shows the North-to-South geographic spread of where the vehicles drove.
            <strong className="text-white block mt-2 mb-1">Why it is taken:</strong>
            To verify geographic boundaries. A massive green spike at Latitude 10°N visually proves our dataset is perfectly localized to South India (Kerala).
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histograms.latitude} margin={{ top: 10, right: 10, left: 20, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" />
              <XAxis dataKey="range" stroke="#9CA3AF" fontSize={10} label={{ value: "Latitude Range (°N)", position: "bottom", fill: '#9CA3AF', fontSize: 12, offset: 5 }} />
              <YAxis stroke="#9CA3AF" fontSize={10} label={{ value: "Frequency (GPS Points)", angle: -90, position: "insideLeft", fill: '#9CA3AF', fontSize: 12, offset: -10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#161D30', borderColor: '#1F293D', borderRadius: '8px', fontSize: '12px', color: '#fff' }} cursor={{fill: '#1F293D'}} />
              <Bar dataKey="count" fill="#22c55e" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col h-[350px] relative group hover:z-50">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-sm font-bold text-white">Longitude Distribution</h3>
            <Info className="w-4 h-4 text-[#9CA3AF] cursor-help hover:text-white transition-colors" />
          </div>

          <div className="absolute top-12 right-6 w-72 p-3 bg-[#111827] border border-[#1F293D] rounded-lg shadow-2xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 translate-y-2 group-hover:translate-y-0">
            <strong className="text-white block mb-1">What it means:</strong>
            Shows the East-to-West geographic spread of the dataset.
            <strong className="text-white block mt-2 mb-1">Why it is taken:</strong>
            A huge spike around Longitude 76°E confirms the data is isolated to our specific target region, preventing random global GPS errors from corrupting the local AI.
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histograms.longitude} margin={{ top: 10, right: 10, left: 20, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" />
              <XAxis dataKey="range" stroke="#9CA3AF" fontSize={10} label={{ value: "Longitude Range (°E)", position: "bottom", fill: '#9CA3AF', fontSize: 12, offset: 5 }} />
              <YAxis stroke="#9CA3AF" fontSize={10} label={{ value: "Frequency (GPS Points)", angle: -90, position: "insideLeft", fill: '#9CA3AF', fontSize: 12, offset: -10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#161D30', borderColor: '#1F293D', borderRadius: '8px', fontSize: '12px', color: '#fff' }} cursor={{fill: '#1F293D'}} />
              <Bar dataKey="count" fill="#f59e0b" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Missing Values */}
        <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col h-[350px] relative group hover:z-50">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-sm font-bold text-white">Missing Values Profile</h3>
            <Info className="w-4 h-4 text-[#9CA3AF] cursor-help hover:text-white transition-colors" />
          </div>

          <div className="absolute top-12 right-6 w-72 p-3 bg-[#111827] border border-[#1F293D] rounded-lg shadow-2xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 translate-y-2 group-hover:translate-y-0">
            <strong className="text-white block mb-1">What it means:</strong>
            A bar chart identifying which specific hardware sensor columns have the most missing data (blanks) across the 500k+ rows.
            <strong className="text-white block mt-2 mb-1">Why it is taken:</strong>
            If a column is 95% red (empty), we know it is completely corrupted and must delete the entire column rather than letting it confuse the AI.
          </div>
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
        <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col h-[400px] relative group hover:z-50">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-sm font-bold text-white">Altitude vs Latitude</h3>
            <Info className="w-4 h-4 text-[#9CA3AF] cursor-help hover:text-white transition-colors" />
          </div>

          <div className="absolute top-12 right-6 w-72 p-3 bg-[#111827] border border-[#1F293D] rounded-lg shadow-2xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 translate-y-2 group-hover:translate-y-0">
            <strong className="text-white block mb-1">What it means:</strong>
            A scatter plot correlating North-South position with altitude.
            <strong className="text-white block mt-2 mb-1">Why it is taken:</strong>
            To see if driving further North or South naturally leads to higher elevations in this specific dataset (like driving North towards the Himalayas).
          </div>
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
        <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col h-[400px] relative group hover:z-50">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-sm font-bold text-white">Altitude vs Longitude</h3>
            <Info className="w-4 h-4 text-[#9CA3AF] cursor-help hover:text-white transition-colors" />
          </div>

          <div className="absolute top-12 right-6 w-72 p-3 bg-[#111827] border border-[#1F293D] rounded-lg shadow-2xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 translate-y-2 group-hover:translate-y-0">
            <strong className="text-white block mb-1">What it means:</strong>
            A scatter plot correlating East-West position with altitude.
            <strong className="text-white block mt-2 mb-1">Why it is taken:</strong>
            To see if moving East or West leads to mountains. In Kerala, moving East from the coast always leads into the Western Ghats mountains, which should be clearly visible in this pattern!
          </div>
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
        <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col h-[400px] relative group hover:z-50">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-sm font-bold text-white">Geospatial Density (Lat/Lon)</h3>
            <Info className="w-4 h-4 text-[#9CA3AF] cursor-help hover:text-white transition-colors" />
          </div>

          <div className="absolute top-12 right-6 w-72 p-3 bg-[#111827] border border-[#1F293D] rounded-lg shadow-2xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 translate-y-2 group-hover:translate-y-0">
            <strong className="text-white block mb-1">What it means:</strong>
            A 2D overhead scatter map (like looking from space) showing exactly where the vehicles physically drove to record data.
            <strong className="text-white block mt-2 mb-1">Why it is taken:</strong>
            To visually prove that our training data covers the exact road networks we want the AI to learn. If a region has no yellow dots, the AI will be "blind" in that area.
          </div>
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
        <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col h-[400px] relative group hover:z-50">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-sm font-bold text-white">Correlation Matrix Heatmap</h3>
            <Info className="w-4 h-4 text-[#9CA3AF] cursor-help hover:text-white transition-colors" />
          </div>

          <div className="absolute top-12 right-6 w-72 p-3 bg-[#111827] border border-[#1F293D] rounded-lg shadow-2xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 translate-y-2 group-hover:translate-y-0">
            <strong className="text-white block mb-1">What it means:</strong>
            A grid showing how mathematically related every sensor is to each other (1 = Perfect Match, 0 = No Relation, -1 = Exact Opposite).
            <strong className="text-white block mt-2 mb-1">Why it is taken:</strong>
            To remove redundant data and make the AI faster. If Speed and Engine RPM are perfectly correlated (e.g., 0.99 match), we can delete one of them to save computing power, because the AI only needs one to learn!
          </div>
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
