from __future__ import annotations
import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path
from scipy.signal import welch

def plot_full_analysis(times, strain, metrics, event_id, output_dir="./output"):
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    fig, axes = plt.subplots(3, 1, figsize=(10, 12))
    
    # 1. Strain Completo
    ax1 = axes[0]
    ax1.plot(times, strain, color='#38bdf8', linewidth=0.8)
    ax1.axhline(0, color='gray', linestyle='--', alpha=0.5)
    ax1.set_ylabel('Strain $h$')
    ax1.set_title(f'{event_id}: Full Signal')
    ax1.grid(True, alpha=0.3)
    
    # 2. Zoom Merger
    ax2 = axes[1]
    merge_win = 0.2
    start_zoom = times[-1] - merge_win
    mask = np.array(times) >= start_zoom
    z_times = np.array(times)[mask]
    z_strain = np.array(strain)[mask]
    
    ax2.plot(z_times, z_strain, color='#a78bfa', linewidth=1.5)
    ax2.axhline(0, color='gray', linestyle='--', alpha=0.5)
    ax2.set_xlabel('Time (s)')
    ax2.set_ylabel('Strain $h$')
    ax2.set_title(f'Merger Region (Last {merge_win}s)')
    ax2.grid(True, alpha=0.3)
    
    # 3. PSD
    ax3 = axes[2]
    fs = 1.0 / (times[1] - times[0]) if len(times) > 1 else 4096
    freqs, psd = welch(strain, fs=fs, nperseg=min(1024, len(strain)))
    
    ax3.semilogy(freqs, psd, color='#22c55e', linewidth=1.5)
    ax3.axvline(20, color='red', linestyle=':')
    ax3.axvline(2000, color='orange', linestyle=':')
    ax3.set_xlabel('Frequency (Hz)')
    ax3.set_ylabel('PSD')
    ax3.set_title('Power Spectral Density')
    ax3.set_xlim([10, 5000])
    ax3.grid(True, which="both", ls="--", alpha=0.5)
    
    plt.tight_layout()
    save_path = Path(output_dir) / f"{event_id}_report.png"
    plt.savefig(save_path, dpi=300)
    plt.close(fig)
    print(f"📊 Saved: {save_path}")
    return save_path
