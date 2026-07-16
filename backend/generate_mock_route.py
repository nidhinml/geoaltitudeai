import pandas as pd
import numpy as np
import datetime
import math

def generate_mock_route(filename="ais140_mock_route.csv"):
    print(f"Generating mock AIS-140 GPS Route: {filename}")
    
    # Starting location (Base of a mountain, e.g., Munnar foothills)
    start_lat = 10.088
    start_lon = 77.060
    
    num_points = 500
    timestamps = [datetime.datetime.now() - datetime.timedelta(seconds=x*30) for x in range(num_points)]
    timestamps.reverse()
    
    lats = [start_lat]
    lons = [start_lon]
    speeds = [0.0]
    
    # Simulate a winding uphill drive
    current_lat = start_lat
    current_lon = start_lon
    
    for i in range(1, num_points):
        # Add small random increments to simulate driving north-east
        d_lat = 0.0001 * (1 + np.random.normal(0, 0.2))
        d_lon = 0.0001 * (1 + np.random.normal(0, 0.2))
        
        current_lat += d_lat
        current_lon += d_lon
        
        lats.append(current_lat)
        lons.append(current_lon)
        
        # Speed logic (slow on steep hills, faster on straight, some stops)
        if i % 100 == 0:
            speed = 0.0  # Traffic / Rest stop
        else:
            speed = np.random.uniform(20.0, 60.0)
            
        speeds.append(speed)
        
    df = pd.DataFrame({
        "timestamp": timestamps,
        "latitude": lats,
        "longitude": lons,
        "speed": speeds
    })
    
    df.to_csv(filename, index=False)
    print(f"Successfully generated {num_points} points.")

if __name__ == "__main__":
    generate_mock_route()
