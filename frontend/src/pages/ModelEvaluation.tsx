import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ReferenceLine } from 'recharts';
import { ShieldCheck, Award, AlertCircle, BarChart2, Download } from 'lucide-react';

interface EvaluationData {
  metrics: { r2: number; rmse: number; mae: number; mape: number };
  feature_importance: { feature: string; importance: number }[];
  actual_vs_predicted: { actual: number; predicted: number }[];
  residuals: { predicted: number; residual: number }[];
}

export default function ModelEvaluation() {
  const [data, setData] = useState<EvaluationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvaluation = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'}/model/evaluation`);
        if (response.ok) {
          const res = await response.json();
          setData(res);
        } else {
          const res = await response.json();
          setError(res.detail || "Failed to fetch evaluation metrics.");
        }
      } catch (err) {
        setError("FastAPI backend offline.");
      } finally {
        setLoading(false);
      }
    };
    fetchEvaluation();
  }, []);

  const downloadReport = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `model_evaluation_report_${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="text-white text-center py-20 animate-pulse font-bold">Running inferences on test dataset...</div>;
  }

  if (error || !data) {
    return (
      <div className="glass-panel p-10 rounded-xl border border-red-500/30 flex flex-col items-center justify-center text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">Model Evaluation Failed</h3>
        <p className="text-[#9CA3AF] max-w-md">{error || "No model found. Please run the training pipeline first."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header & Export */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white">XGBoost Evaluation Metrics</h2>
          <p className="text-sm text-[#9CA3AF] mt-1">Calculated using unseen testing arrays</p>
        </div>
        <button 
          onClick={downloadReport}
          className="flex items-center gap-2 px-4 py-2 bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" /> Download Report
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'R² Coefficient', value: data.metrics.r2.toFixed(4), desc: 'Proportion of variance explained', icon: Award, color: 'text-green-400' },
          { label: 'RMSE', value: `${data.metrics.rmse.toFixed(3)}m`, desc: 'Root Mean Squared Error', icon: AlertCircle, color: 'text-blue-400' },
          { label: 'MAE', value: `${data.metrics.mae.toFixed(3)}m`, desc: 'Mean Absolute Error', icon: ShieldCheck, color: 'text-purple-400' },
          { label: 'MAPE', value: `${data.metrics.mape.toFixed(2)}%`, desc: 'Mean Absolute Pct Error', icon: BarChart2, color: 'text-amber-400' },
        ].map((met, idx) => (
          <div key={idx} className="glass-panel p-5 rounded-xl border border-[#1F293D] flex items-center gap-4">
            <div className={`p-3 bg-[#161D30] border border-[#1F293D] rounded-lg ${met.color}`}>
              <met.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-[#9CA3AF] uppercase font-bold tracking-wider">{met.label}</p>
              <h3 className="text-xl font-black text-white mt-1">{met.value}</h3>
              <span className="text-[10px] text-[#9CA3AF]">{met.desc}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Actual vs Predicted Plot */}
        <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col h-[400px]">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-white">Actual vs Predicted</h3>
            <p className="text-xs text-[#9CA3AF]">Model accuracy plot (downsampled to 2,000 points)</p>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" />
                <XAxis type="number" dataKey="actual" name="Actual Elevation" unit="m" stroke="#9CA3AF" fontSize={11} domain={['auto', 'auto']} />
                <YAxis type="number" dataKey="predicted" name="Predicted" unit="m" stroke="#9CA3AF" fontSize={11} domain={['auto', 'auto']} />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ backgroundColor: '#161D30', borderColor: '#1F293D', borderRadius: '8px' }}
                />
                <Scatter name="Predictions" data={data.actual_vs_predicted} fill="#3b82f6" opacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Residual Plot */}
        <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col h-[400px]">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-white">Residual Plot</h3>
            <p className="text-xs text-[#9CA3AF]">Prediction errors across altitude range (Homoscedasticity check)</p>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" />
                <XAxis type="number" dataKey="predicted" name="Predicted Elevation" unit="m" stroke="#9CA3AF" fontSize={11} domain={['auto', 'auto']} />
                <YAxis type="number" dataKey="residual" name="Residual Error" unit="m" stroke="#9CA3AF" fontSize={11} domain={['auto', 'auto']} />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ backgroundColor: '#161D30', borderColor: '#1F293D', borderRadius: '8px' }}
                />
                <Scatter name="Residuals" data={data.residuals} fill="#f59e0b" opacity={0.6} />
                <ReferenceLine y={0} stroke="#22c55e" strokeWidth={2} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Feature Importance Bar Chart */}
        <div className="glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col h-[400px] lg:col-span-2">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-white">XGBoost Feature Importance</h3>
            <p className="text-xs text-[#9CA3AF]">Relative influence of each feature on model predictions (F-score/Gain)</p>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.feature_importance} layout="vertical" margin={{ top: 0, right: 60, left: 30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" horizontal={false} />
                <XAxis type="number" stroke="#9CA3AF" fontSize={11} />
                <YAxis type="category" dataKey="feature" stroke="#fff" fontSize={12} fontWeight="bold" width={120} />
                <Tooltip 
                  cursor={{fill: '#1F293D', opacity: 0.4}}
                  contentStyle={{ backgroundColor: '#161D30', borderColor: '#1F293D', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="importance" fill="#a855f7" radius={[0, 4, 4, 0]} barSize={30} label={{ position: 'right', fill: '#fff', fontSize: 11, formatter: (val: any) => Number(val).toFixed(4) }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
