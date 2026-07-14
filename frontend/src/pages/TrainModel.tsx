import { useState, useEffect, useRef } from 'react';
import { Sliders, Play, Terminal, CheckCircle2, Loader2, AlertCircle, Clock } from 'lucide-react';

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
              { id: 'learning_rate', label: 'Learning Rate (eta)', min: 0.01, max: 0.3, step: 0.01, val: config.learning_rate },
              { id: 'max_depth', label: 'Max Depth', min: 3, max: 12, step: 1, val: config.max_depth },
              { id: 'n_estimators', label: 'Estimators Count (Trees)', min: 50, max: 1000, step: 10, val: config.n_estimators },
              { id: 'subsample', label: 'Subsample Ratio', min: 0.1, max: 1.0, step: 0.1, val: config.subsample },
              { id: 'colsample_bytree', label: 'Colsample By Tree', min: 0.1, max: 1.0, step: 0.1, val: config.colsample_bytree },
              { id: 'gamma', label: 'Gamma', min: 0, max: 5, step: 0.1, val: config.gamma },
              { id: 'min_child_weight', label: 'Min Child Weight', min: 1, max: 10, step: 1, val: config.min_child_weight },
            ].map(p => (
              <div key={p.id} className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-[#9CA3AF]">{p.label}</span>
                  <span className="text-[#22c55e]">{p.val}</span>
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
