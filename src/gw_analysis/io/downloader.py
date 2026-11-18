from __future__ import annotations
import os
import requests
from pathlib import Path
import numpy as np
import h5py
from gwosc.locate import get_urls

DATA_DIR = Path(os.getenv("GW_DATA_DIR", "./data/raw"))

# Tiempos GPS centrales verificados (Catálogo GWTC-1/2/3)
KNOWN_EVENTS_GPS = {
    "GW150914": 1126259462,
    "GW170817": 1187008882,
    "GW190521": 1242442967,
}

def download_event_strain(event_id: str, detector: str = "H1") -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{event_id}_{detector}.hdf5"
    dest_path = DATA_DIR / filename
    
    if dest_path.exists():
        print(f"✅ Cache hit: {dest_path}")
        return dest_path
        
    print(f"📥 Resolving {event_id} ({detector}) via GWOSC API...")
    
    try:
        gps_center = KNOWN_EVENTS_GPS.get(event_id)
        if not gps_center:
            raise ValueError(f"Event {event_id} not in known list.")
            
        # Rango +/- 32 segundos (cobertura estándar O1/O2)
        start_gps = gps_center - 32
        end_gps = gps_center + 32
        
        # Firma correcta para gwosc 0.8.3: get_urls(detector, start, end, ...)
        urls = get_urls(detector, start_gps, end_gps, format="hdf5")
        
        if not urls:
            raise ValueError("No URLs returned by GWOSC.")
            
        # Tomar la primera URL válida
        target_url = urls[0] if isinstance(urls[0], str) else urls[0].get("url", urls[0])
        print(f"   URL: {target_url}")
        
        response = requests.get(target_url, stream=True, timeout=60)
        response.raise_for_status()
        
        with open(dest_path, "wb") as f:
            for chunk in response.iter_content(8192):
                f.write(chunk)
                
        print(f"✅ Saved: {dest_path}")
        return dest_path
        
    except Exception as e:
        raise RuntimeError(f"Download failed: {e}")

def load_hdf5_strain(path: Path) -> tuple[np.ndarray, np.ndarray]:
    with h5py.File(path, "r") as f:
        # Buscar dataset de strain recursivamente
        def find_ds(group):
            for k, v in group.items():
                if isinstance(v, h5py.Dataset) and "strain" in k.lower():
                    return v[:]
                elif isinstance(v, h5py.Group):
                    res = find_ds(v)
                    if res is not None: return res
            return None
            
        strain_data = find_ds(f)
        if strain_data is None:
            raise ValueError("No strain data found in HDF5.")
            
        # Inferir tiempos (fs=4096 Hz estándar LIGO)
        fs = 4096.0
        times = np.arange(len(strain_data)) / fs
        
    return times.astype(float), strain_data.astype(float)
