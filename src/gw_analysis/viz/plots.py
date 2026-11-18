from __future__ import annotations
import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path
from scipy.signal import welch

def plot_full_analysis(times, strain, metrics, event_id, output_dir="./output"):
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    fig, axes = plt.subplots(3, 1, figsize=(10, 12))
    
    # 1. Señal Completa
    axes[0].plot(times, strain, color="#38bdf8", linewidth=0.8)
    axes[0].axhline(0, color="gray", linestyle="--", alpha=0.5)
    axes[0].set_ylabel("Strain $h$")
    axes[0].set_title(f"{event_id}: Full Signal (Real LIGO Data)")
    axes[0].grid(True, alpha=0.3)
    
    # 2. Zoom Merger (últimos 0.2s)
    win = 0.2
    mask = times >= (times[-1] - win)
    axes[1].plot(times[mask], strain[mask], color="#a78bfa", linewidth=1.5)
    axes[1].axhline(0, color="gray", linestyle="--", alpha=0.5)
    axes[1].set_xlabel("Time (s)")
    axes[1].set_ylabel("Strain $h$")
    axes[1].set_title(f"Merger Region (Last {win}s)")
    axes[1].grid(True, alpha=0.3)
    
    # 3. PSD
    fs = 1.0 / (times[1] - times[0]) if len(times) > 1 else 4096
    freqs, psd = welch(strain, fs=fs, nperseg=min(1024, len(strain)))
    axes[2].semilogy(freqs, psd, color="#22c55e", linewidth=1.5)
    axes[2].axvline(20, color="red", linestyle=":")
    axes[2].axvline(2000, color="orange", linestyle=":")
    axes[2].set_xlabel("Frequency (Hz)")
    axes[2].set_ylabel("PSD")
    axes[2].set_title("Power Spectral Density")
    axes[2].set_xlim([10, 5000])
    axes[2].grid(True, which="both", ls="--", alpha=0.5)
    
    plt.tight_layout()
    save_path = Path(output_dir) / f"{event_id}_report.png"
    plt.savefig(save_path, dpi=300)
    plt.close(fig)
    print(f"📊 Saved: {save_path}")
    return save_path
