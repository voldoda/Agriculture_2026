import os
import json
import math
import shapefile
import pyproj

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    sample_dir = os.path.join(base_dir, "01_Sample")
    output_dir = os.path.join(base_dir, "src", "data")
    os.makedirs(output_dir, exist_ok=True)
    
    # Coordinate Transformer: EPSG:5179 (UTM-K) to EPSG:4326 (WGS84)
    transformer = pyproj.Transformer.from_crs("EPSG:5179", "EPSG:4326", always_xy=True)
    
    dx = 49.97566566732752
    dy = 49.97566566732752
    
    # Step = 2 gives ~28,000 fine-resolution contiguous interlocking square cells
    step = 2
    half_w = (dx * step) / 2.0
    half_h = (dy * step) / 2.0
    
    # Read month 5 as base structure
    shp_05 = os.path.join(sample_dir, "Head_05.shp")
    sf05 = shapefile.Reader(shp_05)
    
    grid_dict = {}
    
    print(f"Streaming Head_05 with step={step} for seamless 100% interlocking polygon mesh...")
    for s, r in zip(sf05.iterShapes(), sf05.iterRecords()):
        row = r["ROW"]
        col = r["COLUMN"]
        head = r["HEAD"]
        if head < 1e+29 and row % step == 0 and col % step == 0:
            x, y = s.points[0]
            
            # Center Lon/Lat
            lon, lat = transformer.transform(x, y)
            
            # 4 shared corners in UTM-K transformed to WGS84 for zero gap and zero overlap
            # NW -> NE -> SE -> SW
            lon_nw, lat_nw = transformer.transform(x - half_w, y + half_h)
            lon_ne, lat_ne = transformer.transform(x + half_w, y + half_h)
            lon_se, lat_se = transformer.transform(x + half_w, y - half_h)
            lon_sw, lat_sw = transformer.transform(x - half_w, y - half_h)
            
            cell_id = f"R{row}_C{col}"
            grid_dict[cell_id] = {
                "id": f"YG-{cell_id}",
                "row": row,
                "col": col,
                "x": round(x, 1),
                "y": round(y, 1),
                "lat": round(lat, 6),
                "lon": round(lon, 6),
                "polygon": [
                    [round(lat_nw, 6), round(lon_nw, 6)],
                    [round(lat_ne, 6), round(lon_ne, 6)],
                    [round(lat_se, 6), round(lon_se, 6)],
                    [round(lat_sw, 6), round(lon_sw, 6)]
                ],
                "heads": {"05": round(head, 2)}
            }
            
    print(f"Extracted {len(grid_dict)} interlocking square grid cells.")
    
    # Stream other months
    for m in ["06", "07", "08", "09"]:
        shp_m = os.path.join(sample_dir, f"Head_{m}.shp")
        if not os.path.exists(shp_m):
            continue
        print(f"Streaming Head_{m}...")
        sf_m = shapefile.Reader(shp_m)
        for r in sf_m.iterRecords():
            row = r["ROW"]
            col = r["COLUMN"]
            head = r["HEAD"]
            if row % step == 0 and col % step == 0:
                cell_id = f"R{row}_C{col}"
                if cell_id in grid_dict:
                    if head < 1e+29:
                        grid_dict[cell_id]["heads"][m] = round(head, 2)
                    else:
                        grid_dict[cell_id]["heads"][m] = grid_dict[cell_id]["heads"]["05"]

    final_grids = []
    anomalies = []
    
    all_lats = [g["lat"] for g in grid_dict.values()]
    all_lons = [g["lon"] for g in grid_dict.values()]
    min_lat, max_lat = min(all_lats), max(all_lats)
    min_lon, max_lon = min(all_lons), max(all_lons)
    
    for g in grid_dict.values():
        h05 = g["heads"].get("05", 50.0)
        h06 = g["heads"].get("06", h05 + 10.0)
        h07 = g["heads"].get("07", h05 + 30.0)
        h08 = g["heads"].get("08", h05 + 28.0)
        h09 = g["heads"].get("09", h05 + 14.0)
        
        full_heads = {
            "01": round(h05 - 4.5, 2),
            "02": round(h05 - 5.2, 2),
            "03": round(h05 - 3.1, 2),
            "04": round(h05 - 1.5, 2),
            "05": round(h05, 2),
            "06": round(h06, 2),
            "07": round(h07, 2),
            "08": round(h08, 2),
            "09": round(h09, 2),
            "10": round(h09 - 11.0, 2),
            "11": round(h09 - 16.5, 2),
            "12": round(h09 - 20.0, 2),
        }
        
        # Natural topography: valley bottoms have shallow depth to water, mountain ridges have deep water table
        slope_factor = max(0.0, (h05 - 30.0) / 220.0)
        surface_el = h05 + 1.2 + (slope_factor ** 1.3) * 48.0
        depth_08 = max(0.5, surface_el - h08)
        
        # Risk is high along low-lying river corridors and confluences (depth < 3m), low in mountains
        if depth_08 <= 1.5:
            vuln_score = round(min(0.96, 0.82 + (1.5 - depth_08) * 0.12), 2)
        elif depth_08 <= 4.0:
            vuln_score = round(0.55 + (4.0 - depth_08) * 0.10, 2)
        elif depth_08 <= 8.0:
            vuln_score = round(0.32 + (8.0 - depth_08) * 0.05, 2)
        else:
            vuln_score = round(max(0.05, 0.28 - (depth_08 - 8.0) * 0.015), 2)
            
        delta_season = round(h08 - h05, 2)
        rate_of_change = round(h07 - h06, 2)
        
        grid_item = {
            "id": g["id"],
            "row": g["row"],
            "col": g["col"],
            "x": g["x"],
            "y": g["y"],
            "lat": g["lat"],
            "lon": g["lon"],
            "polygon": g["polygon"],
            "surfaceEl": round(surface_el, 1),
            "heads": full_heads,
            "vulnScore": vuln_score,
            "deltaSeason": delta_season,
            "soilType": "충적층 (모래/자갈)" if vuln_score > 0.6 else ("풍화토층" if vuln_score > 0.35 else "기반암 대수층")
        }
        final_grids.append(grid_item)
        
        if rate_of_change > 40.0 or delta_season > 55.0:
            anomalies.append({
                "id": grid_item["id"],
                "lat": grid_item["lat"],
                "lon": grid_item["lon"],
                "row": grid_item["row"],
                "col": grid_item["col"],
                "currentHead": full_heads["08"],
                "delta": rate_of_change,
                "type": "SURGE" if rate_of_change > 0 else "DROP",
                "severity": "CRITICAL" if rate_of_change > 50 else "WARNING",
                "description": f"급격한 수위 상승 (+{rate_of_change}m/월) - 저지대 침수 및 관망 배수역류 위험" if rate_of_change > 0 else f"수위 급강하 ({rate_of_change}m/월) - 갈수기 취수 장애 경보"
            })
            
    drainage_polygons = [
        {
            "id": "VULN-ZONE-01",
            "name": "유구천 하류 합류부 저지대 배수지연구역",
            "riskLevel": "HIGH",
            "area_ha": 142.5,
            "coordinates": [
                [126.960, 36.485],
                [126.985, 36.490],
                [127.010, 36.475],
                [127.025, 36.495],
                [127.005, 36.520],
                [126.970, 36.515],
                [126.955, 36.495],
                [126.960, 36.485]
            ]
        },
        {
            "id": "VULN-ZONE-02",
            "name": "유구읍 도심부 내수침수 취약지구",
            "riskLevel": "CRITICAL",
            "area_ha": 86.2,
            "coordinates": [
                [126.915, 36.535],
                [126.940, 36.540],
                [126.950, 36.565],
                [126.935, 36.575],
                [126.905, 36.560],
                [126.915, 36.535]
            ]
        },
        {
            "id": "VULN-ZONE-03",
            "name": "신풍천 지류 농경지 자연배수 불량구역",
            "riskLevel": "MODERATE",
            "area_ha": 118.0,
            "coordinates": [
                [126.990, 36.550],
                [127.040, 36.560],
                [127.060, 36.590],
                [127.025, 36.605],
                [126.980, 36.580],
                [126.990, 36.550]
            ]
        }
    ]
    
    contour_lines = []
    contour_levels = [40, 60, 80, 100, 120, 150, 200]
    t_lat_center = (min_lat + max_lat) / 2
    t_lon_center = (min_lon + max_lon) / 2
    for lvl in contour_levels:
        radius_x = 0.025 + (lvl / 300.0) * 0.065
        radius_y = 0.02 + (lvl / 300.0) * 0.075
        
        pts1 = []
        pts2 = []
        for deg in range(10, 175, 15):
            rad = math.radians(deg)
            noise = math.sin(rad * 3) * 0.007
            lon = t_lon_center + (radius_x + noise) * math.cos(rad)
            lat = t_lat_center - 0.015 + (radius_y + noise) * math.sin(rad)
            if min_lon <= lon <= max_lon and min_lat <= lat <= max_lat:
                pts1.append([round(lon, 5), round(lat, 5)])
                
        for deg in range(190, 350, 15):
            rad = math.radians(deg)
            noise = math.cos(rad * 4) * 0.005
            lon = t_lon_center + (radius_x * 0.85 + noise) * math.cos(rad)
            lat = t_lat_center + 0.025 + (radius_y * 0.85 + noise) * math.sin(rad)
            if min_lon <= lon <= max_lon and min_lat <= lat <= max_lat:
                pts2.append([round(lon, 5), round(lat, 5)])
                
        if len(pts1) > 2:
            contour_lines.append({"elevation": lvl, "coordinates": pts1})
        if len(pts2) > 2:
            contour_lines.append({"elevation": lvl, "coordinates": pts2})
            
    observation_wells = [
        {"id": "OW-01", "name": "유구1호 관측정 (도심)", "lat": 36.5452, "lon": 126.9285, "depth": 45.0, "aquifer": "충적층", "telemetry": "ONLINE"},
        {"id": "OW-02", "name": "신풍2호 관측정 (농업)", "lat": 36.5710, "lon": 127.0120, "depth": 60.0, "aquifer": "암반층", "telemetry": "ONLINE"},
        {"id": "OW-03", "name": "만수3호 관측정 (상류)", "lat": 36.6320, "lon": 126.9550, "depth": 50.0, "aquifer": "풍화암", "telemetry": "ONLINE"},
        {"id": "OW-04", "name": "하류4호 관측정 (하천변)", "lat": 36.4820, "lon": 126.9950, "depth": 35.0, "aquifer": "충적모래", "telemetry": "ONLINE"},
        {"id": "OW-05", "name": "동교5호 관측정 (배수지)", "lat": 36.5180, "lon": 127.0520, "depth": 55.0, "aquifer": "암반대수층", "telemetry": "ONLINE"},
    ]

    dataset = {
        "metadata": {
            "watershedName": "충남 공주시 유구천 표준유역",
            "watershedCode": "301206",
            "modelEngine": "USGS MODFLOW-6 Steady-State",
            "gridSize": "50m × 50m",
            "sourceCellSizeM": dx,
            "displayCellSizeM": dx * step,
            "samplingStep": step,
            "year": None,
            "dataStatus": "prototype_with_synthetic_examples",
            "syntheticMonths": ["01", "02", "03", "04", "10", "11", "12"],
            "syntheticLayers": ["surfaceEl", "soilType", "contourLines", "drainagePolygons", "observationWells"],
            "totalCells": 235935,
            "activeCells": 113076,
            "sampledNodes": len(final_grids),
            "calibratedMonths": ["05", "06", "07", "08", "09"],
            "crs": "EPSG:5179 (Korea 2000 / UTM-K)",
            "bounds": {
                "minLat": round(min_lat, 4),
                "maxLat": round(max_lat, 4),
                "minLon": round(min_lon, 4),
                "maxLon": round(max_lon, 4),
                "center": [round((min_lat + max_lat) / 2, 4), round((min_lon + max_lon) / 2, 4)]
            }
        },
        "grids": final_grids,
        "contourLines": contour_lines,
        "drainagePolygons": drainage_polygons,
        "observationWells": observation_wells,
        "anomalies": anomalies[:10]
    }
    
    out_file = os.path.join(output_dir, "groundwater_data.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False)
    print(f"Successfully generated {out_file} with {len(final_grids)} interlocking polygons, size: {os.path.getsize(out_file)} bytes")

if __name__ == "__main__":
    main()
