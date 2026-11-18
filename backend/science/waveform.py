from __future__ import annotations

import numpy as np
from scipy.integrate import cumulative_trapezoid

def generate_chirp_waveform(
    m1: float, 
    m2: float, 
    f_start: float = 20.0, 
    f_end: float = 500.0, 
    fs: float = 4096.0,
    duration_margin: float = 0.1
) -> tuple[np.ndarray, np.ndarray]:
    """
    Genera una forma de onda de inspiral binario usando aproximación Post-Newtoniana.
    """
    M_total = m1 + m2
    mu = (m1 * m2) / M_total
    Mc = ((mu ** (3/5)) / (M_total ** (1/5)))  # Chirp Mass
    
    # Constante de conversión tiempo-masa solar aprox
    TIME_CONV = 4.925e-6 
    
    def time_to_merger(f_hz):
        return (5.0 / 256.0) * (np.pi * Mc * TIME_CONV)**(-5/3) * (f_hz)**(-8/3)
        
    t_start_abs = time_to_merger(f_start)
    t_end_abs = time_to_merger(f_end)
    
    t_total = t_start_abs + (duration_margin * t_start_abs if t_start_abs > 0 else 0.1)
    
    n_samples = int(t_total * fs)
    if n_samples < 100:
        n_samples = 1000
        
    t_vec = np.linspace(0, t_total, n_samples)
    
    tau_vec = t_total - t_vec 
    tau_safe = np.maximum(tau_vec, 1e-4)
    
    K_factor = (5.0 / 256.0) * (np.pi * Mc * TIME_CONV)**(-5/3)
    
    f_gw = (1.0 / np.pi) * (tau_safe / K_factor)**(-3/8)
    f_gw = np.minimum(f_gw, 2000.0) 
    
    omega = 2 * np.pi * f_gw
    phase = cumulative_trapezoid(omega, t_vec, initial=0)
    
    amp_raw = f_gw**(-7/6)
    
    max_amp = np.max(amp_raw)
    if max_amp > 0:
        amp_scaled = amp_raw / max_amp * 1e-21
    else:
        amp_scaled = np.zeros_like(amp_raw)
        
    decay_mask = np.ones_like(t_vec)
    merger_time_idx = np.argmin(tau_vec)
    if merger_time_idx < len(t_vec) - 1:
        tail_len = len(t_vec) - merger_time_idx
        decay_mask[merger_time_idx:] = np.exp(-np.linspace(0, 5, tail_len))
        
    h_plus = amp_scaled * np.cos(phase) * decay_mask
    
    return t_vec, h_plus

def calculate_optimal_snr(template: np.ndarray, noise_std: float = 1e-23) -> float:
    norm_h = np.linalg.norm(template)
    if norm_h == 0 or noise_std == 0:
        return 0.0
    return norm_h / noise_std
