import React, { useState, useEffect } from 'react';
import { History as HistoryIcon, Search, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';

interface HistoryItem {
  id: number;
  timestamp: string;
  latitude: number;
  longitude: number;
  predicted_altitude: number;
  status: string;
}

const mockHistory: HistoryItem[] = [];

export default function History() {
  const [history, setHistory] = useState<HistoryItem[]>(mockHistory);
  const [searchTerm, setSearchTerm] = useState('');
  const [elevationFilter, setElevationFilter] = useState('all');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'}/history`);
        if (response.ok) {
          const data = await response.json();
          setHistory(data);
        }
      } catch (err) {
        console.warn("FastAPI backend offline.");
      }
    };
    fetchHistory();
  }, []);

  const deleteItem = (id: number) => {
    setHistory(history.filter(item => item.id !== id));
  };

  const clearHistory = () => {
    if (confirm("Are you sure you want to clear all history records?")) {
      setHistory([]);
    }
  };

  const filteredHistory = history.filter(item => {
    const matchesSearch = item.latitude.toString().includes(searchTerm) || 
                          item.longitude.toString().includes(searchTerm) ||
                          item.predicted_altitude.toString().includes(searchTerm);
    
    if (elevationFilter === 'all') return matchesSearch;
    if (elevationFilter === 'low') return matchesSearch && item.predicted_altitude < 200;
    if (elevationFilter === 'mid') return matchesSearch && item.predicted_altitude >= 200 && item.predicted_altitude < 1500;
    if (elevationFilter === 'high') return matchesSearch && item.predicted_altitude >= 1500;
    
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Control bar */}
      <div className="glass-panel p-4 rounded-xl border border-[#1F293D] flex flex-wrap items-center justify-between gap-4">
        
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 flex-1 max-w-xl">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#9CA3AF]" />
            <input 
              type="text" 
              placeholder="Search by Lat, Long, Elevation..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 glass-input text-xs"
            />
          </div>

          <select 
            value={elevationFilter}
            onChange={(e) => setElevationFilter(e.target.value)}
            className="p-2 glass-input text-xs min-w-[140px]"
          >
            <option value="all">All Elevations</option>
            <option value="low">Lowlands (&lt; 200m)</option>
            <option value="mid">Midlands (200m - 1500m)</option>
            <option value="high">Highlands (1500m+)</option>
          </select>
        </div>

        {/* Action button */}
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-black transition-all rounded-lg text-xs font-bold flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" /> Clear All History
          </button>
        )}
      </div>

      {/* History log data grid */}
      <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col h-[500px]">
        <div className="flex items-center gap-3 mb-6">
          <HistoryIcon className="w-5 h-5 text-[#22c55e]" />
          <h3 className="text-lg font-bold text-white">Prediction History Logs</h3>
        </div>

        <div className="flex-1 overflow-auto border border-[#1F293D] rounded-xl bg-black/10">
          {filteredHistory.length > 0 ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#161D30]/80 sticky top-0 border-b border-[#1F293D] z-10">
                <tr>
                  <th className="p-3 uppercase font-bold text-[#9CA3AF]">Timestamp</th>
                  <th className="p-3 uppercase font-bold text-[#9CA3AF]">Latitude</th>
                  <th className="p-3 uppercase font-bold text-[#9CA3AF]">Longitude</th>
                  <th className="p-3 uppercase font-bold text-[#9CA3AF]">Predicted Altitude</th>
                  <th className="p-3 uppercase font-bold text-[#9CA3AF]">Status</th>
                  <th className="p-3 uppercase font-bold text-[#9CA3AF] text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F293D]">
                {filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-3 text-[#9CA3AF] font-mono">
                      {new Date(item.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3 text-white font-mono">{item.latitude}°N</td>
                    <td className="p-3 text-white font-mono">{item.longitude}°E</td>
                    <td className="p-3 text-[#22c55e] font-bold font-mono">{item.predicted_altitude}m</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-green-500/10 border border-green-500/30 text-green-400 rounded text-[10px] font-bold">
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button 
                        onClick={() => deleteItem(item.id)}
                        className="p-1 text-[#9CA3AF] hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                        title="Delete log record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#9CA3AF]">
              <AlertTriangle className="w-10 h-10 text-[#9CA3AF]/40 mb-3 animate-pulse-slow" />
              <h4 className="text-sm font-bold text-white mb-1">No logs matching search criteria</h4>
              <p className="text-xs max-w-sm">Adjust search filters or click Live Predictions to generate history records.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
