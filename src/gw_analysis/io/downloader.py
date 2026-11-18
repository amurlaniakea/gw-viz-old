from __future__ import annotations
import os
from pathlib import Path
import numpy as np
from gwpy.timeseries import TimeSeries

DATA_DIR = Path(os.getenv("GW_DATA_DIR", "./data/raw"))

# Tiempos GPS centrales conocidos (segundos GPS)
# Estos valores son públicos y verificables en el catálogo GWOSC
KNOWN_EVENTS_GPS = {
    "GW150914": 1126259462,
    "GW170817": 1187008882,
    "GW190521": 1242442967,
}

def get_event_gps(event_id: str) -> int:
    if event_id in KNOWN_EVENTS_GPS:
        return KNOWN_EVENTS_GPS[event_id]
    raise ValueError(f"Event {event_id} not found in known list.")

def download_event_strain(event_id: str, detector: str = "H1") -> Path:
    """
    Descarga el strain usando gwpy.TimeSeries.fetch_open_data con rangos GPS explícitos.
    Esta es la forma canónica recomendada por LIGO/Virgo para Python.
    """
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    filename = f"{event_id}_{detector}.hdf5"
    dest_path = DATA_DIR / filename
    
    if dest_path.exists():
        print(f"✅ File exists locally: {dest_path}")
        return dest_path
        
    print(f"📥 Fetching open data for {event_id} ({detector}) via gwpy...")
    
    try:
        # 1. Obtener tiempo central
        gps_center = get_event_gps(event_id)
        
        # 2. Definir rango amplio (+/- 30s) para asegurar cobertura completa del chirp
        start_time = gps_center - 30
        end_time = gps_center + 30
        
        print(f"   Target GPS Range: [{start_time}, {end_time}]")
        
        # 3. Llamar a fetch_open_data con la firma CORRECTA para gwpy 4.x
        # Argumentos posicionales: ifos, start, end
        ts = TimeSeries.fetch_open_data(
            detector,       # ifos
            start_time,     # start
            end_time,       # end
            verbose=True
        )
        
        if ts is None or len(ts) == 0:
            raise ValueError(f"No data returned for {event_id} {detector}")
            
        print(f"   Retrieved {len(ts)} samples.")
        
        # 4. Guardar localmente en formato HDF5 estándar de gwpy
        ts.write(dest_path, format='hdf5')
        
        print(f"✅ Cached to: {dest_path}")
        return dest_path
        
    except Exception as e:
        raise FileNotFoundError(f"Fetch failed via gwpy.open_data: {e}")

def load_hdf5_strain(path: Path) -> tuple[np.ndarray, np.ndarray]:
    """
    Carga datos desde el HDF5 guardado por gwpy.
    Retorna (tiempos_relativos_s, strains_dimensionless).
    """
    # Leer directamente con gwpy para garantizar compatibilidad perfecta
    ts = TimeSeries.read(path, format='hdf5')
    
    # Extraer tiempos relativos al inicio de la ventana (para graficar mejor)
    t_start = ts.times[0].value
    times_relative = ts.times.value - t_start
    
    strain = ts.value       # Strain adimensional
    
    return times_relative.astype(float), strain.astype(float)
