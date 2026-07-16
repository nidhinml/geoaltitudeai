import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardLayout from './layouts/DashboardLayout';

// Pages Import
import Dashboard from './pages/Dashboard';
import Dataset from './pages/Dataset';
import DataCleaning from './pages/DataCleaning';
import ExploratoryAnalysis from './pages/ExploratoryAnalysis';
import FeatureEngineering from './pages/FeatureEngineering';
import TrainModel from './pages/TrainModel';
import ModelEvaluation from './pages/ModelEvaluation';
import LivePrediction from './pages/LivePrediction';
import BatchPrediction from './pages/BatchPrediction';
import History from './pages/History';
import Settings from './pages/Settings';
import ModelExplainability from './pages/ModelExplainability';
import LearnXGBoost from './pages/LearnXGBoost';
import TerrainIntelligence from './pages/TerrainIntelligence';
import ElevationProfile from './pages/ElevationProfile';
import GradientAnalysis from './pages/GradientAnalysis';
import VehicleIntelligence from './pages/VehicleIntelligence';
import FloodRiskAnalysis from './pages/FloodRiskAnalysis';
import LandslideRiskAnalysis from './pages/LandslideRiskAnalysis';
import ModelFeedback from './pages/ModelFeedback';
import VehicleRouteIntelligence from './pages/VehicleRouteIntelligence';
import SystemArchitecture from './pages/SystemArchitecture';

import FuelEfficiencyAnalysis from './pages/FuelEfficiencyAnalysis';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <DashboardLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dataset" element={<Dataset />} />
            <Route path="/data-cleaning" element={<DataCleaning />} />
            <Route path="/analysis" element={<ExploratoryAnalysis />} />
            <Route path="/features" element={<FeatureEngineering />} />
            <Route path="/train" element={<TrainModel />} />
            <Route path="/evaluation" element={<ModelEvaluation />} />
            <Route path="/live-prediction" element={<LivePrediction />} />
            <Route path="/batch-prediction" element={<BatchPrediction />} />
            <Route path="/fuel-efficiency" element={<FuelEfficiencyAnalysis />} />
            <Route path="/history" element={<History />} />
            <Route path="/explainability" element={<ModelExplainability />} />
            <Route path="/learn" element={<LearnXGBoost />} />
            <Route path="/terrain" element={<TerrainIntelligence />} />
            <Route path="/elevation-profile" element={<ElevationProfile />} />
            <Route path="/gradient" element={<GradientAnalysis />} />
            <Route path="/vehicle-intelligence" element={<VehicleIntelligence />} />
            <Route path="/route-intelligence" element={<VehicleRouteIntelligence />} />
            <Route path="/model-feedback" element={<ModelFeedback />} />
            <Route path="/architecture" element={<SystemArchitecture />} />
            <Route path="/flood-risk" element={<FloodRiskAnalysis />} />
            <Route path="/landslide-risk" element={<LandslideRiskAnalysis />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </DashboardLayout>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
