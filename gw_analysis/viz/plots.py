import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path

def plot_strain_and_spectrum(time_series, fs, event_id, output_dir="./output"):
    """
    Genera un figura dual: Strain h(t) y Espectrograma/PSD.
    Estilo profesional para informes académicos.
    """
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    fig, axes = plt.subplots(2, 1, figsize=(12, 8), sharex=True)
    
    # 1. Strain Temporal
    t = np.arange(len(time_series)) / fs
    axes[0].plot(t, time_series, color='#38bdf8', linewidth=0.8)
    axes[0].set_ylabel('Strain $h(t)$')
    axes[0].set_title(f'GW Event: {event_id}')
    axes[0].grid(True, alpha=0.3)
    
    # 2. Espectro de Potencia (Welch)
    from scipy.signal import welch
    freqs, psd = welch(time_series, fs=fs, nperseg=min(1024, len(time_series)))
    
    axes[1].semilogy(freqs, psd, color='#a78bfa', linewidth=1.5)
    axes[1].set_xlabel('Frequency (Hz)')
    axes[1].set_ylabel('PSD ($1/\sqrt{Hz}$)')
    axes[1].set_xlim([10, 2000])
    axes[1].grid(True, which="both", ls="--", alpha=0.5)
    
    plt.tight_layout()
    save_path = Path(output_dir) / f"{event_id}_analysis.png"
    plt.savefig(save_path, dpi=300)
    plt.close(fig)
    
    print(f"✅ Saved scientific plot to: {save_path}")
    return save_path
