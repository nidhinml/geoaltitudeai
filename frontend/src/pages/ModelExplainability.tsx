import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, 
  LineChart, Line, Cell, ScatterChart, Scatter, ZAxis, ComposedChart
} from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Rectangle, Popup } from 'react-leaflet';
import { motion } from 'framer-motion';
import { 
  Activity, Brain, Network, GitCommit, 
  BarChart3, Database, AlertCircle, Clock, Search, ChevronLeft, ChevronRight, MapPin,
  Crosshair, ScatterChart as ScatterIcon, Layers, Info, Map as MapIcon, Eye, EyeOff
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
  const [isAutoPlayingFullFlow, setIsAutoPlayingFullFlow] = useState(false);

  // Tree viewer interactivity state
  const [showTutorial, setShowTutorial] = useState(false);
  const [showMapTutorial, setShowMapTutorial] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);
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
    if (isAnimating && pathData?.path && !isAutoPlayingFullFlow) {
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
  }, [isAnimating, pathData, isAutoPlayingFullFlow]);

  useEffect(() => {
    let interval: any;
    if (isAutoPlayingFullFlow && totalTreesData?.total_trees > 0) {
      interval = setInterval(() => {
        setTreeIdx(prev => {
          if (prev >= totalTreesData.total_trees - 1) {
            setIsAutoPlayingFullFlow(false);
            clearInterval(interval);
            return prev;
          }
          return prev + 1;
        });
      }, 1000); // 1 tree per second
    }
    return () => clearInterval(interval);
  }, [isAutoPlayingFullFlow, totalTreesData]);

  useEffect(() => {
    if (isAutoPlayingFullFlow && pathData?.path) {
      setAnimationStep(pathData.path.length - 1);
    }
  }, [treeIdx, isAutoPlayingFullFlow, pathData]);

  const activeNodes = new Set(
    (isAnimating || isAutoPlayingFullFlow || animationStep > 0) && pathData?.path
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-black text-white flex items-center gap-3">
          <Brain className="w-8 h-8 text-[#22c55e]" />
          Model Feedback & Explainability
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={() => setShowUserGuide(!showUserGuide)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#161D30] hover:bg-[#1F293D] text-[#9CA3AF] hover:text-white text-xs font-bold rounded-lg border border-[#1F293D] transition-colors"
          >
            <Info className="w-4 h-4" />
            {showUserGuide ? 'Hide Guide' : 'User Guide'}
          </button>
          <button 
            onClick={() => setShowMapTutorial(!showMapTutorial)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#161D30] hover:bg-[#1F293D] text-[#9CA3AF] hover:text-white text-xs font-bold rounded-lg border border-[#1F293D] transition-colors"
          >
            {showMapTutorial ? <EyeOff className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
            {showMapTutorial ? 'Hide Architecture' : 'Tech Architecture'}
          </button>
          <button 
            onClick={() => setShowTutorial(!showTutorial)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#161D30] hover:bg-[#1F293D] text-[#9CA3AF] hover:text-white text-xs font-bold rounded-lg border border-[#1F293D] transition-colors"
          >
            {showTutorial ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showTutorial ? 'Hide AI Logic' : 'How AI Works'}
          </button>
        </div>
      </div>

      {/* USER GUIDE */}
      {showUserGuide && (
      <div className="glass-panel p-5 rounded-2xl border border-[#1F293D] bg-[#0B0F19]">
        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
          <Info className="w-4 h-4 text-[#22c55e]" /> How to Use This Page
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-[#9CA3AF]">
          <li><strong>Review Model Stats:</strong> Check the Model Overview to see how many trees and features the AI was trained on.</li>
          <li><strong>Check Predictions:</strong> In Section 2, select a coordinate on the map to see exactly how the AI predicts its altitude.</li>
          <li><strong>Explore the Trees:</strong> In Section 3 & 4, press "Play Single Tree" to watch a decision tree mathematically split the data step-by-step.</li>
          <li><strong>Analyze Performance:</strong> Scroll down to view the Feature Importance and Residuals charts to understand the model's accuracy.</li>
        </ol>
      </div>
      )}

      {/* TECH ARCHITECTURE */}
      {showMapTutorial && (
      <div className="glass-panel p-5 rounded-2xl border border-[#1F293D] bg-[#0B0F19]">
        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
          <MapIcon className="w-4 h-4 text-[#3b82f6]" /> Platform Architecture
        </h3>
        <p className="text-sm text-[#9CA3AF] leading-relaxed">
          <strong className="text-white">FastAPI Explainability Engine:</strong> The frontend React application pulls massive JSON payloads from the Python backend via dedicated explainability routes (e.g., `/api/explainability/tree_explorer`). 
          We use <strong className="text-[#3b82f6]">D3.js-inspired custom SVG rendering</strong> in React to draw the decision trees dynamically, calculating exact `x/y` coordinates for every node and branch to visualize the XGBoost model's internal state in real-time.
        </p>
      </div>
      )}

      {/* HOW AI WORKS */}
      {showTutorial && (
      <div className="glass-panel p-5 rounded-2xl border border-[#1F293D] bg-[#0B0F19]">
        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
          <Brain className="w-4 h-4 text-[#22c55e]" /> XGBoost Mathematical Logic
        </h3>
        <p className="text-sm text-[#9CA3AF] leading-relaxed">
          <strong className="text-white">Gradient Boosting:</strong> Extreme Gradient Boosting (XGBoost) doesn't use one massive equation. Instead, it starts with a base guess (the average altitude of Kerala). 
          Then, it builds a decision tree specifically designed to predict the <em>residual error</em> (the difference between the guess and the true altitude). 
          The next tree predicts the error of the previous tree, incrementally nudging the final prediction closer to reality. The final altitude is simply the sum of the base guess plus the output of all 100 trees!
        </p>
      </div>
      )}

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

      {/* SECTION 2: Boosting Animation */}
      <GlassCard title="How XGBoost Learns (The Boosting Sequence)" icon={Layers}>
        <div className="bg-[#161D30] border border-[#1F293D] rounded-xl p-6 relative overflow-hidden h-[250px] flex items-center justify-between px-10">
          <div className="absolute top-4 left-6 max-w-2xl text-sm text-[#9CA3AF]">
            <strong className="text-white">XGBoost Sequential Boosting:</strong> The first tree makes a guess. It is usually wrong. The second tree looks <span className="text-red-400">only at the mistakes (errors)</span> of the first tree and tries to fix them. The third tree fixes the mistakes of the second, and so on until the target is reached.
          </div>
          
          {/* Target Value */}
          <div className="flex flex-col items-center z-10 mt-12">
            <span className="text-xs text-[#9CA3AF] uppercase font-bold mb-2">Target Altitude</span>
            <div className="w-24 h-24 rounded-full border-4 border-[#22c55e] flex items-center justify-center bg-black/50 shadow-[0_0_20px_rgba(34,197,94,0.3)]">
              <span className="text-xl font-black text-white">1000m</span>
            </div>
          </div>

          <motion.div 
            animate={{ x: [0, 50, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="flex-1 flex justify-around px-8 mt-12"
          >
            {/* Tree 1 */}
            <div className="flex flex-col items-center">
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse", repeatDelay: 4 }}
                className="w-16 h-16 bg-[#3b82f6]/20 border border-[#3b82f6] rounded-lg flex flex-col items-center justify-center relative"
              >
                <Network className="w-6 h-6 text-[#3b82f6] mb-1" />
                <span className="text-[10px] font-bold text-white">Tree 1</span>
              </motion.div>
              <span className="text-xs text-white mt-2 font-bold bg-[#1F293D] px-2 py-1 rounded">Guess: 800m</span>
              <motion.span 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5, repeat: Infinity, repeatDelay: 3.5 }}
                className="text-xs text-red-400 font-bold mt-1"
              >
                Error: 200m ➜
              </motion.span>
            </div>

            {/* Tree 2 */}
            <div className="flex flex-col items-center">
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1, duration: 0.5, repeat: Infinity, repeatType: "reverse", repeatDelay: 3 }}
                className="w-16 h-16 bg-[#3b82f6]/20 border border-[#3b82f6] rounded-lg flex flex-col items-center justify-center relative"
              >
                <Network className="w-6 h-6 text-[#3b82f6] mb-1" />
                <span className="text-[10px] font-bold text-white">Tree 2</span>
              </motion.div>
              <span className="text-xs text-white mt-2 font-bold bg-[#1F293D] px-2 py-1 rounded">Guess: 150m</span>
              <motion.span 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5, duration: 0.5, repeat: Infinity, repeatDelay: 2.5 }}
                className="text-xs text-red-400 font-bold mt-1"
              >
                Error: 50m ➜
              </motion.span>
            </div>

            {/* Tree 3 */}
            <div className="flex flex-col items-center">
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 2, duration: 0.5, repeat: Infinity, repeatType: "reverse", repeatDelay: 2 }}
                className="w-16 h-16 bg-[#3b82f6]/20 border border-[#3b82f6] rounded-lg flex flex-col items-center justify-center relative"
              >
                <Network className="w-6 h-6 text-[#3b82f6] mb-1" />
                <span className="text-[10px] font-bold text-white">Tree 3</span>
              </motion.div>
              <span className="text-xs text-white mt-2 font-bold bg-[#1F293D] px-2 py-1 rounded">Guess: 48m</span>
              <motion.span 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2.5, duration: 0.5, repeat: Infinity, repeatDelay: 1.5 }}
                className="text-xs text-[#22c55e] font-bold mt-1"
              >
                Error: 2m ✓
              </motion.span>
            </div>
          </motion.div>

          {/* Final Prediction */}
          <div className="flex flex-col items-center z-10 mt-12">
            <span className="text-xs text-[#9CA3AF] uppercase font-bold mb-2">Final AI Prediction</span>
            <motion.div 
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 3, duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
              className="w-24 h-24 rounded-full border-4 border-[#3b82f6] flex flex-col items-center justify-center bg-black/50 shadow-[0_0_20px_rgba(59,130,246,0.3)]"
            >
              <span className="text-xs font-bold text-[#9CA3AF]">800+150+48</span>
              <span className="text-xl font-black text-white">998m</span>
            </motion.div>
          </div>
        </div>
      </GlassCard>

      {/* SECTION 2.5: Algorithm & Hyperparameters Dictionary */}
      <GlassCard title="The Core Algorithm & Hyperparameters" icon={Brain}>
        <div className="text-sm text-[#9CA3AF] mb-6">
          <strong className="text-white text-base">The Core Algorithm:</strong> The algorithm running in the background is Extreme Gradient Boosting (XGBoost Regressor). Instead of building one massive brain, XGBoost builds hundreds of small "Decision Trees" in a sequence. The first tree makes a guess. It is usually wrong. The second tree looks only at the mistakes of the first tree and tries to fix them. The third tree fixes the mistakes of the second, and so on.
          <br/><br/>
          <strong className="text-white">Here is exactly how these parameters control that algorithm:</strong>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#161D30] border border-[#1F293D] p-4 rounded-xl hover:border-[#3b82f6]/50 transition-colors">
            <h4 className="text-white font-bold mb-2">1. Learning Rate (eta) - 0.1</h4>
            <p className="text-xs text-[#9CA3AF] mb-2"><strong className="text-[#3b82f6]">How it works (The Math):</strong> When a tree makes a prediction, XGBoost multiplies its answer by 0.1 before passing the remaining error to the next tree.</p>
            <p className="text-xs text-[#9CA3AF]"><strong className="text-[#22c55e]">Why we take it:</strong> It acts as the "Brakes" for the AI. If the AI learns too fast (1.0), it will just memorize the training data and fail the final exam. By slowing the learning rate down to 0.1, we force the AI to take tiny, careful, mathematical steps toward the perfect answer.</p>
          </div>
          
          <div className="bg-[#161D30] border border-[#1F293D] p-4 rounded-xl hover:border-[#3b82f6]/50 transition-colors">
            <h4 className="text-white font-bold mb-2">2. Max Depth - 6</h4>
            <p className="text-xs text-[#9CA3AF] mb-2"><strong className="text-[#3b82f6]">How it works (The Algorithm):</strong> A decision tree asks yes/no questions (e.g., "Is Latitude &gt; 10?"). "Max Depth: 6" means the tree is physically prevented from asking more than 6 chained questions before it is forced to give an answer.</p>
            <p className="text-xs text-[#9CA3AF]"><strong className="text-[#22c55e]">Why we take it:</strong> If we let the tree grow infinitely deep (e.g., Depth 50), it would create a specific, complex rule for every single GPS point in Kerala (Overfitting). Capping it at 6 forces the AI to learn general geographic patterns rather than memorizing exact roads.</p>
          </div>

          <div className="bg-[#161D30] border border-[#1F293D] p-4 rounded-xl hover:border-[#3b82f6]/50 transition-colors">
            <h4 className="text-white font-bold mb-2">3. Estimators Count (Trees) - 100</h4>
            <p className="text-xs text-[#9CA3AF] mb-2"><strong className="text-[#3b82f6]">How it works (The Algorithm):</strong> This is the exact number of sequential decision trees the algorithm will build.</p>
            <p className="text-xs text-[#9CA3AF]"><strong className="text-[#22c55e]">Why we take it:</strong> Because we applied the "Brakes" with a Learning Rate of 0.1, the AI needs time to learn. Building exactly 100 sequential trees gives the algorithm enough cycles to perfectly map the terrain without wasting CPU power.</p>
          </div>

          <div className="bg-[#161D30] border border-[#1F293D] p-4 rounded-xl hover:border-[#3b82f6]/50 transition-colors">
            <h4 className="text-white font-bold mb-2">4. Subsample Ratio - 1 (100%)</h4>
            <p className="text-xs text-[#9CA3AF] mb-2"><strong className="text-[#3b82f6]">How it works (The Math):</strong> Controls what percentage of the Rows (GPS points) are given to each individual tree. 1 means 100% of the dataset is given to every tree.</p>
            <p className="text-xs text-[#9CA3AF]"><strong className="text-[#22c55e]">Why we take it:</strong> If the AI was struggling to generalize, we might lower this to 0.8. This would force each tree to randomly look at only 80% of the map, preventing the trees from copying each other.</p>
          </div>

          <div className="bg-[#161D30] border border-[#1F293D] p-4 rounded-xl hover:border-[#3b82f6]/50 transition-colors">
            <h4 className="text-white font-bold mb-2">5. Colsample By Tree - 1 (100%)</h4>
            <p className="text-xs text-[#9CA3AF] mb-2"><strong className="text-[#3b82f6]">How it works (The Math):</strong> Controls what percentage of the Columns (Features like Lat², Lon², etc.) are given to each tree.</p>
            <p className="text-xs text-[#9CA3AF]"><strong className="text-[#22c55e]">Why we take it:</strong> Sometimes, an AI relies too heavily on one feature (like Latitude). Lowering this number forces the AI to temporarily ignore Latitude and figure out how to predict altitude using only the other columns, making the overall model much smarter.</p>
          </div>

          <div className="bg-[#161D30] border border-[#1F293D] p-4 rounded-xl hover:border-[#3b82f6]/50 transition-colors">
            <h4 className="text-white font-bold mb-2">6. Gamma - 0</h4>
            <p className="text-xs text-[#9CA3AF] mb-2"><strong className="text-[#3b82f6]">How it works (The Math):</strong> Gamma is a strict mathematical penalty. It is the minimum amount of "Accuracy Improvement" required before a tree is allowed to split a branch.</p>
            <p className="text-xs text-[#9CA3AF]"><strong className="text-[#22c55e]">Why we take it:</strong> A higher Gamma makes the algorithm extremely conservative (it refuses to grow unless it's guaranteed to improve). Setting it to 0 means we are letting the decision trees grow naturally based on their Max Depth.</p>
          </div>

          <div className="bg-[#161D30] border border-[#1F293D] p-4 rounded-xl hover:border-[#3b82f6]/50 transition-colors md:col-span-2 lg:col-span-1">
            <h4 className="text-white font-bold mb-2">7. Min Child Weight - 1</h4>
            <p className="text-xs text-[#9CA3AF] mb-2"><strong className="text-[#3b82f6]">How it works (The Algorithm):</strong> The minimum number of GPS points that must end up in a final "leaf" of the tree.</p>
            <p className="text-xs text-[#9CA3AF]"><strong className="text-[#22c55e]">Why we take it:</strong> If we set this to 100, XGBoost would refuse to make a decision unless at least 100 GPS points fall into that specific category. This prevents the AI from creating crazy, hyper-specific rules just to satisfy 1 or 2 glitchy GPS points on a mountain.</p>
          </div>
        </div>
      </GlassCard>

      {/* SECTION 3 & 4: Tree Explorer & Prediction Flow */}
      <GlassCard title="Section 3 & 4: XGBoost Tree Explorer & Prediction Flow" icon={Network} className="h-[800px]">
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
            
            <div className="flex gap-2">
              <button 
                 onClick={() => { setIsAnimating(true); setAnimationStep(0); setIsAutoPlayingFullFlow(false); }}
                 disabled={!pathData || pathLoading || isAnimating || isAutoPlayingFullFlow}
                 className="flex-1 py-2 bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/50 rounded-lg font-bold text-[10px] hover:bg-[#3b82f6] hover:text-white transition-colors disabled:opacity-50"
              >
                PLAY SINGLE TREE
              </button>
              <button 
                 onClick={() => { 
                   if (isAutoPlayingFullFlow) {
                     setIsAutoPlayingFullFlow(false);
                   } else {
                     if (treeIdx >= (totalTreesData?.total_trees || 100) - 1) setTreeIdx(0);
                     setIsAutoPlayingFullFlow(true); 
                     setIsAnimating(false); 
                   }
                 }}
                 disabled={!pathData || pathLoading || isAnimating}
                 className={`flex-1 py-2 border rounded-lg font-bold text-[10px] transition-colors disabled:opacity-50 ${
                   isAutoPlayingFullFlow 
                     ? 'bg-[#ef4444] text-white border-[#ef4444] shadow-[0_0_15px_rgba(239,68,68,0.3)]' 
                     : 'bg-[#22c55e]/20 text-[#22c55e] border-[#22c55e]/50 hover:bg-[#22c55e] hover:text-white shadow-[0_0_10px_rgba(34,197,94,0.1)]'
                 }`}
              >
                {isAutoPlayingFullFlow ? 'STOP FULL FLOW' : 'AUTO-PLAY FULL FLOW'}
              </button>
            </div>
            
            <div className="flex-1 min-h-0 bg-black/30 rounded-xl p-4 border border-[#1F293D] overflow-y-auto">
              <h4 className="text-xs text-[#9CA3AF] uppercase font-bold mb-4 flex items-center gap-2">
                <Search className="w-3 h-3" /> {(isAnimating || isAutoPlayingFullFlow || animationStep > 0) && pathData?.path ? (isAutoPlayingFullFlow ? `Auto-Playing Tree ${treeIdx}...` : "Live Traversal") : "Node Inspector"}
              </h4>
              
              {(isAnimating || isAutoPlayingFullFlow || animationStep > 0) && pathData?.path ? (
                <div className="space-y-4">
                  <div className="flex gap-2 mb-4">
                    <button onClick={() => { setIsAnimating(true); setAnimationStep(0); setIsAutoPlayingFullFlow(false); }} disabled={isAutoPlayingFullFlow} className="flex-1 py-1 bg-[#3b82f6] text-white text-xs font-bold rounded hover:bg-[#2563eb] disabled:opacity-50 disabled:cursor-not-allowed">Replay</button>
                    <button onClick={() => { setIsAnimating(false); setIsAutoPlayingFullFlow(false); setAnimationStep(0); }} className="flex-1 py-1 bg-[#1F293D] text-white text-xs font-bold rounded hover:bg-gray-600">Clear</button>
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
        {/* SECTION 5: Prediction Contribution */}
        <GlassCard title="Section 5: Additive Contributions (How the AI calculates the final number)" icon={GitCommit}>
           <p className="text-[10px] text-[#9CA3AF] mb-3 leading-tight">
             <strong className="text-white">What it means:</strong> The AI always starts by guessing the "Average Altitude" of the entire dataset (Base Bias). Then, it looks at the specific Latitude and Longitude you selected, and either ADDS or SUBTRACTS meters to adjust that average up or down until it reaches the Final Prediction.
           </p>
           <div className="h-56 flex flex-col gap-2 overflow-y-auto pr-2">
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
        <GlassCard title="Section 6: SHAP Waterfall (Visualizing the Adjustments)" icon={BarChart3}>
           <p className="text-[10px] text-[#9CA3AF] mb-3 leading-tight">
             <strong className="text-white">What it means:</strong> This is a visual representation of Section 5. It shows exactly how much "pull" each geographic feature had. Green bars pushed the altitude higher than the average, red bars pulled it lower.
           </p>
           <div className="h-56 w-full text-xs">
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

      {/* SECTION 7: Feature Importance */}
      <GlassCard title="Section 7: Global Feature Importance (What the AI cares about most)" icon={Database}>
         <p className="text-[10px] text-[#9CA3AF] mb-3 leading-tight">
           <strong className="text-white">What it means:</strong> Across all 100 decision trees, which columns of data did the AI rely on the most to make its decisions? <br/>
           <strong className="text-[#3b82f6]">Information Gain (Blue):</strong> How much a feature improved accuracy when used. <strong className="text-[#f59e0b]">Split Weight (Orange):</strong> How many times the AI chose to use that feature to split a branch.
         </p>
         <div className="h-72 w-full text-xs">
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
        {/* SECTION 8: Actual vs Predicted */}
        <GlassCard title="Section 8: Actual vs Predicted (AI Accuracy Check)" icon={ScatterIcon}>
           <p className="text-[10px] text-[#9CA3AF] mb-3 leading-tight">
             <strong className="text-white">What it means:</strong> We took a random sample of locations where we know the true altitude and asked the AI to guess them. If the AI is perfect, every blue dot will fall exactly on the red diagonal line. Dots far away from the red line are mistakes.
           </p>
           <div className="h-72 w-full text-xs">
              {actualVsPredicted && (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" />
                    <XAxis type="number" dataKey="actual" name="Actual Altitude (m)" stroke="#9CA3AF" domain={['auto', 'auto']} />
                    <YAxis type="number" dataKey="predicted" name="Predicted Altitude (m)" stroke="#9CA3AF" domain={['auto', 'auto']} />
                    <RechartsTooltip cursor={{strokeDasharray: '3 3'}} contentStyle={{ backgroundColor: '#0B0F19', border: '1px solid #1F293D' }} />
                    <Scatter name="Test Data" data={actualVsPredicted} fill="#3b82f6" />
                    {/* Perfect alignment line y=x */}
                    <Line 
                      name="Perfect Accuracy"
                      data={[
                        {actual: 0, predicted: 0}, 
                        {
                          actual: Math.max(...actualVsPredicted.map((d: any) => Math.max(d.actual, d.predicted))) * 1.1, 
                          predicted: Math.max(...actualVsPredicted.map((d: any) => Math.max(d.actual, d.predicted))) * 1.1
                        }
                      ]}
                      type="linear" 
                      dataKey="predicted" 
                      stroke="#ef4444" 
                      strokeDasharray="5 5" 
                      strokeWidth={2}
                      dot={false}
                      activeDot={false}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
           </div>
        </GlassCard>

        {/* SECTION 9: Nearest Training Samples */}
        <GlassCard title="Section 9: Nearest Training Samples (Sanity Check)" icon={Crosshair}>
           <p className="text-[10px] text-[#9CA3AF] mb-3 leading-tight">
             <strong className="text-white">What it means:</strong> AI doesn't actually "know" where a place is—it just does math. To prove its prediction makes sense, we use a separate algorithm (k-NN) to find the 5 closest real-world training points to your chosen location to ensure the AI's guess is realistic.
           </p>
           <div className="h-72 overflow-y-auto custom-scrollbar">
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
        {/* SECTION 10: Maps */}
        <GlassCard title="Section 10: Coverage & Decision Regions" icon={MapPin} className="h-[450px]">
          <p className="text-[10px] text-[#9CA3AF] mb-3 leading-tight">
             <strong className="text-white">What it means:</strong> A geographic view of where the model is confident. The red box is the boundary of our training data. The yellow dots show the nearest true training samples (from Section 9) that surround your chosen prediction point.
          </p>
          {coverage && (
             <MapContainer center={[(coverage.bounds.min_lat + coverage.bounds.max_lat)/2, (coverage.bounds.min_lon + coverage.bounds.max_lon)/2]} zoom={6} className="w-full h-[350px] rounded-lg" zoomControl={false}>
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
