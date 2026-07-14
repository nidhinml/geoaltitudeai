import React, { useState, useEffect } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, Database, Check, Cpu, Table, FileWarning, Layers } from 'lucide-react';

interface DatasetStats {
  filename: string;
  total_records: number;
  total_columns: number;
  memory_usage_mb: number;
  missing_values: number;
  duplicate_rows: number;
  column_types: Record<string, string>;
  missing_values_by_column: Record<string, number>;
  summary_stats: Record<string, {
    count: number;
    mean: number;
    std: number;
    min: number;
    max: number;
  }>;
  preview: Array<Record<string, any>>;
}



export default function Dataset() {
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'}/dataset/info`);
      if (response.ok) {
        const data = await response.json();
        if (Object.keys(data).length === 0) {
          setStats(null);
        } else {
          setStats(data);
        }
      }
    } catch (err) {
      console.warn("FastAPI backend offline.");
      setStats(null);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
        await uploadFile(droppedFile);
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      await uploadFile(selectedFile);
    }
  };

  const uploadFile = async (fileToUpload: File) => {
    setIsUploading(true);
    setUploadSuccess(false);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'}/dataset/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
          'X-File-Name': fileToUpload.name
        },
        body: fileToUpload,
      });

      if (response.ok) {
        const result = await response.json();
        setStats(result.stats);
        setUploadSuccess(true);
      } else {
        const errText = await response.text();
        alert(`Upload failed (Status ${response.status}): ${errText}`);
      }
    } catch (err: any) {
      alert("Upload failed. Backend offline or error: " + err.message);
      setIsUploading(false);
      return;
    }
    setIsUploading(false);
  };

  const previewHeaders = stats && stats.preview.length > 0 ? Object.keys(stats.preview[0]) : [];

  return (
    <div className="space-y-6">
      
      {/* 4 Cards at the top */}
      {stats && (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-[#1F293D] flex items-center gap-4">
          <div className="p-3 bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-lg text-[#22c55e]">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#9CA3AF]">Total Rows</span>
            <h4 className="text-xl font-bold text-white mt-0.5">{stats.total_records.toLocaleString()}</h4>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-[#1F293D] flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#9CA3AF]">Total Columns</span>
            <h4 className="text-xl font-bold text-white mt-0.5">{stats.total_columns}</h4>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-[#1F293D] flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#9CA3AF]">Memory Footprint</span>
            <h4 className="text-xl font-bold text-white mt-0.5">{stats.memory_usage_mb.toFixed(2)} MB</h4>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-[#1F293D] flex items-center gap-4">
          <div className={`p-3 rounded-lg text-xs ${stats.duplicate_rows > 0 ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e]'}`}>
            <FileWarning className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#9CA3AF]">Duplicate Rows</span>
            <h4 className={`text-xl font-bold mt-0.5 ${stats.duplicate_rows > 0 ? 'text-amber-400' : 'text-[#22c55e]'}`}>
              {stats.duplicate_rows.toLocaleString()}
            </h4>
          </div>
        </div>
      </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: File uploader + columns statistics */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Uploader */}
          <div className="glass-panel p-6 rounded-xl border border-[#1F293D] space-y-4">
            <h3 className="text-lg font-bold text-white">Upload GPS CSV Dataset</h3>
            
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragActive 
                  ? 'border-[#22c55e] bg-[#22c55e]/5' 
                  : 'border-[#1F293D] hover:border-[#22c55e]/25 bg-black/10'
              }`}
              onClick={() => document.getElementById('dataset-upload-input')?.click()}
            >
              <input 
                id="dataset-upload-input" 
                type="file" 
                accept=".csv" 
                className="hidden" 
                onChange={handleFileChange} 
              />
              
              {isUploading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-t-2 border-b-2 border-[#22c55e] rounded-full animate-spin" />
                  <span className="text-xs font-semibold text-[#9CA3AF]">Analyzing CSV structures...</span>
                </div>
              ) : uploadSuccess ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-[#22c55e]/15 border border-[#22c55e]/30 text-[#22c55e] rounded-full">
                    <Check className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-white">Processed Successfully</span>
                  <span className="text-[10px] text-[#9CA3AF] block truncate max-w-[180px]">{file?.name}</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-[#1F293D] text-[#9CA3AF] rounded-full inline-block">
                    <Upload className="w-6 h-6 text-[#22c55e]" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Drag & drop GPS CSV</span>
                    <span className="text-[10px] text-[#9CA3AF]">Supports files up to ~600,000 records</span>
                  </div>
                </div>
              )}
            </div>

            {stats && stats.filename && (
              <div className="p-3 bg-black/20 border border-[#1F293D] rounded-lg">
                <span className="text-[10px] uppercase font-bold text-[#9CA3AF] block">Active File Name</span>
                <span className="text-xs text-[#22c55e] font-semibold break-all">{stats.filename}</span>
              </div>
            )}
          </div>

          {/* Column metadata types & missing value percentage */}
          {stats && (
          <div className="glass-panel p-6 rounded-xl border border-[#1F293D] space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Table className="w-4 h-4 text-[#22c55e]" /> Column Structures & Types
            </h3>

            <div className="border border-[#1F293D] rounded-xl overflow-hidden bg-black/10 max-h-[350px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead className="bg-[#161D30]/80 border-b border-[#1F293D] sticky top-0">
                  <tr>
                    <th className="p-2.5 font-bold text-[#9CA3AF] uppercase">Field</th>
                    <th className="p-2.5 font-bold text-[#9CA3AF] uppercase">Type</th>
                    <th className="p-2.5 font-bold text-[#9CA3AF] uppercase text-right">Missing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F293D]">
                  {Object.entries(stats.column_types).map(([colName, colType]) => {
                    const missingCount = stats.missing_values_by_column[colName] || 0;
                    const missingPct = stats.total_records > 0 ? (missingCount / stats.total_records) * 100 : 0;
                    return (
                      <tr key={colName} className="hover:bg-white/5 transition-colors">
                        <td className="p-2.5 text-white font-semibold">{colName}</td>
                        <td className="p-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            colType.includes('float') || colType.includes('int')
                              ? 'bg-[#22c55e]/10 border border-[#22c55e]/25 text-[#22c55e]'
                              : 'bg-purple-500/10 border border-purple-500/25 text-purple-400'
                          }`}>
                            {colType}
                          </span>
                        </td>
                        <td className="p-2.5 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className={missingCount > 0 ? 'text-amber-400 font-bold' : 'text-[#9CA3AF]'}>
                              {missingCount.toLocaleString()}
                            </span>
                            {missingCount > 0 && (
                              <div className="w-12 bg-[#1F293D] h-1 rounded-full overflow-hidden">
                                <div className="bg-amber-400 h-full" style={{ width: `${Math.max(10, missingPct)}%` }} />
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )}

        </div>

        {/* Right Column: Numeric summary stats + Dynamic preview */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Numeric column summary stats */}
          {stats ? (
            <>
          <div className="glass-panel p-6 rounded-xl border border-[#1F293D] space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#22c55e]" /> Summary Statistics (Numeric Variables)
            </h3>

            <div className="border border-[#1F293D] rounded-xl overflow-hidden bg-black/10 overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead className="bg-[#161D30]/80 border-b border-[#1F293D]">
                  <tr>
                    <th className="p-2.5 font-bold text-[#9CA3AF] uppercase">Variable</th>
                    <th className="p-2.5 font-bold text-[#9CA3AF] uppercase text-right">Mean</th>
                    <th className="p-2.5 font-bold text-[#9CA3AF] uppercase text-right">Std Dev</th>
                    <th className="p-2.5 font-bold text-[#9CA3AF] uppercase text-right">Min</th>
                    <th className="p-2.5 font-bold text-[#9CA3AF] uppercase text-right">Max</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F293D]">
                  {Object.entries(stats.summary_stats).map(([colName, metrics]) => (
                    <tr key={colName} className="hover:bg-white/5 transition-colors">
                      <td className="p-2.5 text-white font-bold">{colName}</td>
                      <td className="p-2.5 text-right text-gray-300 font-mono">{metrics.mean.toFixed(4)}</td>
                      <td className="p-2.5 text-right text-gray-300 font-mono">{metrics.std.toFixed(4)}</td>
                      <td className="p-2.5 text-right text-green-400 font-mono">{metrics.min.toFixed(2)}</td>
                      <td className="p-2.5 text-right text-rose-400 font-mono">{metrics.max.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dynamic Grid preview */}
          <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col h-[400px]">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-white">GPS Coordinate Records Preview</h3>
              <p className="text-[10px] text-[#9CA3AF]">Displaying first 100 rows loaded in workspace</p>
            </div>

            <div className="flex-1 overflow-auto border border-[#1F293D] rounded-xl bg-black/10 scrollbar-custom">
              {stats.preview.length > 0 ? (
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead className="bg-[#161D30]/80 sticky top-0 border-b border-[#1F293D] z-10">
                    <tr>
                      <th className="p-2.5 font-bold text-[#9CA3AF] uppercase text-center">Row</th>
                      {previewHeaders.map(header => (
                        <th key={header} className="p-2.5 font-bold text-[#9CA3AF] uppercase truncate max-w-[120px]">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F293D]">
                    {stats.preview.map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition-colors">
                        <td className="p-2.5 text-[#9CA3AF] font-mono text-center font-bold bg-[#161D30]/30 sticky left-0 z-0">{idx + 1}</td>
                        {previewHeaders.map(header => {
                          const val = row[header];
                          return (
                            <td key={header} className="p-2.5 font-mono text-white truncate max-w-[120px]" title={val !== null ? String(val) : 'null'}>
                              {val !== null ? (typeof val === 'number' ? val.toLocaleString() : String(val)) : <span className="text-amber-500 font-bold">NaN</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-[#9CA3AF]">
                  No preview records available. Please upload a CSV dataset.
                </div>
              )}
            </div>
          </div>
          </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-[#1F293D] rounded-xl bg-black/10 text-[#9CA3AF] p-12">
              <Database className="w-12 h-12 mb-4 text-[#1F293D]" />
              <h3 className="text-lg font-bold text-white mb-2">No Dataset Loaded</h3>
              <p className="text-sm text-center max-w-sm">Upload a CSV file containing latitude and longitude columns using the uploader on the left to begin exploring your data.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
