import numpy as np

def add_colored_noise(signal: np.ndarray, snr_target: float, seed: int | None = None) -> np.ndarray:
    """
    Añade ruido gaussiano blanco para alcanzar un SNR objetivo.
    SNR definido como ratio de normas L2: ||signal|| / ||noise||
    """
    rng = np.random.default_rng(seed)
    
    signal_norm = np.linalg.norm(signal)
    if signal_norm == 0:
        return signal.copy()
        
    # Noise norm required: ||noise|| = ||signal|| / SNR
    noise_norm_required = signal_norm / snr_target
    
    # Generate white noise with std such that its L2 norm matches requirement
    # E[||N||^2] = N_points * sigma^2  => sigma = sqrt(||N||^2 / N_points)
    n_points = len(signal)
    sigma_noise = noise_norm_required / np.sqrt(n_points)
    
    noise = rng.normal(0, sigma_noise, size=n_points)
    
    return signal + noise
