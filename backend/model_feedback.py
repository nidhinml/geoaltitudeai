from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
import pandas as pd
import numpy as np
import os
import json
import time
import datetime
import uuid
import joblib

feedback_router = APIRouter()

FEEDBACK_CSV = "data/model_feedback.csv"
REGISTRY_JSON = "data/models_registry.json"

class FeedbackRecord(BaseModel):
    latitude: float
    longitude: float
    predicted_altitude: float
    actual_altitude: float
    model_version: str

def init_feedback_csv():
    if not os.path.exists(FEEDBACK_CSV):
        os.makedirs("data", exist_ok=True)
        df = pd.DataFrame(columns=[
            "id", "timestamp", "latitude", "longitude", 
            "predicted_altitude", "actual_altitude", 
            "prediction_error", "absolute_error", 
            "percentage_error", "model_version"
        ])
        df.to_csv(FEEDBACK_CSV, index=False)

@feedback_router.post("/api/feedback/store")
def store_feedback(record: FeedbackRecord):
    init_feedback_csv()
    
    error = record.predicted_altitude - record.actual_altitude
    abs_error = abs(error)
    perc_error = (abs_error / max(record.actual_altitude, 1)) * 100
    
    new_row = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.datetime.now().isoformat(),
        "latitude": record.latitude,
        "longitude": record.longitude,
        "predicted_altitude": record.predicted_altitude,
        "actual_altitude": record.actual_altitude,
        "prediction_error": error,
        "absolute_error": abs_error,
        "percentage_error": perc_error,
        "model_version": record.model_version
    }
    
    df = pd.DataFrame([new_row])
    df.to_csv(FEEDBACK_CSV, mode='a', header=False, index=False)
    
    return {"message": "Feedback stored successfully", "id": new_row["id"]}

@feedback_router.get("/api/feedback/dashboard")
def get_feedback_dashboard():
    if not os.path.exists(FEEDBACK_CSV):
        return {
            "total_predictions": 0,
            "success_rate": 100,
            "avg_error": 0.0,
            "max_error": 0.0,
            "min_error": 0.0,
            "health_score": "Excellent"
        }
        
    df = pd.read_csv(FEEDBACK_CSV)
    if len(df) == 0:
        return {
            "total_predictions": 0,
            "success_rate": 100,
            "avg_error": 0.0,
            "max_error": 0.0,
            "min_error": 0.0,
            "health_score": "Excellent"
        }
        
    total = len(df)
    avg_error = df["absolute_error"].mean()
    max_error = df["absolute_error"].max()
    min_error = df["absolute_error"].min()
    
    # Success rate defined as predictions with absolute error < 10m
    success_rate = (len(df[df["absolute_error"] < 10.0]) / total) * 100
    
    health = "Excellent"
    if avg_error > 15:
        health = "Needs Retraining"
    elif avg_error > 8:
        health = "Fair"
    elif avg_error > 3:
        health = "Good"
        
    return {
        "total_predictions": int(total),
        "success_rate": round(success_rate, 1),
        "avg_error": round(avg_error, 2),
        "max_error": round(max_error, 2),
        "min_error": round(min_error, 2),
        "health_score": health
    }

@feedback_router.get("/api/feedback/records")
def get_feedback_records(limit: int = 100):
    if not os.path.exists(FEEDBACK_CSV):
        return []
    df = pd.read_csv(FEEDBACK_CSV)
    df = df.sort_values(by="timestamp", ascending=False).head(limit)
    return df.to_dict(orient="records")

@feedback_router.get("/api/feedback/analytics")
def get_feedback_analytics():
    if not os.path.exists(FEEDBACK_CSV):
        return {"mae": 0, "rmse": 0, "mape": 0, "distribution": [], "terrain_errors": []}
        
    df = pd.read_csv(FEEDBACK_CSV)
    if len(df) == 0:
        return {"mae": 0, "rmse": 0, "mape": 0, "distribution": [], "terrain_errors": []}
        
    from sklearn.metrics import mean_absolute_error, mean_squared_error, mean_absolute_percentage_error
    
    y_true = df["actual_altitude"].values
    y_pred = df["predicted_altitude"].values
    
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mape = mean_absolute_percentage_error(y_true, y_pred) * 100
    
    # Error distribution
    bins = [0, 2, 5, 10, 20, 50, 1000]
    labels = ["0-2m", "2-5m", "5-10m", "10-20m", "20-50m", ">50m"]
    df['error_bin'] = pd.cut(df['absolute_error'], bins=bins, labels=labels, right=False)
    dist_counts = df['error_bin'].value_counts().to_dict()
    distribution = [{"range": k, "count": v} for k, v in dist_counts.items() if str(k) != 'nan']
    
    # Elevation Zone Errors
    bins_elev = [0, 500, 1500, 3000]
    labels_elev = ["Lowland (0-500m)", "Midland (500-1500m)", "Highland (>1500m)"]
    df['elev_zone'] = pd.cut(df['actual_altitude'], bins=bins_elev, labels=labels_elev, right=False)
    zone_errors = df.groupby('elev_zone')['absolute_error'].mean().to_dict()
    terrain_errors = [{"zone": k, "avg_error": round(v, 2) if not pd.isna(v) else 0} for k, v in zone_errors.items() if str(k) != 'nan']
    
    return {
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "mape": round(mape, 2),
        "distribution": distribution,
        "terrain_errors": terrain_errors
    }

@feedback_router.get("/api/feedback/map")
def get_feedback_map():
    if not os.path.exists(FEEDBACK_CSV):
        return []
    df = pd.read_csv(FEEDBACK_CSV)
    if len(df) == 0:
        return []
        
    # Cap at 500 points to prevent browser lag
    df = df.sort_values(by="timestamp", ascending=False).head(500)
    
    points = []
    for _, row in df.iterrows():
        err = row["absolute_error"]
        if err < 2.0:
            color = "#22c55e" # Green
            status = "Excellent"
        elif err < 5.0:
            color = "#eab308" # Yellow
            status = "Acceptable"
        elif err < 15.0:
            color = "#f97316" # Orange
            status = "Needs Improvement"
        else:
            color = "#ef4444" # Red
            status = "Poor Prediction"
            
        points.append({
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "predicted": row["predicted_altitude"],
            "actual": row["actual_altitude"],
            "error": row["absolute_error"],
            "color": color,
            "status": status,
            "timestamp": row["timestamp"]
        })
        
    return points

@feedback_router.get("/api/model/versions")
def get_model_versions():
    if not os.path.exists(REGISTRY_JSON):
        return []
    with open(REGISTRY_JSON, "r") as f:
        return json.load(f)

@feedback_router.post("/api/model/versions/activate/{version_id}")
def activate_model_version(version_id: str):
    if not os.path.exists(REGISTRY_JSON):
        raise HTTPException(status_code=404, detail="Registry not found")
        
    with open(REGISTRY_JSON, "r") as f:
        registry = json.load(f)
        
    target_model = next((m for m in registry if m["version"] == version_id), None)
    if not target_model:
        raise HTTPException(status_code=404, detail="Version not found")
        
    import main
    if os.path.exists(target_model["file_path"]):
        main.global_model = joblib.load(target_model["file_path"])
        
        # We should also copy it as the default model
        joblib.dump(main.global_model, "data/model.joblib")
        return {"message": f"Successfully activated model version {version_id}"}
    else:
        raise HTTPException(status_code=500, detail="Model file missing from disk")
