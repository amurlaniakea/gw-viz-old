from __future__ import annotations

import numpy as np
from gwpy.timeseries import TimeSeries
from gwpy.frequencyseries import FrequencySeries

def calculate_matched_filter_snr(
    strain_data: np.ndarray, 
    sampling_rate: float, 
    template_bank_path: str | None = None
) -> float:
    """
    Calcula el SNR óptimo utilizando técnicas de filtrado adaptado (matched filtering).
    
    En un entorno académico real, esto implicaría cruzar la señal con un banco 
    de plantillas teóricas (TaylorF2, PhenomD, etc.).
    
    Para este ejemplo educativo, demostramos la extracción de SNR básico 
    contra ruido blanco gaussiano estimado localmente.
    """
    ts = TimeSeries(strain_data, sample_rate=sampling_rate)
    
    # Estimar PSD (Power Spectral Density) usando Welch's method
    # Esto es crucial para entender qué frecuencias dominan el ruido
    psd = ts.psd(segmentlength=int(sampling_rate * 4)) # Segmentos de 4 segundos
    
    # Calcular SNR integral sobre banda sensible (ej. 20Hz - 2kHz)
    low_freq = 20
    high_freq = 2000
    
    mask = (psd.frequencies >= low_freq) & (psd.frequencies <= high_freq)
    
    if not np.any(mask):
        return 0.0
        
    # Normalización energética de la señal en la banda
    signal_energy = np.trapz(ts.fft().real[mask]**2 + ts.fft().imag[mask]**2, psd.frequencies[mask])
    noise_variance = np.trapz(psd.value[mask], psd.frequencies[mask])
    
    if noise_variance == 0:
        return 0.0
        
    snr_squared = signal_energy / noise_variance
    return float(np.sqrt(snr_squared))

def extract_chirp_features(strain_data: np.ndarray, fs: float) -> dict:
    """
    Extrae características físicas básicas: frecuencia instantánea y amplitud envolvente.
    Usa transformada de Hilbert para analizar la fase.
    """
    from scipy.signal import hilbert
    
    analytic_signal = hilbert(strain_data)
    amplitude_envelope = np.abs(analytic_signal)
    instantaneous_phase = np.unwrap(np.angle(analytic_signal))
    instantaneous_frequency = (np.diff(instantaneous_phase) / (2.0*np.pi) * fs)
    
    return {
        "amplitude": amplitude_envelope,
        "frequency": instantaneous_frequency,
        "max_freq_hz": float(np.max(instantaneous_frequency)),
        "peak_amp": float(np.max(amplitude_envelope))
    }
