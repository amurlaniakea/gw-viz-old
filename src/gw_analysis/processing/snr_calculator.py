from __future__ import annotations
import numpy as np
from scipy.signal import welch

def analyze_signal(times: np.ndarray, strain: np.ndarray) -> dict:
    """
    Analiza una serie temporal de strain usando SciPy para cálculos DSP estándar.
    Evita problemas de unidades de gwpy/astropy para mayor robustez.
    """
    if len(times) < 2:
        raise ValueError("Need at least 2 time points to calculate sample rate.")

    # Calcular frecuencia de muestreo fs = 1/dt
    dt = times[1] - times[0]
    fs = 1.0 / dt
    
    # 1. Calcular PSD usando Welch's Method (estándar en LIGO/Virgo)
    # nperseg: tamaño de segmento para FFT. Usamos 4096 samples (~1s @ 4kHz)
    nperseg = min(4096, len(strain))
    
    freqs, psd = welch(strain, fs=fs, nperseg=nperseg, noverlap=nperseg // 2)
    
    # 2. Definir banda sensible (20Hz - 2kHz)
    low_freq = 20
    high_freq = 2000
    
    mask = (freqs >= low_freq) & (freqs <= high_freq)
    
    if not np.any(mask):
        return {"snr": 0.0, "peak_amp": 0.0, "max_freq_hz": 0.0, "duration_s": 0.0}
        
    # 3. Calcular SNR aproximado
    # SNR^2 ~ Integral(|FFT(h)|^2 / Sn(f)) df
    # Primero obtenemos la FFT de la señal completa
    fft_data = np.fft.rfft(strain)
    fft_freqs = np.fft.rfftfreq(len(strain), d=dt)
    
    # Interpolamos la PSD a las frecuencias de la FFT para poder dividir
    from scipy.interpolate import interp1d
    try:
        psd_interp_func = interp1d(freqs, psd, kind='linear', fill_value="extrapolate")
        psd_at_fft_freqs = psd_interp_func(fft_freqs)
    except Exception:
        # Fallback si la interpolación falla
        psd_at_fft_freqs = np.ones_like(fft_freqs) * np.mean(psd[mask])
        
    # Evitar división por cero
    psd_safe = np.where(psd_at_fft_freqs == 0, 1e-30, psd_at_fft_freqs)
    
    # Energía de la señal normalizada por ruido
    signal_energy_term = np.abs(fft_data)**2 / psd_safe
    
    # Sumar solo dentro de la banda sensible
    band_mask = (fft_freqs >= low_freq) & (fft_freqs <= high_freq)
    snr_squared = np.sum(signal_energy_term[band_mask]) * (fft_freqs[1] - fft_freqs[0])
    
    snr = np.sqrt(snr_squared) if snr_squared > 0 else 0.0
    
    # 4. Características temporales
    peak_idx = np.argmax(np.abs(strain))
    peak_amp = abs(strain[peak_idx])
    
    # Frecuencia estimada en cola (últimos 10% de la señal)
    last_decile_len = max(1, len(strain)//10)
    last_decile = strain[-last_decile_len:]
    crossings = np.sum(np.diff(np.sign(last_decile)) != 0)
    dur_last = (times[-1] - times[-last_decile_len]) if len(times)>1 else 0.1
    avg_freq = crossings / (2 * dur_last) if dur_last > 0 else 0
    
    return {
        "snr": float(snr),
        "peak_amp": float(peak_amp),
        "max_freq_hz": float(avg_freq),
        "duration_s": float(times[-1] - times[0])
    }
