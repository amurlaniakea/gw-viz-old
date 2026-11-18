# 🌌 GW Viz

## 🌐 Live Demo

Visita la demo estática en: [https://amurlaniakea.github.io/gw-viz/](https://amurlaniakea.github.io/gw-viz/)

Esta demo utiliza datos pre-generados en `site/data/`. Para probar la integración completa con GWOSC, ejecuta el backend localmente.


Visualización educativa de ondas gravitacionales usando datos abiertos de LIGO/Virgo.

## MVP actual
- Visualización interactiva del Strain $h(t)$ del evento GW150914.
- Estadísticas físicas: Masas de los agujeros negros, energía radiada, distancia.
- Mapa del cielo (Sky Map) con la elipse de localización de la señal.
- Generación matemática de la curva *chirp* (aproximación Newtonian).

## Requisitos
- Python 3.10 o superior
- python3-venv

## Ejecutar
    bash run.sh

Luego abrir:
    http://localhost:8000