import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, RefreshCw, Cpu, Database, HardDrive } from 'lucide-react';

export default function Settings() {
  const [apiUrl, setApiUrl] = useState((import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'));
  const [activeModel, setActiveModel] = useState('-');
  const [cachePredictions, setCachePredictions] = useState(true);
  const [hardwareAcc, setHardwareAcc] = useState('cpu');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'}/settings`);
        if (response.ok) {
          const data = await response.json();
          setApiUrl(data.api_url);
          setActiveModel(data.active_model);
          setCachePredictions(data.cache_predictions);
          // Map backend accelerators to our values
          setHardwareAcc(data.hardware_accelerator.includes('CPU') ? 'cpu' : 'gpu');
        }
      } catch (err) {
        console.warn("FastAPI backend offline, running with default settings values.");
      }
    };
    fetchSettings();
  }, []);

  const saveSettings = () => {
    setSaving(true);
    setSuccess(false);
    
    // Simulate API settings save
    setTimeout(() => {
      setSaving(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }, 1200);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="glass-panel p-6 rounded-xl border border-[#1F293D] space-y-6">
        
        <div className="flex items-center gap-3 pb-4 border-b border-[#1F293D]">
          <SettingsIcon className="w-5 h-5 text-[#22c55e]" />
          <div>
            <h3 className="text-lg font-bold text-white">System Settings</h3>
            <p className="text-xs text-[#9CA3AF]">Manage API connections, execution parameters, and model deployments</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Left Column: API and Models */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-[#22c55e]" /> API & Database Configs
            </h4>
            
            <div className="space-y-1">
              <label className="text-xs text-[#9CA3AF] font-bold uppercase">FastAPI Endpoint Address</label>
              <input 
                type="text" 
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="w-full p-2.5 glass-input text-xs font-mono"
              />
              <span className="text-[10px] text-[#9CA3AF]/60 mt-0.5 block">Endpoint of the Python XGBoost microservice</span>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#9CA3AF] font-bold uppercase">Active Estimator Weights File</label>
              <select 
                value={activeModel}
                onChange={(e) => setActiveModel(e.target.value)}
                className="w-full p-2.5 glass-input text-xs"
              >
                <option value="-">- (No Active Booster)</option>
                <option value="xgb_v2.0.0_beta">xgb_v2.0.0_beta (Experimental)</option>
                <option value="baseline_mean_regressor">baseline_mean_regressor (Fallback)</option>
              </select>
              <span className="text-[10px] text-[#9CA3AF]/60 mt-0.5 block">Select the weights configuration folder loaded in FastAPI models directory</span>
            </div>
          </div>

          {/* Right Column: Execution Preferences */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#22c55e]" /> Hardware & Cache Settings
            </h4>

            <div className="space-y-3">
              {/* Cache toggle */}
              <label className="flex items-center justify-between p-3 bg-black/20 border border-[#1F293D] rounded-lg cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-white block">Local Prediction Caching</span>
                  <span className="text-[10px] text-[#9CA3AF]">Speeds up redundant coordinate queries</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={cachePredictions}
                  onChange={(e) => setCachePredictions(e.target.checked)}
                  className="rounded bg-[#0B0F19] border-[#1F293D] text-[#22c55e] focus:ring-0 w-4 h-4"
                />
              </label>

              {/* Hardware Acc */}
              <div className="p-3 bg-black/20 border border-[#1F293D] rounded-lg space-y-2">
                <span className="text-xs font-bold text-white block">Hardware Acceleration Booster</span>
                
                <div className="flex gap-4">
                  {[
                    { id: 'cpu', label: 'CPU (Default)', desc: 'Standard multi-threading' },
                    { id: 'gpu', label: 'GPU (CUDA)', desc: 'Accelerates training' }
                  ].map(acc => (
                    <label key={acc.id} className="flex-1 flex items-start gap-2.5 p-2 bg-black/20 border border-[#1F293D] rounded hover:border-[#22c55e]/25 cursor-pointer">
                      <input 
                        type="radio" 
                        name="hardware" 
                        value={acc.id} 
                        checked={hardwareAcc === acc.id}
                        onChange={() => setHardwareAcc(acc.id)}
                        className="mt-0.5 text-[#22c55e] focus:ring-0 bg-[#0B0F19] border-[#1F293D]"
                      />
                      <div>
                        <span className="text-xs font-bold text-white block leading-none">{acc.label}</span>
                        <span className="text-[9px] text-[#9CA3AF]">{acc.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Save Controls */}
        <div className="pt-4 border-t border-[#1F293D] flex items-center justify-end gap-3">
          {success && (
            <span className="text-xs text-green-400 font-bold animate-pulse">
              Configurations saved successfully!
            </span>
          )}
          
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-6 py-2.5 bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold rounded-xl flex items-center gap-2 hover:shadow-neon transition-all text-xs"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save System Settings
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
