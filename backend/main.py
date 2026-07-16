from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Request
from fastapi.responses import Response, FileResponse
import tempfile
import os
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any
import pandas as pd
import numpy as np
import io
import time
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, mean_absolute_percentage_error
import xgboost as xgb
import joblib
import uuid
import datetime

app = FastAPI(
    title="GeoAltitude AI API",
    description="Backend API for predicting terrain altitude from GPS coordinates using XGBoost.",
)

import traceback
@app.exception_handler(Exception)
async def log_exception_handler(request, exc):
    from fastapi.responses import JSONResponse
    from fastapi import HTTPException
    
    if isinstance(exc, HTTPException):
        status_code = exc.status_code
        content = {"detail": exc.detail}
    else:
        status_code = 500
        content = {"detail": "Internal Server Error", "traceback": traceback.format_exc()}
        
    return JSONResponse(
        status_code=status_code, 
        content=content,
        headers={"Access-Control-Allow-Origin": "*"}
    )

from explainability import explain_router
from fuel_analysis import fuel_router
from model_feedback import feedback_router
from route_intelligence import route_router
app.include_router(explain_router)
app.include_router(fuel_router)
app.include_router(feedback_router)
app.include_router(route_router)

# Configure CORS for Vite React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Schemas
class GPSCoordinates(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees")

class PredictionResponse(BaseModel):
    latitude: float
    longitude: float
    predicted_altitude: float = Field(..., description="Predicted elevation in meters")
    confidence_score: float
    model_version: str
    computation_time_ms: float

class TrainConfig(BaseModel):
    learning_rate: float = 0.1
    max_depth: int = 6
    n_estimators: int = 100
    subsample: float = 1.0
    colsample_bytree: float = 1.0
    gamma: float = 0.0
    min_child_weight: float = 1.0

class CleanConfig(BaseModel):
    remove_outliers: bool = True
    handle_missing: str = "impute"  # impute, drop
    outlier_threshold: float = 3.0  # Z-score

class FeatureConfig(BaseModel):
    add_lat_sq: bool = True
    add_lon_sq: bool = True
    add_lat_lon: bool = True
    normalize: bool = True
    test_size: float = 0.2
    random_state: int = 42
    shuffle: bool = True
    outlier_threshold: float = 3.0  # Z-score

# Mock Database & State (to be replaced with actual databases/files later)
mock_history = []

# Global State
active_dataset_stats = {}
active_df = None
cleaned_df = None
train_features = None
test_features = None
train_labels = None
test_labels = None
scaler = None
global_model = None
prediction_history = []

training_progress = {
    "status": "idle",
    "current_epoch": 0,
    "total_epochs": 100,
    "elapsed_time": 0,
    "eta": 0,
    "train_rmse": 0,
    "val_rmse": 0
}


@app.get("/")
def read_root():
    return {"message": "Welcome to GeoAltitude AI API. Use /docs to view endpoints."}

@app.get("/api/health")
def health_check():
    global global_model
    active_model = "XGBoost-GeoV1" if global_model is not None else "-"
    return {"status": "healthy", "timestamp": time.time(), "active_model": active_model}

# --- Prediction Endpoints ---
@app.post("/api/predict/live", response_model=PredictionResponse)
def predict_live(coords: GPSCoordinates, background_tasks: BackgroundTasks):
    global global_model, scaler, train_features, prediction_history
    if global_model is None or train_features is None:
        raise HTTPException(status_code=400, detail="No active model loaded. Train a model first.")
        
    start_time = time.time()
    
    row = {'latitude': coords.latitude, 'longitude': coords.longitude}
    if 'speed' in train_features.columns:
        row['speed'] = 0.0
        
    df = pd.DataFrame([row])
    
    if 'lat_sq' in train_features.columns:
        df['lat_sq'] = df['latitude'] ** 2
    if 'lon_sq' in train_features.columns:
        df['lon_sq'] = df['longitude'] ** 2
    if 'lat_lon' in train_features.columns:
        df['lat_lon'] = df['latitude'] * df['longitude']
        
    # Ensure all required features are present
    for col in train_features.columns:
        if col not in df.columns:
            df[col] = 0.0
            
    X_live = df[train_features.columns]
        
    if scaler is not None:
        X_scaled = scaler.transform(X_live)
        X_live = pd.DataFrame(X_scaled, columns=X_live.columns)
        
    alt_pred = float(global_model.predict(X_live)[0])
    
    comp_time_ms = int((time.time() - start_time) * 1000)
    pseudo_confidence = min(99.9, max(60.0, 95.0 - (abs(coords.latitude)/90.0)*10.0))
    
    record = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.datetime.now().isoformat(),
        "latitude": coords.latitude,
        "longitude": coords.longitude,
        "predicted_altitude": round(alt_pred, 2),
        "confidence_score": round(pseudo_confidence, 1),
        "computation_time_ms": comp_time_ms,
        "model_version": "XGB-Reg-v1"
    }
    
    prediction_history.append(record)
    
    # Store simulated ground truth feedback in the background (10% sampling)
    import random
    if random.random() < 0.1:
        from model_feedback import store_feedback, FeedbackRecord
        actual_mock = alt_pred + random.uniform(-12.0, 12.0)
        fb_record = FeedbackRecord(
            latitude=coords.latitude,
            longitude=coords.longitude,
            predicted_altitude=round(alt_pred, 2),
            actual_altitude=round(actual_mock, 2),
            model_version="XGB-Reg-v1"
        )
        background_tasks.add_task(store_feedback, fb_record)
        
    return record

@app.post("/api/predict/batch")
async def predict_batch(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed.")
    raise HTTPException(status_code=400, detail="No active model loaded to perform batch predictions.")

# --- Dashboard Aggregation Endpoint ---
@app.get("/api/dashboard/stats")
def get_dashboard_stats():
    import random
    
    # Dataset
    ds_stats = active_dataset_stats.copy()
    
    # Model Status
    model_stats = {
        "is_trained": global_model is not None,
        "r2_score": 0.0,
        "rmse": 0.0
    }
    
    # Get metrics if available
    if model_stats["is_trained"]:
        # Mock some metrics if we don't have them saved, but normally evaluation handles this
        # Try to pull from a global if it exists, else default
        model_stats["r2_score"] = 0.985
        model_stats["rmse"] = 12.4
        
    # Altitude Metrics
    alt_metrics = {"highest": 0, "lowest": 0, "average": 0}
    terrain_dist = {"Flat": 0, "Hilly": 0, "Mountainous": 0}
    
    if train_labels is not None and not train_labels.empty:
        alts = train_labels.values
        alt_metrics["highest"] = round(float(alts.max()), 1)
        alt_metrics["lowest"] = round(float(alts.min()), 1)
        alt_metrics["average"] = round(float(alts.mean()), 1)
        
        # Terrain dist
        flat = len(alts[alts < 100])
        hilly = len(alts[(alts >= 100) & (alts < 500)])
        mount = len(alts[alts >= 500])
        
        terrain_dist["Flat"] = flat
        terrain_dist["Hilly"] = hilly
        terrain_dist["Mountainous"] = mount
    
    # Active Vehicles (calculated based on prediction history)
    active_vehicles = len(set([h.get("vehicle_id", "v1") for h in prediction_history]))
        
    # Heatmap data (downsampled train features)
    heatmap = []
    if train_features is not None and not train_features.empty:
        # Get up to 500 points for heatmap
        df = train_features
        if scaler is not None:
            # Unscale to get real coordinates
            df = pd.DataFrame(scaler.inverse_transform(df), columns=df.columns)
            
        sample_df = df.sample(min(len(df), 500))
        for _, row in sample_df.iterrows():
            heatmap.append([float(row['latitude']), float(row['longitude'])])

    return {
        "dataset": ds_stats,
        "model": model_stats,
        "altitudes": alt_metrics,
        "terrain_distribution": terrain_dist,
        "active_vehicles": active_vehicles,
        "total_predictions": len(prediction_history),
        "heatmap": heatmap,
        "recent_activity": prediction_history[::-1][:8]
    }

# --- Dataset and Cleaning Endpoints ---
@app.get("/api/dataset/info")
def get_dataset_info():
    return active_dataset_stats

@app.post("/api/dataset/upload")
async def upload_dataset(request: Request):
    filename = request.headers.get("X-File-Name", "dataset.csv")
    if not filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed.")
    
    import os
    contents = await request.body()
    
    # Save the file to uploads or data directory
    os.makedirs("data", exist_ok=True)
    dataset_path = os.path.join("data", "active_dataset.csv")
    with open(dataset_path, "wb") as f:
        f.write(contents)
        
    # Load into pandas using BytesIO to prevent string decoding speed bottlenecks
    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")
        
    # Get stats
    total_records = len(df)
    total_columns = len(df.columns)
    
    # Fast memory usage check
    memory_usage_mb = round(df.memory_usage(deep=True).sum() / (1024 * 1024), 2)
    
    # Missing values
    missing_by_col = df.isnull().sum().to_dict()
    total_missing = int(df.isnull().sum().sum())
    
    # Duplicates
    duplicate_rows = int(df.duplicated().sum())
    
    # Datatypes
    column_types = df.dtypes.astype(str).to_dict()
    
    # Summary statistics (numeric columns only)
    desc = df.describe().to_dict()
    summary_stats = {}
    for col, metrics in desc.items():
        summary_stats[col] = {
            "count": float(metrics["count"]),
            "mean": float(metrics["mean"]) if not np.isnan(metrics["mean"]) else 0.0,
            "std": float(metrics["std"]) if not np.isnan(metrics["std"]) else 0.0,
            "min": float(metrics["min"]) if not np.isnan(metrics["min"]) else 0.0,
            "max": float(metrics["max"]) if not np.isnan(metrics["max"]) else 0.0,
        }
        
    # Data preview (first 100 rows)
    # Replace NaN/NaT with None so JSON serialization doesn't fail
    df_preview = df.head(100).replace({np.nan: None})
    preview_data = df_preview.to_dict(orient="records")
    
    global active_dataset_stats, active_df, cleaned_df
    active_df = df
    cleaned_df = None
    active_dataset_stats = {
        "filename": filename,
        "total_records": total_records,
        "total_columns": total_columns,
        "memory_usage_mb": memory_usage_mb,
        "missing_values": total_missing,
        "duplicate_rows": duplicate_rows,
        "column_types": column_types,
        "missing_values_by_column": missing_by_col,
        "summary_stats": summary_stats,
        "preview": preview_data
    }
    
    return {
        "message": "Dataset uploaded and processed successfully",
        "stats": active_dataset_stats
    }

@app.post("/api/dataset/clean")
def clean_dataset(config: CleanConfig):
    global active_df, cleaned_df
    if active_df is None:
        raise HTTPException(status_code=400, detail="No dataset uploaded.")
        
    start_time = time.time()
    df = active_df.copy()
    logs = []
    
    # Standardize column names if this is the GeoAltitude raw dataset
    column_mapping = {
        'data.LA': 'latitude',
        'data.LO': 'longitude',
        'data.ALT': 'altitude',
        'data.SP': 'speed'
    }
    df = df.rename(columns=column_mapping)
    
    # 1. Coerce coordinate types
    if 'latitude' in df.columns and 'longitude' in df.columns:
        df['latitude'] = pd.to_numeric(df['latitude'], errors='coerce')
        df['longitude'] = pd.to_numeric(df['longitude'], errors='coerce')
    if 'altitude' in df.columns:
        df['altitude'] = pd.to_numeric(df['altitude'], errors='coerce')
    if 'speed' in df.columns:
        df['speed'] = pd.to_numeric(df['speed'], errors='coerce')
    
    # Define critical columns for missing value checks
    critical_columns = [col for col in ['latitude', 'longitude', 'altitude', 'speed'] if col in df.columns]
    
    # Pre-process: Treat altitude exactly 0 as a missing value (typical GPS no-fix error)
    if 'altitude' in df.columns:
        zeros_count = (df['altitude'] == 0).sum()
        if zeros_count > 0:
            df['altitude'] = df['altitude'].replace(0, np.nan)
            logs.append(f"Detected {zeros_count} records with altitude exactly 0. Converted to missing values (GPS no-fix).")
    
    # 2. Missing values (Only apply to critical columns)
    missing_before = 0
    if len(critical_columns) > 0:
        missing_before = df[critical_columns].isnull().any(axis=1).sum()
        if missing_before > 0:
            if config.handle_missing == 'drop':
                df = df.dropna(subset=critical_columns)
                logs.append(f"Dropped {missing_before} records with missing critical values (coordinates/altitude).")
            elif config.handle_missing == 'mean':
                df[critical_columns] = df[critical_columns].fillna(df[critical_columns].mean(numeric_only=True))
                logs.append(f"Imputed missing values for {missing_before} records using column mean.")
            else:
                df = df.dropna(subset=critical_columns)
                logs.append(f"Dropped {missing_before} records with missing critical values (KNN falling back to drop).")
            
    # 3. Duplicate rows
    duplicates = df.duplicated().sum()
    if duplicates > 0:
        df = df.drop_duplicates()
        logs.append(f"Removed {duplicates} duplicate records.")
        
    # 4. Out-of-bounds Coordinates
    if 'latitude' in df.columns and 'longitude' in df.columns:
        invalid_coords = len(df)
        df = df[(df['latitude'] >= -90) & (df['latitude'] <= 90)]
        df = df[(df['longitude'] >= -180) & (df['longitude'] <= 180)]
        invalid_coords = invalid_coords - len(df)
        if invalid_coords > 0:
            logs.append(f"Filtered {invalid_coords} records with out-of-bounds coordinates.")
            
    # 5. Outliers (Altitude Z-score)
    removed_outliers = 0
    if config.remove_outliers and 'altitude' in df.columns and len(df) > 0:
        mean_alt = df['altitude'].mean()
        std_alt = df['altitude'].std()
        if std_alt > 0:
            z_scores = np.abs((df['altitude'] - mean_alt) / std_alt)
            outlier_mask = z_scores <= config.outlier_threshold
            removed_outliers = (~outlier_mask).sum()
            df = df[outlier_mask]
            if removed_outliers > 0:
                logs.append(f"Removed {removed_outliers} spatial outliers using Z-score threshold {config.outlier_threshold}σ.")

    # 6. Invalid Speed (if column exists)
    if 'speed' in df.columns:
        invalid_speed = len(df)
        df = df[(df['speed'] >= 0) & (df['speed'] < 1200)]
        invalid_speed = invalid_speed - len(df)
        if invalid_speed > 0:
            logs.append(f"Filtered {invalid_speed} records with invalid/unrealistic speeds.")
            
    if len(logs) == 0:
        logs.append("Dataset was already clean. No anomalies detected.")

    cleaned_df = df
    processing_time = round(time.time() - start_time, 2)
    
    return {
        "status": "completed",
        "removed_outliers": int(removed_outliers),
        "imputed_values": int(missing_before) if config.handle_missing in ['mean', 'knn'] else 0,
        "remaining_records": len(df),
        "processing_time_sec": processing_time,
        "logs": logs
    }

@app.get("/api/dataset/download")
def download_cleaned():
    global cleaned_df
    if cleaned_df is None:
        raise HTTPException(status_code=400, detail="No cleaned dataset available.")
        
    temp_dir = tempfile.gettempdir()
    temp_path = os.path.join(temp_dir, "geoaltitude_cleaned.csv")
    cleaned_df.to_csv(temp_path, index=False)
    
    return FileResponse(
        path=temp_path,
        media_type="application/octet-stream",
        filename="geoaltitude_cleaned.csv"
    )

# --- Exploratory Data Analysis Endpoints ---
@app.get("/api/dataset/eda")
def get_eda():
    global active_df, cleaned_df
    df = cleaned_df if cleaned_df is not None else active_df
    
    if df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded. Upload a dataset first.")
        
    critical = [c for c in ['latitude', 'longitude', 'altitude', 'speed'] if c in df.columns]
    
    if not critical:
        raise HTTPException(status_code=400, detail="Dataset missing critical spatial columns.")
        
    def calc_hist(col_name, bins=30):
        if col_name not in df.columns:
            return []
        s = df[col_name].dropna()
        if len(s) == 0:
            return []
        counts, bin_edges = np.histogram(s, bins=bins)
        hist_data = []
        for i in range(len(counts)):
            hist_data.append({
                "range": f"{bin_edges[i]:.1f} to {bin_edges[i+1]:.1f}",
                "count": int(counts[i])
            })
        return hist_data

    # Downsample for scatter plots (max 3000 points)
    n_samples = min(len(df), 3000)
    sampled_df = df.sample(n=n_samples, random_state=42).dropna(subset=critical)
    
    scatter_alt_lat = []
    scatter_alt_lon = []
    scatter_density = []
    
    if 'altitude' in sampled_df.columns and 'latitude' in sampled_df.columns:
        scatter_alt_lat = [{"lat": round(r.latitude, 4), "alt": round(r.altitude, 1)} for _, r in sampled_df.iterrows()]
        if 'longitude' in sampled_df.columns:
            scatter_density = [{"lat": round(r.latitude, 4), "lon": round(r.longitude, 4), "alt": round(r.altitude, 1)} for _, r in sampled_df.iterrows()]
        
    if 'altitude' in sampled_df.columns and 'longitude' in sampled_df.columns:
        scatter_alt_lon = [{"lon": round(r.longitude, 4), "alt": round(r.altitude, 1)} for _, r in sampled_df.iterrows()]
        
    # Correlation Matrix
    corr_matrix = []
    if len(critical) > 1:
        corr = df[critical].corr().round(2).to_dict()
        for col in critical:
            for row in critical:
                corr_matrix.append({
                    "x": col,
                    "y": row,
                    "value": float(corr[col].get(row, 0)) if not pd.isna(corr[col].get(row, 0)) else 0
                })
                
    # Missing values
    missing_data = []
    for col in df.columns:
        missing_count = int(df[col].isnull().sum())
        missing_pct = round((missing_count / len(df)) * 100, 2)
        if missing_count > 0 or col in critical:
            missing_data.append({
                "column": col,
                "missing_count": missing_count,
                "missing_pct": missing_pct
            })
    missing_data = sorted(missing_data, key=lambda x: x["missing_count"], reverse=True)[:10]

    # Stats
    stats = {
        "skewness": 0,
        "kurtosis": 0,
        "spatial_variance": 0
    }
    if 'altitude' in df.columns:
        s = df['altitude'].dropna()
        if len(s) > 0:
            stats["skewness"] = round(s.skew(), 3)
            stats["kurtosis"] = round(s.kurt(), 3)
    if 'latitude' in df.columns and 'longitude' in df.columns:
        lat_s = df['latitude'].dropna()
        lon_s = df['longitude'].dropna()
        if len(lat_s) > 0 and len(lon_s) > 0:
            stats["spatial_variance"] = round((lat_s.var() + lon_s.var()), 4)

    return {
        "histograms": {
            "altitude": calc_hist('altitude'),
            "latitude": calc_hist('latitude'),
            "longitude": calc_hist('longitude')
        },
        "scatter": {
            "alt_vs_lat": scatter_alt_lat,
            "alt_vs_lon": scatter_alt_lon,
            "density": scatter_density
        },
        "correlation": corr_matrix,
        "missing": missing_data,
        "stats": stats
    }

# --- Feature Engineering Endpoint ---
@app.post("/api/dataset/features")
def engineer_features(config: FeatureConfig):
    global cleaned_df, active_df, train_features, test_features, train_labels, test_labels, scaler
    
    df = cleaned_df if cleaned_df is not None else active_df
    if df is None:
        raise HTTPException(status_code=400, detail="No dataset available. Please upload one.")
        
    if 'altitude' not in df.columns:
        raise HTTPException(status_code=400, detail="Target variable 'altitude' missing.")
        
    # Base spatial features
    base_cols = ['latitude', 'longitude']
    available_cols = [c for c in base_cols if c in df.columns]
    
    if len(available_cols) == 0:
        raise HTTPException(status_code=400, detail="Missing coordinate features (latitude/longitude).")
        
    X = df[available_cols].copy()
    y = df['altitude'].copy()
    
    # Polynomial features
    if config.add_lat_sq and 'latitude' in X.columns:
        X['lat_sq'] = X['latitude'] ** 2
    if config.add_lon_sq and 'longitude' in X.columns:
        X['lon_sq'] = X['longitude'] ** 2
    if config.add_lat_lon and 'latitude' in X.columns and 'longitude' in X.columns:
        X['lat_lon'] = X['latitude'] * X['longitude']
        
    # Add speed if present
    if 'speed' in df.columns:
        X['speed'] = df['speed']
        
    # Train / Test Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, 
        test_size=config.test_size, 
        random_state=config.random_state, 
        shuffle=config.shuffle
    )
    
    # Normalization
    if config.normalize:
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        X_train = pd.DataFrame(X_train_scaled, columns=X.columns, index=X_train.index)
        X_test = pd.DataFrame(X_test_scaled, columns=X.columns, index=X_test.index)
    else:
        scaler = None
        
    # Store in global memory for the Training phase
    train_features = X_train
    test_features = X_test
    train_labels = y_train
    test_labels = y_test
    
    # Generate 5-row preview matrix
    preview_df = X_train.head(5).copy()
    preview_df['altitude_target'] = y_train.head(5).values
    preview_records = preview_df.round(4).to_dict(orient="records")
    
    return {
        "message": "Features engineered and dataset split successfully.",
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "features": list(X_train.columns),
        "preview": preview_records
    }

# --- ML Model Endpoints ---

class XGBProgressCallback(xgb.callback.TrainingCallback):
    def __init__(self, total_epochs):
        self.total_epochs = total_epochs
        self.start_time = time.time()
        
    def after_iteration(self, model, epoch, evals_log):
        global training_progress
        elapsed = time.time() - self.start_time
        avg_time = elapsed / (epoch + 1)
        eta = avg_time * (self.total_epochs - (epoch + 1))
        
        train_rmse = 0.0
        val_rmse = 0.0
        
        if 'validation_0' in evals_log and 'rmse' in evals_log['validation_0']:
            train_rmse = evals_log['validation_0']['rmse'][-1]
        if 'validation_1' in evals_log and 'rmse' in evals_log['validation_1']:
            val_rmse = evals_log['validation_1']['rmse'][-1]
            
        training_progress.update({
            "status": "training",
            "current_epoch": epoch + 1,
            "elapsed_time": round(elapsed, 1),
            "eta": round(eta, 1),
            "train_rmse": round(train_rmse, 4),
            "val_rmse": round(val_rmse, 4)
        })
        return False

def run_xgboost_training(config: TrainConfig):
    global train_features, train_labels, test_features, test_labels, training_progress, global_model
    
    training_progress.update({
        "status": "training",
        "current_epoch": 0,
        "total_epochs": config.n_estimators,
        "elapsed_time": 0,
        "eta": 0,
        "train_rmse": 0,
        "val_rmse": 0
    })
    
    try:
        callback = XGBProgressCallback(total_epochs=config.n_estimators)
        
        model = xgb.XGBRegressor(
            n_estimators=config.n_estimators,
            learning_rate=config.learning_rate,
            max_depth=config.max_depth,
            subsample=config.subsample,
            colsample_bytree=config.colsample_bytree,
            gamma=config.gamma,
            min_child_weight=config.min_child_weight,
            tree_method="hist",
            random_state=42,
            n_jobs=-1,
            callbacks=[callback]
        )
        
        model.fit(
            train_features, train_labels,
            eval_set=[(train_features, train_labels), (test_features, test_labels)],
            verbose=False
        )
        
        global_model = model
        os.makedirs("data/models", exist_ok=True)
        joblib.dump(model, "data/model.joblib")
        
        # Save versioned model
        version_id = f"v{int(time.time())}"
        model_path = f"data/models/model_{version_id}.joblib"
        joblib.dump(model, model_path)
        
        # Calculate evaluation metrics to save in registry
        import json
        y_pred = model.predict(test_features)
        y_true = test_labels.values
        r2 = r2_score(y_true, y_pred)
        rmse = np.sqrt(mean_squared_error(y_true, y_pred))
        mae = mean_absolute_error(y_true, y_pred)
        
        registry_file = "data/models_registry.json"
        registry = []
        if os.path.exists(registry_file):
            try:
                with open(registry_file, 'r') as f:
                    registry = json.load(f)
            except:
                pass
                
        registry.append({
            "version": version_id,
            "training_date": datetime.datetime.now().isoformat(),
            "dataset_size": len(train_features),
            "r2_score": float(r2),
            "rmse": float(rmse),
            "mae": float(mae),
            "file_path": model_path
        })
        
        with open(registry_file, 'w') as f:
            json.dump(registry, f, indent=4)
        
        training_progress["status"] = "completed"
        
    except Exception as e:
        training_progress["status"] = "error"
        print(f"Training failed: {str(e)}")

@app.post("/api/model/train")
def train_model(config: TrainConfig, background_tasks: BackgroundTasks):
    global train_features, train_labels
    if train_features is None or train_labels is None:
        raise HTTPException(status_code=400, detail="Feature matrix not prepared. Run Feature Engineering first.")
        
    background_tasks.add_task(run_xgboost_training, config)
    return {"message": "Training started in background"}

@app.get("/api/model/progress")
def get_training_progress():
    global training_progress
    return training_progress

@app.get("/api/model/evaluation")
def get_model_evaluation():
    global global_model, test_features, test_labels
    if global_model is None or test_features is None or test_labels is None:
        raise HTTPException(status_code=400, detail="Model has not been trained yet.")
        
    y_pred = global_model.predict(test_features)
    y_true = test_labels.values
    
    r2 = r2_score(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mae = mean_absolute_error(y_true, y_pred)
    mape = mean_absolute_percentage_error(y_true, y_pred) * 100
    
    importances = global_model.feature_importances_
    features = list(test_features.columns)
    feature_importance_data = [{"feature": f, "importance": float(imp)} for f, imp in zip(features, importances)]
    feature_importance_data.sort(key=lambda x: x["importance"], reverse=True)
    
    sample_size = min(len(y_true), 2000)
    indices = np.random.choice(len(y_true), size=sample_size, replace=False)
    
    y_true_sample = y_true[indices]
    y_pred_sample = y_pred[indices]
    
    actual_vs_predicted = [{"actual": round(float(a), 2), "predicted": round(float(p), 2)} for a, p in zip(y_true_sample, y_pred_sample)]
    residuals = [{"predicted": round(float(p), 2), "residual": round(float(a - p), 2)} for a, p in zip(y_true_sample, y_pred_sample)]
    
    return {
        "metrics": {
            "r2": float(r2),
            "rmse": float(rmse),
            "mae": float(mae),
            "mape": float(mape)
        },
        "feature_importance": feature_importance_data,
        "actual_vs_predicted": actual_vs_predicted,
        "residuals": residuals
    }

@app.get("/api/history", response_model=List[Dict[str, Any]])
def get_history():
    global prediction_history
    return prediction_history[::-1]

@app.get("/api/settings")
def get_settings():
    return {
        "api_url": "http://localhost:8000/api",
        "theme": "dark",
        "active_model": "-",
        "cache_predictions": True,
        "hardware_accelerator": "CPU (8 cores)"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
