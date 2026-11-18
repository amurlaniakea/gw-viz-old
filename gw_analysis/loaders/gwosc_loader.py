from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import h5py
from astropy.units import Quantity

# Nota: En producción real, usaríamos 'ligo-gravitational-wave-open-science-center-client'
# Para este MVP científico, asumiremos que el usuario ha descargado los archivos 
# o usamos una ruta local cacheada para evitar dependencias de red frágiles en CI.

DATA_DIR = Path(os.getenv("GW_DATA_DIR", "./data/raw"))

def get_event_strain(event_id: str, detector: str = "H1") -> Optional[h5py.Dataset]:
    """
    Busca el archivo HDF5 del evento en la carpeta local.
    
    Args:
        event_id: Ejemplo 'GW150914'
        detector: 'H1', 'L1', 'V1'
        
    Returns:
        Dataset h5py con la serie temporal de strain, o None si no existe.
    """
    filename = f"{event_id}_{detector}.hdf5"
    filepath = DATA_DIR / filename
    
    if not filepath.exists():
        print(f"[WARNING] Data file missing: {filepath}")
        print("[INFO] Please download data from https://www.gwosc.org/")
        return None
        
    with h5py.File(filepath, 'r') as f:
        # La estructura interna de GWOSC varía, pero usualmente está en /strain/{detector}
        try:
            ds = f[f"/strain/{detector}"]
            return ds
        except KeyError:
            # Fallback para estructuras alternativas
            keys = list(f.keys())
            if 'strain' in keys:
                subkeys = list(f['strain'].keys())
                if detector in subkeys:
                    return f['strain'][detector]
                    
    return None

def load_full_timeseries(event_id: str, detectors: list[str] = ["H1", "L1"]) -> dict:
    """
    Carga series temporales completas para múltiples detectores.
    Retorna un diccionario {detector: array_numpy}
    """
    results = {}
    for det in detectors:
        ds = get_event_strain(event_id, det)
        if ds is not None:
            # Convertir a numpy array para procesamiento
            results[det] = ds[:] 
        else:
            results[det] = None
            
    return results
