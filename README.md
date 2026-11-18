# 🌊 GW Analysis Toolkit

Herramienta científica para análisis reproducible de datos abiertos de ondas gravitacionales (LIGO/Virgo/KAGRA).

> *«Tecnósfera al servicio de la Biósfera.» — «La Paz Es El Camino.»*

## Demostración Científica Real

Esta herramienta descarga datos crudos de [GWOSC](https://www.gwosc.org/) mediante gwpy/gwosc y genera informes visuales de alta calidad usando matplotlib y scipy.


*Figura: Pipeline completo mostrando señal bruta (ruido LIGO), zoom al merger (chirp real) y espectro de potencia (PSD).*

## Características Clave

- **Datos Reales**: Integración directa con gwosc para acceso transparente a archivos HDF5 de LIGO/Virgo.
- **DSP Riguroso**: Implementación de Welch Method para estimación de PSD y cálculo aproximado de SNR.
- **Visualización Editorial**: Gráficos de 3 paneles listos para publicaciones o docencia universitaria.
- **Reproducibilidad**: Scripts CLI deterministas y notebooks Jupyter interactivos.

## Instalación Rápida

    python3 -m venv .venv
    source .venv/bin/activate
    pip install -e ".[dev]"

## Uso Inmediato

Analiza el evento emblemático GW150914:

    ./cli_analyze.py GW150914 --detector H1

Resultados esperados:
1. Caché local en data/raw/GW150914_H1.hdf5.
2. Métricas impresas: SNR, Amplitud Pico, Duración.
3. Informe PNG generado en output/GW150914_report.png.

## Detalles Técnicos de Descarga

Para nuevos eventos, la librería utiliza internamente gwosc.locate.get_urls(detector, start, end), asegurando compatibilidad con la estructura actual del catálogo GWOSC (O4b release 2026).

## Estructura del Proyecto

- src/gw_analysis/io: Gestores de I/O y descargas automatizadas vía GWOSC.
- src/gw_analysis/processing: Algoritmos de procesamiento de señal (SciPy/Numpy).
- src/gw_analysis/viz: Plantillas de gráficos científicos personalizados.
- notebooks/: Guías docentes paso a paso.

## Licencia

AGPL-3.0-or-later. Ciencia abierta, verificable y libre.
