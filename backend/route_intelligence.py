from fastapi import APIRouter, HTTPException, UploadFile, File, Form
import pandas as pd
import numpy as np
import io
import math

route_router = APIRouter(prefix="/api/routes", tags=["routes"])

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000  # radius of Earth in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

@route_router.post("/analyze")
async def analyze_route(
    file: UploadFile = File(...),
    vehicle_category: str = Form("truck"),
    fuel_type: str = Form("diesel"),
    mileage: float = Form(3.0)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    try:
        df = pd.read_csv(io.StringIO(content.decode('utf-8')))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read CSV: {str(e)}")

    # Ensure required columns exist
    required_cols = ['latitude', 'longitude', 'speed', 'timestamp']
    for col in required_cols:
        if col not in df.columns:
            raise HTTPException(status_code=400, detail=f"Missing required column: {col}")

    # Force numeric types to prevent NaN serialization errors
    df['latitude'] = pd.to_numeric(df['latitude'], errors='coerce')
    df['longitude'] = pd.to_numeric(df['longitude'], errors='coerce')
    df['speed'] = pd.to_numeric(df['speed'], errors='coerce').fillna(0.0)

    # Drop nulls
    df = df.dropna(subset=['latitude', 'longitude'])

    if len(df) < 2:
        raise HTTPException(status_code=400, detail="Route must have at least 2 valid coordinate points")

    import main
    model = main.global_model
    if model is None:
        raise HTTPException(status_code=400, detail="AI Model not trained. Please train the model first.")

    # Sort by timestamp
    try:
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values(by='timestamp').reset_index(drop=True)
    except:
        pass

    # Feature engineering for AI
    features_df = pd.DataFrame()
    features_df['latitude'] = df['latitude']
    features_df['longitude'] = df['longitude']
    
    if main.train_features is not None:
        if 'lat_sq' in main.train_features.columns:
            features_df['lat_sq'] = features_df['latitude'] ** 2
        if 'lon_sq' in main.train_features.columns:
            features_df['lon_sq'] = features_df['longitude'] ** 2
        if 'lat_lon' in main.train_features.columns:
            features_df['lat_lon'] = features_df['latitude'] * features_df['longitude']
        if 'speed' in main.train_features.columns:
            features_df['speed'] = df['speed']
            
        # Ensure all columns match exactly
        missing = set(main.train_features.columns) - set(features_df.columns)
        for col in missing:
            features_df[col] = 0.0
            
        features_df = features_df[main.train_features.columns]

    # Standardize
    try:
        X = main.scaler.transform(features_df)
    except:
        X = features_df.values

    # Predict
    predicted_altitudes = model.predict(X)
    df['altitude'] = predicted_altitudes

    # Calculate distances and gradients
    distances = [0.0]
    cumulative_distance = [0.0]
    gradients = [0.0]
    
    for i in range(1, len(df)):
        lat1, lon1 = df.iloc[i-1]['latitude'], df.iloc[i-1]['longitude']
        lat2, lon2 = df.iloc[i]['latitude'], df.iloc[i]['longitude']
        alt1 = df.iloc[i-1]['altitude']
        alt2 = df.iloc[i]['altitude']
        
        dist = haversine_distance(lat1, lon1, lat2, lon2)
        distances.append(dist)
        cumulative_distance.append(cumulative_distance[-1] + dist)
        
        if dist > 0:
            grad = ((alt2 - alt1) / dist) * 100
            # Cap gradient to realistic bounds (-45% to 45%)
            grad = max(min(grad, 45.0), -45.0)
            gradients.append(grad)
        else:
            gradients.append(0.0)

    df['distance_segment_m'] = distances
    df['cumulative_distance_m'] = cumulative_distance
    df['gradient_pct'] = gradients

    # Aggregated Stats
    total_distance_m = cumulative_distance[-1]
    total_distance_km = total_distance_m / 1000.0
    
    avg_speed = df['speed'].mean()
    max_speed = df['speed'].max()
    stops = len(df[df['speed'] < 2.0]) # Count points where speed is near 0
    
    min_alt = df['altitude'].min()
    max_alt = df['altitude'].max()
    avg_alt = df['altitude'].mean()
    
    alt_diffs = np.diff(df['altitude'])
    elevation_gain = np.sum(alt_diffs[alt_diffs > 0])
    elevation_loss = abs(np.sum(alt_diffs[alt_diffs < 0]))
    
    max_gradient = df['gradient_pct'].max()
    avg_gradient = df['gradient_pct'].abs().mean()
    
    # Physics estimations based on dynamic inputs
    # Base km per unit (Liters for petrol/diesel, kWh for EV)
    if mileage <= 0:
        mileage = 3.0 # Fallback
    
    base_unit_per_km = 1.0 / mileage
    
    # Climbing penalty multiplier based on vehicle weight/category
    # Trucks suffer heavily, cars moderately, bikes barely
    penalty_multipliers = {
        "truck": 0.1,
        "bus": 0.08,
        "car": 0.03,
        "bike": 0.01
    }
    multiplier = penalty_multipliers.get(vehicle_category.lower(), 0.1)
    
    # Base climb penalty
    climb_penalty = (elevation_gain / 10.0) * multiplier
    
    if fuel_type.lower() == 'ev':
        # EV specific logic
        estimated_fuel_l = 0.0
        # Regen braking recovery (approx 30% of loss for EV)
        ev_regen_recovery = (elevation_loss / 10.0) * multiplier * 0.3
        estimated_battery_kwh = (total_distance_km * base_unit_per_km) + climb_penalty - ev_regen_recovery
        estimated_battery_kwh = max(estimated_battery_kwh, 0)
    else:
        # Petrol / Diesel logic
        estimated_battery_kwh = 0.0
        estimated_fuel_l = (total_distance_km * base_unit_per_km) + climb_penalty
    
    # TDI (Travel Difficulty Index 1-10)
    tdi = min(10, max(1, (avg_gradient * 0.5) + (elevation_gain / 1000) * 2 + (max_gradient * 0.1)))
    
    # Road Category
    if avg_gradient > 8:
        road_category = "Severe Mountain Pass"
    elif avg_gradient > 4:
        road_category = "Hilly / Ghat Road"
    elif avg_gradient > 1.5:
        road_category = "Rolling Terrain"
    else:
        road_category = "Flat Highway"

    # Profile Data for Charts
    # Downsample for UI performance if needed, but 1000 points is fine for Recharts
    chart_data = []
    downsample_step = max(1, len(df) // 500)
    
    for i in range(0, len(df), downsample_step):
        row = df.iloc[i]
        chart_data.append({
            "latitude": float(row['latitude']),
            "longitude": float(row['longitude']),
            "altitude": float(row['altitude']),
            "distance_km": float(row['cumulative_distance_m'] / 1000.0),
            "speed": float(row['speed']),
            "gradient": float(row['gradient_pct'])
        })

    # Prepare timeline (Start, Max Alt, Stops > 5 mins, End)
    timeline = []
    timeline.append({"event": "Trip Started", "distance_km": 0.0, "altitude": float(df.iloc[0]['altitude']), "time": str(df.iloc[0]['timestamp'])})
    
    max_idx = int(df['altitude'].argmax())
    timeline.append({"event": "Highest Point Reached", "distance_km": float(df.iloc[max_idx]['cumulative_distance_m']/1000), "altitude": float(df.iloc[max_idx]['altitude']), "time": str(df.iloc[max_idx]['timestamp'])})
    
    timeline.append({"event": "Trip Completed", "distance_km": round(total_distance_km, 2), "altitude": float(df.iloc[-1]['altitude']), "time": str(df.iloc[-1]['timestamp'])})
    
    timeline = sorted(timeline, key=lambda x: x["distance_km"])

    return {
        "stats": {
            "total_distance_km": float(round(total_distance_km, 2)),
            "avg_speed_kmh": float(round(avg_speed, 1)),
            "max_speed_kmh": float(round(max_speed, 1)),
            "total_stops": int(stops),
            "min_altitude_m": float(round(min_alt, 1)),
            "max_altitude_m": float(round(max_alt, 1)),
            "avg_altitude_m": float(round(avg_alt, 1)),
            "elevation_gain_m": float(round(elevation_gain, 1)),
            "elevation_loss_m": float(round(elevation_loss, 1)),
            "max_gradient_pct": float(round(max_gradient, 1)),
            "avg_gradient_pct": float(round(avg_gradient, 1)),
            "estimated_fuel_l": float(round(estimated_fuel_l, 1)),
            "estimated_battery_kwh": float(round(estimated_battery_kwh, 2)),
            "tdi": float(round(tdi, 1)),
            "road_category": road_category
        },
        "config": {
            "vehicle_category": vehicle_category,
            "fuel_type": fuel_type,
            "mileage": mileage
        },
        "chart_data": chart_data,
        "timeline": timeline,
        "raw_path": [{"lat": float(r['latitude']), "lon": float(r['longitude'])} for i, r in df.iterrows() if i % downsample_step == 0]
    }
