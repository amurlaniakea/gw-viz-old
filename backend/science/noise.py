import numpy as np

def add_colored_noise(signal: np.ndarray, snr_target: float, seed: int | None = None) -> np.ndarray:
    rng = np.random.default_rng(seed)
    
    signal_norm = np.linalg.norm(signal)
    if signal_norm == 0:
        return signal.copy()
        
    noise_norm_required = signal_norm / snr_target
    n_points = len(signal)
    sigma_noise = noise_norm_required / np.sqrt(n_points)
    
    noise = rng.normal(0, sigma_noise, size=n_points)
    
    return signal + noise
