from __future__ import annotations
import numpy as np
from scipy.signal import welch

def analyze_signal(times: np.ndarray, strain: np.ndarray) -> dict:
    if len(times) < 2:
        raise ValueError("Insufficient data points.")
        
    dt = times[1] - times[0]
    fs = 1.0 / dt
    
    # PSD con Welch
    nperseg = min(4096, len(strain))
    freqs, psd = welch(strain, fs=fs, nperseg=nperseg)
    
    # Banda sensible 20-2000 Hz
    mask = (freqs >= 20) & (freqs <= 2000)
    if not np.any(mask):
        return {"snr": 0.0, "peak_amp": 0.0, "max_freq_hz": 0.0, "duration_s": 0.0}
        
    # SNR aproximado (energía señal / ruido)
    fft_data = np.fft.rfft(strain)
    fft_freqs = np.fft.rfftfreq(len(strain), d=dt)
    
    from scipy.interpolate import interp1d
    try:
        psd_interp = interp1d(freqs, psd, fill_value="extrapolate")(fft_freqs)
        psd_safe = np.where(psd_interp == 0, 1e-30, psd_interp)
        snr_sq = np.sum(np.abs(fft_data)**2 / psd_safe * (fft_freqs[1]-fft_freqs[0]))
        snr = np.sqrt(max(0, snr_sq))
    except:
        snr = 0.0
        
    peak_amp = float(np.max(np.abs(strain)))
    
    # Frecuencia final estimada (cruces por cero en último 10%)
    tail = strain[-len(strain)//10:]
    crossings = np.sum(np.diff(np.sign(tail)) != 0)
    dur_tail = times[-1] - times[-len(strain)//10]
    max_freq = crossings / (2 * dur_tail) if dur_tail > 0 else 0.0
    
    return {
        "snr": float(snr),
        "peak_amp": peak_amp,
        "max_freq_hz": float(max_freq),
        "duration_s": float(times[-1] - times[0])
    }
