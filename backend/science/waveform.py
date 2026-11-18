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
    
    Física subyacente:
    - La frecuencia orbital f(t) evoluciona según df/dt ~ f^(11/3).
    - La amplitud h(t) escala como h ~ f^(-7/6).
    - Usamos unidades geométricas G=c=M_sun=1 para simplificar cálculos internos,
      luego escalamos a valores físicos típicos (strain ~ 1e-21).
    
    Args:
        m1, m2: Masas en masas solares.
        f_start, f_end: Frecuencias inicial/final en Hz.
        fs: Frecuencia de muestreo en Hz.
        
    Returns:
        t: Vector de tiempo (s).
        h_plus: Strain dimensionless (amplitud relativa).
    """
    M_total = m1 + m2
    mu = (m1 * m2) / M_total
    Mc = ((mu ** (3/5)) / (M_total ** (1/5)))  # Chirp Mass
    
    # Tiempo hasta coalescencia desde f_start (aproximación Leading Order)
    # tau_cohesion ≈ (5/256) * (G/c^5) * (Mc^-5/3) * (pi*f)^-8/3
    # En unidades naturales (G=c=1, M_sun=time_unit):
    # Factor de conversión aprox para segundos: 4.925e-6 s per M_sun
    TIME_CONV = 4.925e-6 
    
    # Calculamos el tiempo restante hasta merger desde f_start
    # f_orbital = f_gw / 2 (para polarización plus/cross, usamos f_gw directamente en fórmulas estándar)
    # Nota: En LIGO, f suele referirse a frecuencia de onda gravitacional (2x orbital)
    
    # Integral de dt/df = - (5/256) * (pi*M_c)^(-5/3) * f^(-8/3) ... (signo negativo porque f aumenta con t decreciente hacia merger)
    # Mejor: Definimos t=0 en merger, y calculamos t_negativo para inicio.
    
    def time_to_merger(f_hz):
        # Fórmula LO para tiempo desde frecuencia f hasta merger
        return (5.0 / 256.0) * (np.pi * Mc * TIME_CONV)**(-5/3) * (f_hz)**(-8/3)
        
    t_start_abs = time_to_merger(f_start)
    t_end_abs = time_to_merger(f_end) # Debería ser cercano a 0 si f_end es alta
    
    # Rango de tiempo total (desde inicio hasta merger + pequeño margen ringdown)
    t_total = t_start_abs + (duration_margin * t_start_abs if t_start_abs > 0 else 0.1)
    
    n_samples = int(t_total * fs)
    if n_samples < 100:
        n_samples = 1000
        
    # Creamos vector de tiempo uniforme
    t_vec = np.linspace(0, t_total, n_samples)
    
    # Invertimos el tiempo para que la señal termine en merger (t=t_total es merger?)
    # No, usualmente t=0 es inicio. Vamos a calcular f(t) resolviendo la ODE inversa.
    # Simplificación educativa: Usamos la relación analítica invertida f(tau) donde tau es tiempo hasta merger.
    
    tau_vec = t_total - t_vec # Tiempo restante hasta merger (decrece de t_total a 0)
    
    # Evitar división por cero cerca del merger
    tau_safe = np.maximum(tau_vec, 1e-4)
    
    # Calcular frecuencia instantánea f(tau) usando fórmula LO invertida:
    # f(tau) = (1/pi) * (5/256 * tau / (Mc*TIME_CONV)^(-5/3))^(-3/8)
    # Derivado de tau = K * f^(-8/3) => f = (tau/K)^(-3/8)
    
    K_factor = (5.0 / 256.0) * (np.pi * Mc * TIME_CONV)**(-5/3)
    
    # f_gw (frecuencia de onda gravitacional)
    f_gw = (1.0 / np.pi) * (tau_safe / K_factor)**(-3/8)
    
    # Limitar frecuencia máxima para evitar singularidades numéricas extremas
    f_gw = np.minimum(f_gw, 2000.0) 
    
    # Fase acumulada phi(t) = integral(omega dt) = integral(2*pi*f dt)
    omega = 2 * np.pi * f_gw
    phase = cumulative_trapezoid(omega, t_vec, initial=0)
    
    # Amplitud A(tau) ~ f^(-7/6)
    amp_raw = f_gw**(-7/6)
    
    # Normalizar amplitud máxima a ~1e-21 (valor típico detectable)
    max_amp = np.max(amp_raw)
    if max_amp > 0:
        amp_scaled = amp_raw / max_amp * 1e-21
    else:
        amp_scaled = np.zeros_like(amp_raw)
        
    # Aplicar envolvente de fusión/ringdown simple (caída exponencial tras merger teórico)
    # Como nuestro modelo termina en merger (tau->0), añadimos un decay suave al final visual
    decay_mask = np.ones_like(t_vec)
    merger_time_idx = np.argmin(tau_vec) # Donde tau es mínimo (más cerca de merger)
    if merger_time_idx < len(t_vec) - 1:
        tail_len = len(t_vec) - merger_time_idx
        decay_mask[merger_time_idx:] = np.exp(-np.linspace(0, 5, tail_len))
        
    h_plus = amp_scaled * np.cos(phase) * decay_mask
    
    return t_vec, h_plus

def calculate_optimal_snr(template: np.ndarray, noise_std: float = 1e-23) -> float:
    """
    SNR óptimo teórico dado un template y ruido blanco gaussiano.
    rho_opt = sqrt(integral |h_tilde|^2 / S_n)
    Para ruido blanco constante Sn, rho ~ ||h||_2 / sigma_noise
    """
    norm_h = np.linalg.norm(template)
    if norm_h == 0 or noise_std == 0:
        return 0.0
    return norm_h / noise_std
