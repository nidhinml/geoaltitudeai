import React, { useState } from 'react';
import { UploadCloud, FileSpreadsheet, Play, Download, CheckCircle, RefreshCw } from 'lucide-react';

export default function BatchPrediction() {
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [latColumn, setLatColumn] = useState('');
  const [lonColumn, setLonColumn] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any[] | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      // Simulate reading headers
      setColumns(['id', 'latitude', 'longitude', 'location_name', 'density']);
      setLatColumn('latitude');
      setLonColumn('longitude');
      setResults(null);
      setProgress(0);
    }
  };

  const runBatchPrediction = async () => {
    if (!file) return;
    setRunning(true);
    setProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'}/predict/batch`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        // Mimic gradual progress bar update for better UI
        let progressVal = 0;
        const interval = setInterval(() => {
          progressVal += 20;
          if (progressVal >= 100) {
            clearInterval(interval);
            setResults(data.preview);
            setRunning(false);
          } else {
            setProgress(progressVal);
          }
        }, 300);
      }
    } catch (err) {
      console.warn("FastAPI backend offline.");
      setRunning(false);
    }
  };

  const handleDownload = () => {
    if (!results) return;
    
    // Create CSV content
    const headers = ['id', 'latitude', 'longitude', 'predicted_altitude'];
    const rows = results.map(row => [row.id, row.latitude, row.longitude, row.predicted_altitude]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `predictions_${file?.name || 'batch.csv'}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Upload & Configure */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col gap-5">
            <h3 className="text-lg font-bold text-white">Batch Upload</h3>

            {/* CSV File Input */}
            <div 
              className="border-2 border-dashed border-[#1F293D] hover:border-[#22c55e]/25 bg-black/10 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all"
              onClick={() => document.getElementById('batch-file-input')?.click()}
            >
              <input 
                id="batch-file-input" 
                type="file" 
                accept=".csv" 
                className="hidden" 
                onChange={handleFileChange} 
              />
              <UploadCloud className="w-8 h-8 text-[#22c55e] mb-2" />
              {file ? (
                <div>
                  <span className="text-xs font-bold text-white block truncate max-w-[180px]">{file.name}</span>
                  <span className="text-[10px] text-[#9CA3AF]">{(file.size / 1024).toFixed(1)} KB</span>
                </div>
              ) : (
                <div>
                  <span className="text-xs font-bold text-white block">Click to upload Coordinates CSV</span>
                  <span className="text-[10px] text-[#9CA3AF]">Max size 10MB</span>
                </div>
              )}
            </div>

            {/* Column Mapping (Conditional on file upload) */}
            {file && (
              <div className="space-y-4 pt-4 border-t border-[#1F293D]">
                <h4 className="text-xs font-bold text-[#9CA3AF] uppercase">Coordinate Column Mapping</h4>
                
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#9CA3AF] font-bold uppercase">Latitude Field</label>
                    <select 
                      value={latColumn} 
                      onChange={(e) => setLatColumn(e.target.value)}
                      className="w-full p-2 glass-input text-xs"
                    >
                      {columns.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-[#9CA3AF] font-bold uppercase">Longitude Field</label>
                    <select 
                      value={lonColumn} 
                      onChange={(e) => setLonColumn(e.target.value)}
                      className="w-full p-2 glass-input text-xs"
                    >
                      {columns.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                </div>

                <button
                  onClick={runBatchPrediction}
                  disabled={running}
                  className="w-full py-2.5 rounded-lg bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold flex items-center justify-center gap-2 hover:shadow-neon transition-all text-xs mt-2"
                >
                  {running ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Predictor active...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" /> Execute Batch Prediction
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Progress Card */}
          {running && (
            <div className="glass-panel p-6 rounded-xl border border-[#1F293D] space-y-3 animate-pulse">
              <h4 className="text-xs font-bold text-[#9CA3AF] uppercase">Estimator progress</h4>
              <div className="flex justify-between text-xs">
                <span>Predicting elevation values...</span>
                <span className="font-bold text-white">{progress}%</span>
              </div>
              <div className="w-full bg-[#1F293D] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#22c55e] h-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Results Grid Preview */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col h-[500px]">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-bold text-white">Batch Prediction Preview</h3>
              <p className="text-xs text-[#9CA3AF]">Output records table showing coordinates mapping to XGBoost predictions</p>
            </div>
            
            {results && (
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-gradient-to-r from-[#3b82f6] to-blue-600 hover:shadow-lg rounded-lg text-xs font-bold flex items-center gap-2 transition-all"
              >
                <Download className="w-4 h-4" /> Download Predictions
              </button>
            )}
          </div>

          <div className="flex-1 overflow-auto border border-[#1F293D] rounded-xl bg-black/10">
            {results ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#161D30]/80 sticky top-0 border-b border-[#1F293D] z-10">
                  <tr>
                    <th className="p-3 uppercase font-bold text-[#9CA3AF]">Record ID</th>
                    <th className="p-3 uppercase font-bold text-[#9CA3AF]">Latitude</th>
                    <th className="p-3 uppercase font-bold text-[#9CA3AF]">Longitude</th>
                    <th className="p-3 uppercase font-bold text-[#9CA3AF]">Predicted Altitude</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F293D]">
                  {results.map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="p-3 text-[#9CA3AF] font-mono">{row.id || idx + 1}</td>
                      <td className="p-3 text-white font-mono">{row.latitude}</td>
                      <td className="p-3 text-white font-mono">{row.longitude}</td>
                      <td className="p-3 text-[#22c55e] font-bold font-mono">{row.predicted_altitude}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#9CA3AF]">
                <FileSpreadsheet className="w-12 h-12 text-[#9CA3AF]/40 mb-3 animate-pulse-slow" />
                <h4 className="text-sm font-bold text-white mb-1">Awaiting batch inputs</h4>
                <p className="text-xs max-w-sm">Upload coordinates CSV and run calculation to display batch predictions.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
