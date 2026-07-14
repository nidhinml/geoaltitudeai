import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, 
  LineChart, Line, Cell, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Rectangle, Popup } from 'react-leaflet';
import { motion } from 'framer-motion';
import { 
  Activity, Brain, Network, GitCommit, 
  BarChart3, Database, AlertCircle, Clock, Search, ChevronLeft, ChevronRight, MapPin,
  Crosshair, ScatterChart as ScatterIcon, Layers
} from 'lucide-react';

const API_BASE = `${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'}/explainability`;

const GlassCard = ({ title, icon: Icon, children, className = '' }: any) => (
  <div className={`glass-panel p-6 rounded-xl border border-[#1F293D] flex flex-col ${className}`}>
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 bg-[#22c55e]/10 text-[#22c55e] rounded-lg border border-[#22c55e]/20">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-lg font-bold text-white tracking-wide">{title}</h3>
    </div>
    <div className="flex-1">{children}</div>
  </div>
);

// SVGRenderer for Tree
const TreeNode = ({ node, x, y, level, dx, onClick, activeNodes, collapsedNodes, searchQuery, onToggleCollapse }: any) => {
  if (!node) return null;
  const isLeaf = !('split' in node) && !('children' in node);
  const childDy = 80;
  
  const isActive = activeNodes && activeNodes.has(node.nodeid);
  const isCollapsed = collapsedNodes && collapsedNodes.has(node.nodeid);
  const isSearched = searchQuery && node.split && node.split.toLowerCase().includes(searchQuery.toLowerCase());
  
  const isLeftChildActive = node.children && activeNodes && activeNodes.has(node.children[0].nodeid);
  const isRightChildActive = node.children && activeNodes && activeNodes.has(node.children[1].nodeid);
  
  return (
    <g>
      {!isLeaf && node.children && !isCollapsed && (
        <>
          <motion.line x1={x} y1={y+15} x2={x-dx} y2={y+childDy-15} 
            stroke={isLeftChildActive ? "#3b82f6" : "#3b82f6"} 
            initial={{ strokeWidth: 2, opacity: 0.4 }}
            animate={{ strokeWidth: isLeftChildActive ? 4 : 2, opacity: isLeftChildActive ? 1 : 0.4 }}
            transition={{ duration: 0.3 }}
          />
          <motion.line x1={x} y1={y+15} x2={x+dx} y2={y+childDy-15} 
            stroke={isRightChildActive ? "#3b82f6" : "#ef4444"} 
            initial={{ strokeWidth: 2, opacity: 0.4 }}
            animate={{ strokeWidth: isRightChildActive ? 4 : 2, opacity: isRightChildActive ? 1 : 0.4 }}
            transition={{ duration: 0.3 }}
          />
          <TreeNode node={node.children[0]} x={x-dx} y={y+childDy} level={level+1} dx={dx/2} onClick={onClick} activeNodes={activeNodes} collapsedNodes={collapsedNodes} searchQuery={searchQuery} onToggleCollapse={onToggleCollapse} />
          <TreeNode node={node.children[1]} x={x+dx} y={y+childDy} level={level+1} dx={dx/2} onClick={onClick} activeNodes={activeNodes} collapsedNodes={collapsedNodes} searchQuery={searchQuery} onToggleCollapse={onToggleCollapse} />
        </>
      )}
      <motion.circle 
        cx={x} cy={y} r={15} 
        fill={isActive ? (isLeaf ? "#22c55e" : "#3b82f6") : "#1e293b"} 
        stroke={isSearched ? "#eab308" : (isActive ? (isLeaf ? "#22c55e" : "#60a5fa") : "#475569")} 
        initial={{ strokeWidth: 2, filter: "none" }}
        animate={{
          strokeWidth: isSearched ? 4 : (isActive ? 3 : 2),
          filter: isSearched ? "drop-shadow(0px 0px 10px rgba(234,179,8,0.8))" : (isActive ? "drop-shadow(0px 0px 8px rgba(59,130,246,0.8))" : "none")
        }}
        transition={{ duration: 0.3 }}
        onClick={() => onClick(node)}
        whileHover={{ scale: 1.2 }}
        className="cursor-pointer transition-colors duration-300"
      />
      {!isLeaf && (
        <circle 
          cx={x + 10} cy={y - 10} r={6} fill="#334155" stroke="#94a3b8" strokeWidth={1}
          className="cursor-pointer hover:fill-[#475569]"
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.nodeid); }}
        />
      )}
      {!isLeaf && (
        <text x={x + 10} y={y - 7} textAnchor="middle" fill="#ffffff" fontSize="8px" className="pointer-events-none" fontWeight="bold">
          {isCollapsed ? '+' : '-'}
        </text>
      )}
      <text x={x} y={y-20} textAnchor="middle" fill={isActive || isSearched ? "#ffffff" : "#9ca3af"} fontSize="10px" fontWeight="bold" className="pointer-events-none">
        {isLeaf ? `Leaf: ${node.leaf.toFixed(2)}` : node.split}
      </text>
    </g>
  );
};

export default function ModelExplainability() {
  const [coords] = useState({ latitude: 10.8505, longitude: 76.2711 });
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationStep, setAnimationStep] = useState(0);

  // Tree viewer interactivity state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: -400, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());
  const [selectedNode, setSelectedNode] = useState<any>(null);

  const handleWheel = (e: any) => {
    e.preventDefault();
    const scaleAdjust = e.deltaY * -0.001;
    setZoom(prev => Math.min(Math.max(0.2, prev + scaleAdjust), 3));
  };
  
  const handleMouseDown = (e: any) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  
  const handleMouseMove = (e: any) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  
  const handleMouseUp = () => setIsDragging(false);

  const toggleCollapse = (nodeid: number) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeid)) next.delete(nodeid);
      else next.add(nodeid);
      return next;
    });
  };
  
  // Queries
  const { data: overview, isLoading: overviewLoading } = useQuery({ queryKey: ['overview'], queryFn: () => fetch(`${API_BASE}/overview`).then(r => r.json()) });
  const { data: featureImp } = useQuery({ queryKey: ['featureImp'], queryFn: () => fetch(`${API_BASE}/feature_importance`).then(r => r.json()) });
  const { data: totalTreesData } = useQuery({ queryKey: ['totalTrees'], queryFn: () => fetch(`${API_BASE}/total_trees`).then(r => r.json()) });
  const { data: coverage } = useQuery({ queryKey: ['coverage'], queryFn: () => fetch(`${API_BASE}/coverage`).then(r => r.json()) });
  const { data: residuals } = useQuery({ queryKey: ['residuals'], queryFn: () => fetch(`${API_BASE}/residuals`).then(r => r.json()) });
  const { data: performance } = useQuery({ queryKey: ['performance'], queryFn: () => fetch(`${API_BASE}/performance`).then(r => r.json()) });
  
  const [treeIdx, setTreeIdx] = useState(0);
  const { data: treeData, isLoading: treeLoading } = useQuery({ 
    queryKey: ['tree', treeIdx], 
    queryFn: () => fetch(`${API_BASE}/tree_explorer/${treeIdx}`).then(r => r.json()),
    enabled: totalTreesData?.total_trees > 0
  });

  const { data: contributions } = useQuery({ 
    queryKey: ['contribs', coords], 
    queryFn: () => fetch(`${API_BASE}/contributions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(coords)
    }).then(r => r.json())
  });

  const { data: pathData, isFetching: pathLoading } = useQuery({
    queryKey: ['predictionPath', treeIdx, coords],
    queryFn: () => fetch(`${API_BASE}/prediction_path`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...coords, tree_idx: treeIdx })
    }).then(r => r.json()),
    enabled: totalTreesData?.total_trees > 0
  });

  const { data: actualVsPredicted } = useQuery({ queryKey: ['actualVsPredicted'], queryFn: () => fetch(`${API_BASE}/actual_vs_predicted`).then(r => r.json()) });

  const { data: nearestSamples } = useQuery({ 
    queryKey: ['nearestSamples', coords], 
    queryFn: () => fetch(`${API_BASE}/nearest_samples`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(coords)
    }).then(r => r.json())
  });

  const { data: treePredictions } = useQuery({ 
    queryKey: ['treePredictions', coords], 
    queryFn: () => fetch(`${API_BASE}/tree_predictions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(coords)
    }).then(r => r.json())
  });

  useEffect(() => {
    setAnimationStep(0);
    setIsAnimating(false);
  }, [treeIdx]);

  useEffect(() => {
    let interval: any;
    if (isAnimating && pathData?.path) {
      interval = setInterval(() => {
        setAnimationStep(prev => {
          if (prev >= pathData.path.length - 1) {
            setIsAnimating(false);
            clearInterval(interval);
            return prev;
          }
          return prev + 1;
        });
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isAnimating, pathData]);

  const activeNodes = new Set(
    (isAnimating || animationStep > 0) && pathData?.path
      ? pathData.path.slice(0, animationStep + 1).map((p: any) => p.nodeid)
      : []
  );

  // Removed old hoveredNode state
  
  if (overviewLoading) return <div className="p-10 flex justify-center"><Activity className="w-10 h-10 text-[#22c55e] animate-spin" /></div>;
  if (!overview) return <div className="p-10 text-red-400">Error: Could not load explainability data. Please check if the backend is running and a model is trained.</div>;
  if (overview?.detail) return <div className="p-10 text-red-400">Error: {overview.detail}</div>;

  // Render Waterfall Chart data
  const waterfallData = contributions ? [
    { name: "Base Value", value: contributions.bias, start: 0, end: contributions.bias, color: "#94a3b8" },
    ...Object.entries(contributions.feature_contributions || {}).map(([key, val]: any, i, arr) => {
      const prevEnd = i === 0 ? contributions.bias : arr.slice(0, i).reduce((acc: number, [_, v]: any) => acc + v, contributions.bias);
      return {
        name: key,
        value: val,
        start: prevEnd,
        end: prevEnd + val,
        color: val >= 0 ? "#22c55e" : "#ef4444"
      };
    }),
    { name: "Final Prediction", value: contributions.final_prediction, start: 0, end: contributions.final_prediction, color: "#3b82f6" }
  ] : [];

  return (
    <div className="space-y-8 pb-10">
      
      {/* SECTION 1: Model Overview */}
      <GlassCard title="Section 1: Model Overview" icon={Brain}>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { label: "Model Name", value: overview.model_name },
            { label: "Algorithm", value: overview.algorithm },
            { label: "Training Samples", value: overview.training_samples.toLocaleString() },
            { label: "Features Count", value: overview.number_of_features },
            { label: "Total Trees", value: overview.number_of_trees },
            { label: "Training Time", value: `${overview.training_time}s` }
          ].map(stat => (
            <div key={stat.label} className="bg-black/20 border border-[#1F293D] p-4 rounded-lg flex flex-col justify-center text-center">
              <span className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider mb-1">{stat.label}</span>
              <span className="text-lg font-bold text-white text-wrap leading-tight">{stat.value}</span>
            </div>
          ))}
        </div>

        {treePredictions && (
          <div className="mt-4 bg-gradient-to-r from-[#161D30] to-[#0B0F19] border border-[#1F293D] p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider mb-1">Prediction Confidence Interval (Tree Variance)</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">{treePredictions.final_prediction.toFixed(2)}m</span>
                <span className={`text-lg font-bold ${treePredictions.std_dev < 5 ? 'text-[#22c55e]' : 'text-[#f59e0b]'}`}>
                  ± {treePredictions.std_dev.toFixed(2)}m
                </span>
                <span className="text-xs text-[#9CA3AF] ml-2">(95% Conf based on {overview.number_of_trees} trees)</span>
              </div>
            </div>
            <div className="h-12 w-48">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={treePredictions.trees.slice(-50)}>
                    <Bar dataKey="contribution" fill="#3b82f6" />
                  </BarChart>
               </ResponsiveContainer>
            </div>
          </div>
        )}
      </GlassCard>

      {/* SECTION 2 & 3: Tree Explorer & Prediction Flow */}
      <GlassCard title="Section 2 & 3: XGBoost Tree Explorer & Prediction Flow" icon={Network} className="h-[800px]">
        <div className="flex h-full gap-4 min-h-0">
          <div className="w-72 flex flex-col gap-4 border-r border-[#1F293D] pr-4 min-h-0">
            <div className="flex justify-between items-center bg-[#161D30] p-2 rounded-lg border border-[#1F293D]">
              <button onClick={() => setTreeIdx(Math.max(0, treeIdx - 1))} className="p-2 hover:bg-white/10 rounded">
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>
              <span className="font-mono text-sm font-bold text-[#22c55e]">Tree {treeIdx}</span>
              <button onClick={() => setTreeIdx(Math.min(totalTreesData?.total_trees - 1, treeIdx + 1))} className="p-2 hover:bg-white/10 rounded">
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            </div>
            
            <div className="bg-[#161D30] border border-[#1F293D] rounded-lg p-2 flex items-center gap-2">
              <Search className="w-4 h-4 text-[#9CA3AF]" />
              <input 
                type="text" 
                placeholder="Search feature..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-white focus:outline-none placeholder:text-[#475569]"
              />
            </div>
            
            <button 
               onClick={() => { setIsAnimating(true); setAnimationStep(0); }}
               disabled={!pathData || pathLoading || isAnimating}
               className="w-full py-2 bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/50 rounded-lg font-bold text-sm hover:bg-[#3b82f6] hover:text-white transition-colors disabled:opacity-50"
            >
              Play Traversal Animation
            </button>
            
            <div className="flex-1 min-h-0 bg-black/30 rounded-xl p-4 border border-[#1F293D] overflow-y-auto">
              <h4 className="text-xs text-[#9CA3AF] uppercase font-bold mb-4 flex items-center gap-2">
                <Search className="w-3 h-3" /> {(isAnimating || animationStep > 0) && pathData?.path ? "Live Traversal" : "Node Inspector"}
              </h4>
              
              {(isAnimating || animationStep > 0) && pathData?.path ? (
                <div className="space-y-4">
                  <div className="flex gap-2 mb-4">
                    <button onClick={() => { setIsAnimating(true); setAnimationStep(0); }} className="flex-1 py-1 bg-[#3b82f6] text-white text-xs font-bold rounded hover:bg-[#2563eb]">Replay</button>
                    <button onClick={() => { setIsAnimating(false); setAnimationStep(0); }} className="flex-1 py-1 bg-[#1F293D] text-white text-xs font-bold rounded hover:bg-gray-600">Clear</button>
                  </div>
                  {pathData.path.slice(0, animationStep + 1).map((step: any, idx: number) => (
                    <motion.div 
                      key={idx} 
                      initial={{ opacity: 0, x: -10 }} 
                      animate={{ opacity: 1, x: 0 }}
                      className="text-sm font-mono p-3 bg-[#161D30] rounded border border-[#1F293D]"
                    >
                      {step.is_leaf ? (
                        <>
                          <div className="text-[#22c55e] font-bold mb-1">LEAF NODE REACHED</div>
                          <div className="text-white text-lg">Pred = {step.leaf_value.toFixed(4)}</div>
                        </>
                      ) : (
                        <>
                          <div className="text-[#9CA3AF] mb-1 font-bold">Step {idx + 1}</div>
                          <div className="text-white mb-2">
                            <span className="text-[#3b82f6]">{step.feature}</span> &lt; {step.condition.toFixed(4)} ?
                          </div>
                          <div className="flex justify-between items-center bg-black/50 p-2 rounded text-xs border border-[#1F293D]">
                            <span className="text-[#9CA3AF]">Value: {step.current_value.toFixed(4)}</span>
                            <span className={`font-bold ${step.decision === 'YES' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                              ➜ {step.decision}
                            </span>
                          </div>
                        </>
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : selectedNode ? (
                <div className="space-y-3 text-sm font-mono">
                  {selectedNode.split ? (
                    <>
                      <div className="text-white border-b border-[#1F293D] pb-2">Split: <span className="text-[#3b82f6]">{selectedNode.split}</span></div>
                      <div className="text-[#9CA3AF]">Threshold: <span className="text-white">{selectedNode.split_condition?.toFixed(4)}</span></div>
                      <div className="text-[#9CA3AF]">Gain: <span className="text-[#eab308]">{selectedNode.gain?.toFixed(4) || 'N/A'}</span></div>
                      <div className="text-[#9CA3AF]">Cover: <span className="text-white">{selectedNode.cover?.toFixed(4) || 'N/A'}</span></div>
                      <div className="text-[#9CA3AF]">Yes Branch: <span className="text-white">{selectedNode.yes}</span></div>
                      <div className="text-[#9CA3AF]">No Branch: <span className="text-white">{selectedNode.no}</span></div>
                    </>
                  ) : (
                    <>
                      <div className="text-[#22c55e] font-bold border-b border-[#1F293D] pb-2">LEAF NODE</div>
                      <div className="text-[#9CA3AF]">Output Value: <span className="text-white">{selectedNode.leaf?.toFixed(4)}</span></div>
                      <div className="text-[#9CA3AF]">Cover: <span className="text-white">{selectedNode.cover?.toFixed(4) || 'N/A'}</span></div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-xs text-[#9CA3AF] text-center mt-10">Click on any node in the SVG tree to inspect its decision criteria, gain, and cover.</div>
              )}
            </div>
          </div>
          
          <div className="flex-1 relative overflow-auto bg-[#0B0F19] rounded-xl border border-[#1F293D] cursor-move">
             {treeLoading ? (
               <div className="absolute inset-0 flex items-center justify-center"><Activity className="w-8 h-8 text-[#3b82f6] animate-spin" /></div>
             ) : (
               <div 
                 className="w-full h-full cursor-grab active:cursor-grabbing overflow-hidden rounded-xl border border-[#1F293D] relative bg-[#080B11]"
                 onWheel={handleWheel}
                 onMouseDown={handleMouseDown}
                 onMouseMove={handleMouseMove}
                 onMouseUp={handleMouseUp}
                 onMouseLeave={handleMouseUp}
               >
                 <svg width="100%" height="100%" className="min-w-full">
                   <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                     <TreeNode 
                       node={treeData} 
                       x={1000} y={50} level={0} dx={350} 
                       onClick={setSelectedNode} 
                       activeNodes={activeNodes} 
                       collapsedNodes={collapsedNodes} 
                       searchQuery={searchQuery} 
                       onToggleCollapse={toggleCollapse} 
                     />
                   </g>
                 </svg>
                 
                 {/* Zoom Controls Overlay */}
                 <div className="absolute bottom-4 right-4 flex gap-2 bg-[#161D30] border border-[#1F293D] rounded-lg p-1 z-50">
                   <button onClick={() => setZoom(z => Math.min(z + 0.2, 3))} className="p-1 hover:bg-white/10 rounded text-white font-bold w-8">+</button>
                   <button onClick={() => { setZoom(1); setPan({x: -400, y: 0}); }} className="p-1 px-3 hover:bg-white/10 rounded text-xs text-[#9CA3AF] font-bold">RESET</button>
                   <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.2))} className="p-1 hover:bg-white/10 rounded text-white font-bold w-8">-</button>
                 </div>
               </div>
             )}
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SECTION 4: Prediction Contribution */}
        <GlassCard title="Section 4: Additive Contributions" icon={GitCommit}>
           <div className="h-64 flex flex-col gap-2 overflow-y-auto pr-2">
             <div className="p-3 bg-black/20 rounded-lg border border-[#1F293D] flex justify-between">
                <span className="text-[#9CA3AF] text-sm">Base Bias Value</span>
                <span className="font-mono font-bold text-white">{contributions?.bias?.toFixed(2)}</span>
             </div>
             {contributions?.feature_contributions && Object.entries(contributions.feature_contributions).map(([feat, val]: any) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  key={feat} className="p-3 bg-black/20 rounded-lg border border-[#1F293D] flex justify-between items-center relative overflow-hidden"
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${val > 0 ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`}></div>
                  <span className="text-white text-sm pl-2">{feat}</span>
                  <span className={`font-mono font-bold ${val > 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                    {val > 0 ? '+' : ''}{val.toFixed(3)}
                  </span>
                </motion.div>
             ))}
             <div className="mt-4 p-4 bg-gradient-to-r from-[#22c55e]/20 to-[#3b82f6]/20 rounded-lg border border-[#22c55e]/50 flex justify-between">
                <span className="text-white font-bold uppercase">Final Prediction</span>
                <span className="font-mono text-xl font-black text-white">{contributions?.final_prediction?.toFixed(2)} m</span>
             </div>
           </div>
        </GlassCard>

        {/* SECTION 6: Feature Contribution (Waterfall) */}
        <GlassCard title="Section 6: SHAP / Feature Waterfall" icon={BarChart3}>
           <div className="h-64 w-full text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={waterfallData} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" horizontal={false} />
                  <XAxis type="number" stroke="#9CA3AF" />
                  <YAxis dataKey="name" type="category" width={100} stroke="#9CA3AF" />
                  <RechartsTooltip cursor={{fill: '#1F293D'}} contentStyle={{ backgroundColor: '#0B0F19', border: '1px solid #1F293D' }} />
                  <Bar dataKey="value" isAnimationActive={true}>
                    {waterfallData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
           </div>
        </GlassCard>
      </div>

      {/* SECTION 5: Feature Importance */}
      <GlassCard title="Section 5: Global Feature Importance" icon={Database}>
         <div className="h-80 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={featureImp} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" vertical={false} />
                <XAxis dataKey="feature" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <RechartsTooltip cursor={{fill: '#1F293D'}} contentStyle={{ backgroundColor: '#0B0F19', border: '1px solid #1F293D' }} />
                <Bar dataKey="gain" fill="#3b82f6" name="Information Gain" radius={[4, 4, 0, 0]} />
                <Bar dataKey="weight" fill="#f59e0b" name="Split Weight" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
         </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SECTION 5B: Actual vs Predicted */}
        <GlassCard title="Section 6: Actual vs Predicted Alignment" icon={ScatterIcon}>
           <div className="h-80 w-full text-xs">
              {actualVsPredicted && (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" />
                    <XAxis type="number" dataKey="actual" name="Actual Altitude (m)" stroke="#9CA3AF" />
                    <YAxis type="number" dataKey="predicted" name="Predicted Altitude (m)" stroke="#9CA3AF" />
                    <RechartsTooltip cursor={{strokeDasharray: '3 3'}} contentStyle={{ backgroundColor: '#0B0F19', border: '1px solid #1F293D' }} />
                    <Scatter name="Test Data" data={actualVsPredicted} fill="#3b82f6" />
                    {/* Perfect alignment line y=x */}
                    <Line dataKey="actual" stroke="#ef4444" strokeDasharray="5 5" />
                  </ScatterChart>
                </ResponsiveContainer>
              )}
           </div>
        </GlassCard>

        {/* SECTION 5C: Nearest Training Samples */}
        <GlassCard title="Section 7: Nearest Training Samples (k-NN)" icon={Crosshair}>
           <div className="h-80 overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#161D30] text-[#9CA3AF] sticky top-0">
                  <tr>
                    <th className="p-3 font-semibold rounded-tl-lg">Latitude</th>
                    <th className="p-3 font-semibold">Longitude</th>
                    <th className="p-3 font-semibold">Actual Altitude</th>
                    <th className="p-3 font-semibold rounded-tr-lg">Distance (deg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F293D]">
                  {nearestSamples ? nearestSamples.map((samp: any, i: number) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors">
                      <td className="p-3 text-white font-mono">{samp.latitude.toFixed(4)}</td>
                      <td className="p-3 text-white font-mono">{samp.longitude.toFixed(4)}</td>
                      <td className="p-3 text-[#22c55e] font-bold font-mono">{samp.actual_altitude.toFixed(2)}m</td>
                      <td className="p-3 text-[#9CA3AF] font-mono">{samp.distance_deg.toFixed(4)}°</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="p-3 text-center text-[#9CA3AF]">Loading nearest samples...</td></tr>
                  )}
                </tbody>
              </table>
           </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SECTION 7 & 8: Maps */}
        <GlassCard title="Section 8 & 9: Coverage & Decision Regions" icon={MapPin} className="h-[400px]">
          {coverage && (
             <MapContainer center={[(coverage.bounds.min_lat + coverage.bounds.max_lat)/2, (coverage.bounds.min_lon + coverage.bounds.max_lon)/2]} zoom={6} className="w-full h-full rounded-lg" zoomControl={false}>
               <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
               <Rectangle bounds={[[coverage.bounds.min_lat, coverage.bounds.min_lon], [coverage.bounds.max_lat, coverage.bounds.max_lon]]} pathOptions={{ color: '#ef4444', fillOpacity: 0.1, weight: 2 }} />
               {coverage.heatmap_points.map((pt: any, i: number) => (
                 <CircleMarker key={i} center={[pt.lat, pt.lon]} radius={2} pathOptions={{ color: '#22c55e', fillOpacity: 0.5, stroke: false }} />
               ))}
               {nearestSamples && nearestSamples.map((samp: any, i: number) => (
                 <CircleMarker key={`ns-${i}`} center={[samp.latitude, samp.longitude]} radius={5} pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 1, stroke: true }}>
                    <Popup className="custom-popup bg-[#0B0F19] text-white border border-[#1F293D] p-2 rounded text-xs">
                      Nearest Train Sample: {samp.actual_altitude.toFixed(1)}m
                    </Popup>
                 </CircleMarker>
               ))}
             </MapContainer>
          )}
        </GlassCard>

        {/* SECTION 9: Residual Analysis */}
        <GlassCard title="Section 10: Residuals Distribution" icon={AlertCircle} className="h-[400px]">
           <div className="h-full w-full text-xs">
              {residuals && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={residuals.distribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" />
                    <XAxis dataKey="bin" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#0B0F19', border: '1px solid #1F293D' }} />
                    <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={3} dot={{r: 4, fill: '#ef4444'}} />
                  </LineChart>
                </ResponsiveContainer>
              )}
           </div>
        </GlassCard>
      </div>

      {/* SECTION 10: Performance Dashboard */}
      <GlassCard title="Section 11: Telemetry & Performance" icon={Clock}>
         <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { l: "Inference Time", v: performance?.inference_time_ms, u: "ms", c: "text-[#3b82f6]" },
              { l: "Avg Prediction", v: performance?.average_prediction_time_ms, u: "ms", c: "text-[#22c55e]" },
              { l: "Memory Footprint", v: performance?.memory_usage_mb, u: "MB", c: "text-[#f59e0b]" },
              { l: "CPU Inference Cost", v: performance?.cpu_usage_pct, u: "%", c: "text-[#ef4444]" },
              { l: "Model Load Delay", v: performance?.model_loading_time_ms, u: "ms", c: "text-purple-500" }
            ].map(s => (
               <div key={s.l} className="bg-[#161D30] border border-[#1F293D] p-6 rounded-xl flex flex-col items-center justify-center text-center">
                  <div className={`text-4xl font-black ${s.c} mb-2`}>{s.v}</div>
                  <div className="text-[#9CA3AF] text-[10px] font-bold uppercase tracking-wider">{s.l}</div>
                  <div className="text-white/50 text-xs font-mono">{s.u}</div>
               </div>
            ))}
         </div>
      </GlassCard>

    </div>
  );
}
