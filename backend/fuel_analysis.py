from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any
import numpy as np
import pandas as pd
import math

fuel_router = APIRouter(prefix="/api/fuel", tags=["fuel"])

class GPSPoint(BaseModel):
    latitude: float
    longitude: float

class FuelEstimateRequest(BaseModel):
    route: List[GPSPoint]

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000  # radius of Earth in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

@fuel_router.post("/estimate")
def estimate_fuel_efficiency(req: FuelEstimateRequest):
    import main
    from fastapi.responses import JSONResponse
    model = main.global_model
    scaler = main.scaler
    
    if model is None:
        return JSONResponse(
            status_code=400, 
            content={"detail": "Model not trained yet. Please train the model first."},
            headers={"Access-Control-Allow-Origin": "*"}
        )
        
    if len(req.route) < 2:
        return JSONResponse(
            status_code=400, 
            content={"detail": "Route must contain at least 2 points."},
            headers={"Access-Control-Allow-Origin": "*"}
        )
        
    # Prepare features for prediction
    df = pd.DataFrame([{"latitude": p.latitude, "longitude": p.longitude} for p in req.route])
    
    # Apply polynomial features if they were used during training
    if main.train_features is not None:
        if 'lat_sq' in main.train_features.columns:
            df['lat_sq'] = df['latitude'] ** 2
        if 'lon_sq' in main.train_features.columns:
            df['lon_sq'] = df['longitude'] ** 2
        if 'lat_lon' in main.train_features.columns:
            df['lat_lon'] = df['latitude'] * df['longitude']
            
        # Ensure all training columns exist in df to prevent KeyErrors
        for col in main.train_features.columns:
            if col not in df.columns:
                df[col] = 0.0
                
        # Reorder columns to exactly match training order
        df = df[main.train_features.columns]
    
    # Scale and predict
    if scaler is not None:
        features_scaled = scaler.transform(df)
    else:
        features_scaled = df
        
    altitudes = model.predict(features_scaled)
    
    results = []
    total_gain = 0.0
    total_loss = 0.0
    
    for i in range(len(req.route)):
        current_lat = req.route[i].latitude
        current_lon = req.route[i].longitude
        current_alt = float(altitudes[i])
        
        if i == 0:
            results.append({
                "latitude": current_lat,
                "longitude": current_lon,
                "altitude": current_alt,
                "prev_altitude": current_alt,
                "alt_diff": 0.0,
                "distance_m": 0.0,
                "gradient_pct": 0.0,
                "category": "Flat Road",
                "fuel_impact": 0.0,
                "difficulty": 0.0
            })
            continue
            
        # Find a stable previous point at least 150m away for gradient calculation
        prev_idx = i - 1
        dist_stable_m = 0
        while prev_idx >= 0:
            dist_stable_m = haversine_distance(req.route[prev_idx].latitude, req.route[prev_idx].longitude, current_lat, current_lon)
            if dist_stable_m > 150.0 or prev_idx == 0:
                break
            prev_idx -= 1
            
        stable_alt = float(altitudes[prev_idx])
        
        # Immediate previous for strict tracking
        prev_lat = req.route[i-1].latitude
        prev_lon = req.route[i-1].longitude
        prev_alt = float(altitudes[i-1])
        
        dist_m = haversine_distance(prev_lat, prev_lon, current_lat, current_lon)
        if dist_m < 0.1:
            dist_m = 0.1 # prevent division by zero
            
        alt_diff = current_alt - prev_alt
        
        if alt_diff > 0:
            total_gain += alt_diff
        else:
            total_loss += abs(alt_diff)
            
        stable_alt_diff = current_alt - stable_alt
        if dist_stable_m > 0.1:
            gradient_pct = (stable_alt_diff / dist_stable_m) * 100.0
        else:
            gradient_pct = 0.0
        
        # Categorize
        if gradient_pct > 8.0:
            category = "Steep Uphill"
            impact = 2.5 * gradient_pct
            diff = 0.9
        elif gradient_pct > 3.0:
            category = "Moderate Uphill"
            impact = 1.5 * gradient_pct
            diff = 0.6
        elif gradient_pct > 1.0:
            category = "Gentle Uphill"
            impact = 0.8 * gradient_pct
            diff = 0.3
        elif gradient_pct < -8.0:
            category = "Steep Downhill"
            impact = -1.0 * abs(gradient_pct) # Regen / braking
            diff = 0.8
        elif gradient_pct < -3.0:
            category = "Gentle Downhill"
            impact = -0.5 * abs(gradient_pct)
            diff = 0.4
        else:
            category = "Flat Road"
            impact = 0.0
            diff = 0.1
            
        # Smooth out extremes
        impact = min(max(impact, -15.0), 30.0)
            
        results.append({
            "latitude": current_lat,
            "longitude": current_lon,
            "altitude": current_alt,
            "prev_altitude": prev_alt,
            "alt_diff": alt_diff,
            "distance_m": dist_m,
            "gradient_pct": gradient_pct,
            "category": category,
            "fuel_impact": impact,
            "difficulty": diff
        })
        
    return {
        "route_analysis": results,
        "summary": {
            "total_distance_m": sum([r["distance_m"] for r in results]),
            "total_elevation_gain": total_gain,
            "total_elevation_loss": total_loss,
            "max_gradient": max([r["gradient_pct"] for r in results]),
            "avg_gradient": np.mean([abs(r["gradient_pct"]) for r in results]),
            "max_climb": max([r["alt_diff"] for r in results]),
            "max_descent": min([r["alt_diff"] for r in results]),
            "avg_fuel_impact": np.mean([r["fuel_impact"] for r in results])
        }
    }
