#!/usr/bin/env python3
import sys
import argparse
from pathlib import Path

# Aseguramos que src esté en el path
sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

try:
    from gw_analysis.io.downloader import download_event_strain, load_hdf5_strain
    from gw_analysis.processing.snr_calculator import analyze_signal
    from gw_analysis.viz.plots import plot_full_analysis
except ImportError as e:
    print(f"❌ Error importando módulos internos: {e}")
    print("Asegúrate de haber creado la estructura src/gw_analysis/...")
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Analyze GW events.")
    parser.add_argument("event_id", help="Event ID (e.g., GW150914)")
    parser.add_argument("--detector", default="H1", help="Detector (H1, L1)")
    args = parser.parse_args()

    print(f"🔬 Analyzing {args.event_id} ({args.detector})")
    
    try:
        # 1. Descargar
        path = download_event_strain(args.event_id, args.detector)
        
        # 2. Cargar
        times, strain = load_hdf5_strain(path)
        print(f"📂 Loaded {len(strain)} samples.")
        
        # 3. Procesar
        metrics = analyze_signal(times, strain)
        print("\n📈 Metrics:")
        print(f"   SNR: {metrics['snr']:.2f}")
        print(f"   Peak Amp: {metrics['peak_amp']:.2e}")
        print(f"   Max Freq: {metrics['max_freq_hz']:.1f} Hz")
        print(f"   Duration: {metrics['duration_s']:.2f} s")
        
        # 4. Visualizar
        plot_full_analysis(times, strain, metrics, args.event_id)
        print("\n✨ Done. Check ./output/")
        
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
