import { useState, useEffect, useRef } from 'react';
import { Sliders, Play, Terminal, CheckCircle2, Loader2, AlertCircle, Clock, Info } from 'lucide-react';

export default function TrainModel() {
  const [config, setConfig] = useState({
    learning_rate: 0.1,
    max_depth: 6,
    n_estimators: 100,
    subsample: 1.0,
    colsample_bytree: 1.0,
    gamma: 0.0,
    min_child_weight: 1.0
  });

  const [training, setTraining] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, training, completed, error
  const [progress, setProgress] = useState(0);
  const [metrics, setMetrics] = useState({ elapsed_time: 0, eta: 0, train_rmse: 0, val_rmse: 0 });
  const [logs, setLogs] = useState<string[]>([]);
  
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Polling loop
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    const checkProgress = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'}/model/progress`);
        if (res.ok) {
          const data = await res.json();
          
          if (data.status === 'training') {
            const pct = data.total_epochs > 0 ? (data.current_epoch / data.total_epochs) * 100 : 0;
            setProgress(pct);
            setMetrics({
              elapsed_time: data.elapsed_time,
              eta: data.eta,
              train_rmse: data.train_rmse,
              val_rmse: data.val_rmse
            });
            
            if (data.current_epoch % 10 === 0 && data.current_epoch > 0) {
              setLogs(prev => {
                const msg = `[Epoch ${data.current_epoch}/${data.total_epochs}] Train RMSE: ${data.train_rmse.toFixed(4)} | Val RMSE: ${data.val_rmse.toFixed(4)}`;
                if (prev[prev.length -1] !== msg) return [...prev, msg];
                return prev;
              });
            }
          }
          
          if (data.status === 'completed' && training) {
            setProgress(100);
            setStatus('completed');
            setTraining(false);
            setMetrics({
              elapsed_time: data.elapsed_time,
              eta: 0,
              train_rmse: data.train_rmse,
              val_rmse: data.val_rmse
            });
            setLogs(prev => [
              ...prev,
              "Model training complete!",
              `Final Validation RMSE: ${data.val_rmse}`,
              "XGBoost regressor successfully saved to 'data/model.joblib'."
            ]);
            clearInterval(interval);
          }
          
          if (data.status === 'error' && training) {
            setStatus('error');
            setTraining(false);
            setLogs(prev => [...prev, "Training failed due to a server error."]);
            clearInterval(interval);
          }
        }
      } catch (e) {
        console.error(e);
      }
    };

    if (training) {
      interval = setInterval(checkProgress, 250);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [training]);

  const startTraining = async () => {
    setTraining(true);
    setStatus('training');
    setProgress(0);
    setMetrics({ elapsed_time: 0, eta: 0, train_rmse: 0, val_rmse: 0 });
    setLogs([
      "Initializing XGBoost Training Environment (CPU)...",
      `Hyperparameters:`,
      `  - max_depth = ${config.max_depth}`,
      `  - learning_rate = ${config.learning_rate}`,
      `  - n_estimators = ${config.n_estimators}`,
      `  - subsample = ${config.subsample}`,
      `  - colsample_bytree = ${config.colsample_bytree}`,
      `  - gamma = ${config.gamma}`,
      `  - min_child_weight = ${config.min_child_weight}`,
      "Triggering backend BackgroundTask..."
    ]);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'}/model/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        const err = await response.json();
        setLogs(prev => [...prev, `Error: ${err.detail || "Server error"}`]);
        setTraining(false);
        setStatus('error');
      } else {
        setLogs(prev => [...prev, "Training engine started. Polling for progress..."]);
      }
    } catch (err) {
      setLogs(prev => [...prev, "Training failed: Backend offline."]);
      setTraining(false);
      setStatus('error');
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  };

  const getDynamicDesc = (id: string, val: number) => {
    switch (id) {
      case 'learning_rate':
        if (val > 0.15) return `At ${val}, the AI is moving very FAST. It risks overshooting the perfect answer!`;
        if (val < 0.05) return `At ${val}, the AI is moving very SLOW and carefully. It is accurate, but requires many trees to finish.`;
        return `At ${val}, the AI has a balanced speed, taking careful mathematical steps toward the perfect answer.`;
      case 'max_depth':
        if (val >= 9) return `At depth ${val}, the tree is HUGE! The AI is learning highly complex shapes, but risks memorizing random noise (Overfitting).`;
        if (val <= 4) return `At depth ${val}, the tree is SHALLOW. The AI is learning very basic, broad terrain rules.`;
        return `At depth ${val}, the tree is balanced. It can learn mountain curves without memorizing noise.`;
      case 'n_estimators':
        if (val >= 500) return `${val} trees! A massive forest of brains working together. Very smart, but takes longer to train.`;
        if (val <= 100) return `Only ${val} trees. Very fast to train, but might not be enough brains to understand complex mountains.`;
        return `${val} trees form a solid, balanced forest working together to map the terrain.`;
      case 'subsample':
        if (val === 1.0) return `Every single tree is looking at the entire 100% of the map.`;
        return `Every tree is only allowed to look at a random ${Math.round(val * 100)}% of the map, preventing them from just copying each other.`;
      case 'colsample_bytree':
        if (val === 1.0) return `No columns are hidden. The AI uses all data (Lat, Lon, Speed, etc.) for every tree.`;
        return `Trees are forced to completely ignore ${Math.round((1 - val) * 100)}% of the data columns! This forces the AI to find creative new patterns.`;
      case 'gamma':
        if (val > 2) return `Gamma ${val} is a HUGE penalty! The tree will absolutely refuse to grow unless it finds a massive accuracy improvement.`;
        if (val === 0) return `Gamma 0. No penalty! The trees are allowed to grow freely based on the Max Depth.`;
        return `Gamma ${val} applies a moderate penalty, stopping trees from growing useless, tiny branches.`;
      case 'min_child_weight':
        if (val >= 5) return `Strict! The AI will ignore any geographic pattern that has less than ${val} GPS points in it. Goodbye glitchy outliers!`;
        return `Lenient. The AI will create rules even if only ${val} GPS point falls into that category.`;
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Parameters sliders */}
        <div className="lg:col-span-4 glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col gap-6 h-[720px] overflow-y-auto">
          <div className="flex items-center gap-3">
            <Sliders className="w-5 h-5 text-[#22c55e]" />
            <h3 className="text-lg font-bold text-white">XGBoost Parameters</h3>
          </div>

          <div className="space-y-5 flex-1">
            {[
              { 
                id: 'learning_rate', label: 'Learning Rate (eta)', min: 0.01, max: 0.3, step: 0.01, val: config.learning_rate,
                svg: <svg viewBox="0 0 100 40" className="w-full h-16 mt-2 mb-3"><path d="M 10 20 Q 30 5 50 20 T 90 20" fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" /><path d="M 10 35 Q 30 35 50 35 T 90 35" fill="none" stroke="#22c55e" strokeWidth="3" /><text x="50" y="10" fill="#9CA3AF" fontSize="6" textAnchor="middle">Fast (Rushed)</text><text x="50" y="28" fill="#9CA3AF" fontSize="6" textAnchor="middle">Slow (Careful Steps)</text></svg>
              },
              {
                id: 'max_depth', label: 'Max Depth', min: 3, max: 12, step: 1, val: config.max_depth,
                svg: <svg viewBox="0 0 100 40" className="w-full h-16 mt-2 mb-3"><line x1="50" y1="5" x2="30" y2="15" stroke="#4B5563" strokeWidth="2"/><line x1="50" y1="5" x2="70" y2="15" stroke="#4B5563" strokeWidth="2"/><line x1="30" y1="15" x2="20" y2="25" stroke="#22c55e" strokeWidth="2"/><line x1="30" y1="15" x2="40" y2="25" stroke="#22c55e" strokeWidth="2"/><line x1="70" y1="15" x2="60" y2="25" stroke="#22c55e" strokeWidth="2"/><line x1="70" y1="15" x2="80" y2="25" stroke="#22c55e" strokeWidth="2"/><circle cx="50" cy="5" r="3" fill="#3b82f6"/><circle cx="30" cy="15" r="3" fill="#3b82f6"/><circle cx="70" cy="15" r="3" fill="#3b82f6"/><text x="50" y="38" fill="#9CA3AF" fontSize="6" textAnchor="middle">Limits Tree Branches</text></svg>
              },
              {
                id: 'n_estimators', label: 'Estimators Count (Trees)', min: 50, max: 1000, step: 10, val: config.n_estimators,
                svg: <svg viewBox="0 0 100 40" className="w-full h-16 mt-2 mb-3"><polygon points="20,25 25,10 30,25" fill="#22c55e"/><polygon points="45,25 50,10 55,25" fill="#22c55e"/><polygon points="70,25 75,10 80,25" fill="#22c55e"/><text x="50" y="38" fill="#9CA3AF" fontSize="6" textAnchor="middle">Forest of Trees</text></svg>
              },
              {
                id: 'subsample', label: 'Subsample Ratio', min: 0.1, max: 1.0, step: 0.1, val: config.subsample,
                svg: <svg viewBox="0 0 100 40" className="w-full h-16 mt-2 mb-3"><rect x="10" y="5" width="35" height="25" fill="none" stroke="#4B5563" strokeWidth="1"/><rect x="15" y="10" width="15" height="15" fill="#3b82f6" opacity="0.5"/><rect x="55" y="5" width="35" height="25" fill="none" stroke="#4B5563" strokeWidth="1"/><rect x="70" y="10" width="15" height="15" fill="#22c55e" opacity="0.5"/><text x="50" y="38" fill="#9CA3AF" fontSize="6" textAnchor="middle">Tree 1 View vs Tree 2 View</text></svg>
              },
              {
                id: 'colsample_bytree', label: 'Colsample By Tree', min: 0.1, max: 1.0, step: 0.1, val: config.colsample_bytree,
                svg: <svg viewBox="0 0 100 40" className="w-full h-16 mt-2 mb-3"><rect x="20" y="10" width="10" height="20" fill="#3b82f6"/><rect x="35" y="10" width="10" height="20" fill="#4B5563"/><rect x="50" y="10" width="10" height="20" fill="#4B5563"/><rect x="65" y="10" width="10" height="20" fill="#22c55e"/><text x="50" y="38" fill="#9CA3AF" fontSize="6" textAnchor="middle">Hiding Columns</text></svg>
              },
              {
                id: 'gamma', label: 'Gamma', min: 0, max: 5, step: 0.1, val: config.gamma,
                svg: <svg viewBox="0 0 100 40" className="w-full h-16 mt-2 mb-3"><line x1="20" y1="20" x2="40" y2="20" stroke="#ef4444" strokeWidth="2"/><line x1="30" y1="10" x2="30" y2="30" stroke="#ef4444" strokeWidth="2"/><circle cx="70" cy="20" r="10" fill="none" stroke="#22c55e" strokeWidth="2"/><path d="M 65 20 L 70 25 L 78 15" fill="none" stroke="#22c55e" strokeWidth="2"/><text x="50" y="38" fill="#9CA3AF" fontSize="6" textAnchor="middle">Blocked vs Approved Split</text></svg>
              },
              {
                id: 'min_child_weight', label: 'Min Child Weight', min: 1, max: 10, step: 1, val: config.min_child_weight,
                svg: <svg viewBox="0 0 100 40" className="w-full h-16 mt-2 mb-3"><circle cx="20" cy="20" r="2" fill="#ef4444"/><circle cx="25" cy="18" r="2" fill="#ef4444"/><circle cx="30" cy="22" r="2" fill="#ef4444"/><text x="25" y="35" fill="#ef4444" fontSize="6" textAnchor="middle">Rejected (Too Few)</text><circle cx="65" cy="15" r="2" fill="#22c55e"/><circle cx="70" cy="12" r="2" fill="#22c55e"/><circle cx="75" cy="18" r="2" fill="#22c55e"/><circle cx="60" cy="22" r="2" fill="#22c55e"/><circle cx="80" cy="20" r="2" fill="#22c55e"/><circle cx="68" cy="25" r="2" fill="#22c55e"/><text x="70" y="35" fill="#22c55e" fontSize="6" textAnchor="middle">Accepted Rule</text></svg>
              },
            ].map(p => (
              <div key={p.id} className="space-y-2 relative group hover:z-50">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#9CA3AF]">{p.label}</span>
                    <Info className="w-3.5 h-3.5 text-[#4B5563] cursor-help hover:text-white transition-colors" />
                  </div>
                  <span className="text-[#22c55e]">{p.val}</span>
                </div>
                
                <div className="absolute top-6 left-0 w-72 p-3 bg-[#111827] border border-[#1F293D] rounded-lg shadow-2xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 translate-y-2 group-hover:translate-y-0">
                  <strong className="text-white block mb-1">Pictorial Representation:</strong>
                  {p.svg}
                  <strong className="text-white block mb-1">Dynamic Meaning:</strong>
                  <span className="text-[#3b82f6] font-semibold">{getDynamicDesc(p.id, p.val)}</span>
                </div>

                <input 
                  type="range" min={p.min} max={p.max} step={p.step} 
                  value={p.val} 
                  onChange={(e) => setConfig({...config, [p.id]: parseFloat(e.target.value)})}
                  className="w-full accent-[#22c55e] h-1 bg-[#1F293D] rounded-lg cursor-pointer"
                  disabled={training}
                />
              </div>
            ))}
          </div>

          <button
            onClick={startTraining}
            disabled={training}
            className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shrink-0 ${
              training 
                ? 'bg-[#1F293D] text-[#9CA3AF] cursor-not-allowed' 
                : 'bg-[#22c55e] hover:bg-[#16a34a] text-black shadow-[0_0_15px_rgba(34,197,94,0.3)]'
            }`}
          >
            {training ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
            {training ? 'Training Model...' : 'Start Training'}
          </button>
        </div>

        {/* Right Side: Training Log & Progress */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Progress Dashboard */}
          <div className="glass-panel p-6 rounded-xl border border-[#1F293D]">
             <div className="flex items-center justify-between mb-6">
               <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Model Training Status 
                    {status === 'completed' && <CheckCircle2 className="w-5 h-5 text-[#22c55e]" />}
                    {status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                  </h3>
                  <p className="text-xs text-[#9CA3AF] mt-1">Live tracking of XGBoost CPU compilation</p>
               </div>
               
               {/* Metrics badging */}
               <div className="flex gap-4">
                  <div className="bg-[#161D30] border border-[#1F293D] px-4 py-2 rounded-lg flex flex-col items-center justify-center min-w-[100px]">
                    <span className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider">Elapsed Time</span>
                    <span className="text-lg font-mono font-bold text-white flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#3b82f6]" /> {formatTime(metrics.elapsed_time)}
                    </span>
                  </div>
                  <div className="bg-[#161D30] border border-[#1F293D] px-4 py-2 rounded-lg flex flex-col items-center justify-center min-w-[100px]">
                    <span className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider">Remaining (ETA)</span>
                    <span className="text-lg font-mono font-bold text-white flex items-center gap-1">
                       <Clock className="w-3 h-3 text-[#f59e0b]" /> {status === 'training' ? formatTime(metrics.eta) : '0s'}
                    </span>
                  </div>
               </div>
             </div>

             {/* Progress Bar */}
             <div className="space-y-2 mb-6">
                <div className="flex justify-between text-xs font-bold">
                  <span className={status === 'training' ? 'text-[#3b82f6]' : 'text-[#22c55e]'}>
                    {status === 'idle' ? 'Ready' : status === 'training' ? 'Building Trees...' : status === 'completed' ? 'Completed' : 'Error'}
                  </span>
                  <span className="text-white">{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-[#161D30] rounded-full h-3 overflow-hidden border border-[#1F293D]">
                  <div 
                    className={`h-full transition-all duration-1000 ease-linear ${status === 'error' ? 'bg-red-500' : 'bg-gradient-to-r from-[#3b82f6] to-[#22c55e]'}`}
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
             </div>

             {/* RMSE Trackers */}
             <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/20 rounded-lg p-3 border border-[#1F293D] flex justify-between items-center">
                  <span className="text-xs text-[#9CA3AF] font-bold">Training Loss (RMSE)</span>
                  <span className="text-sm font-mono font-bold text-[#3b82f6]">{metrics.train_rmse.toFixed(4)}</span>
                </div>
                <div className="bg-black/20 rounded-lg p-3 border border-[#1F293D] flex justify-between items-center">
                  <span className="text-xs text-[#9CA3AF] font-bold">Validation Loss (RMSE)</span>
                  <span className="text-sm font-mono font-bold text-[#f59e0b]">{metrics.val_rmse.toFixed(4)}</span>
                </div>
             </div>
          </div>

          <div className="glass-panel p-0 rounded-xl border border-[#1F293D] flex flex-col flex-1 h-[320px] overflow-hidden bg-[#0A0D14]">
            <div className="px-4 py-3 border-b border-[#1F293D] flex items-center gap-2 bg-[#161D30]">
              <Terminal className="w-4 h-4 text-[#9CA3AF]" />
              <span className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider">Training Console</span>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-2">
              {logs.map((log, index) => (
                <div key={index} className="flex gap-3">
                  <span className="text-[#3b82f6] opacity-50 shrink-0">[{new Date().toISOString().split('T')[1].split('.')[0]}]</span>
                  <span className={`${
                    log.includes('complete') ? 'text-[#22c55e] font-bold' : 
                    log.includes('failed') || log.includes('Error') ? 'text-red-400' : 
                    'text-[#9CA3AF]'
                  }`}>
                    {log}
                  </span>
                </div>
              ))}
              {status === 'training' && (
                <div className="flex gap-3 animate-pulse">
                  <span className="text-[#3b82f6] opacity-50 shrink-0">[{new Date().toISOString().split('T')[1].split('.')[0]}]</span>
                  <span className="text-[#f59e0b]">Building tree estimators...</span>
                </div>
              )}
              <div ref={consoleEndRef} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
