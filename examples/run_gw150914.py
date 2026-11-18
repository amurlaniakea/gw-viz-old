#!/usr/bin/env python3
"""
Ejemplo de uso: Análisis científico de GW150914.
Requiere que los datos HDF5 estén en ./data/raw/GW150914_H1.hdf5
Descárgalos desde: https://www.gwosc.org/event/GW150914
"""

import sys
from pathlib import Path
import numpy as np

# Añadir raíz del proyecto al path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from gw_analysis.loaders.gwosc_loader import load_full_timeseries
from gw_analysis.processing.snr_calculator import calculate_matched_filter_snr, extract_chirp_features
from gw_analysis.viz.plots import plot_strain_and_spectrum

def main():
    EVENT_ID = "GW150914"
    DETECTOR = "H1"
    FS = 4096.0 # Hz típico de LIGO O1/O2
    
    print(f"🔍 Loading data for {EVENT_ID} ({DETECTOR})...")
    data_dict = load_full_timeseries(EVENT_ID, detectors=[DETECTOR])
    
    strain_h1 = data_dict.get(DETECTOR)
    
    if strain_h1 is None:
        print("❌ Error: No se encontraron datos. Asegúrate de descargar el archivo HDF5 de GWOSC.")
        print("   Ruta esperada: ./data/raw/GW150914_H1.hdf5")
        return

    print(f"📊 Processing Signal (Length: {len(strain_h1)} samples)...")
    
    # 1. Calcular SNR
    snr = calculate_matched_filter_snr(strain_h1, FS)
    print(f"   Estimated SNR: {snr:.2f}")
    
    # 2. Extraer características de Chirp
    features = extract_chirp_features(strain_h1, FS)
    print(f"   Max Instantaneous Frequency: {features['max_freq_hz']:.1f} Hz")
    print(f"   Peak Amplitude: {features['peak_amp']:.2e}")
    
    # 3. Generar Plot Científico
    print("🎨 Generating publication-quality plot...")
    plot_strain_and_spectrum(strain_h1, FS, EVENT_ID)
    
    print("\n✨ Analysis Complete.")

if __name__ == "__main__":
    main()
