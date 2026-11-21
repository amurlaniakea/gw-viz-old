# 🌌 GW Lab — laboratorio visual de ondas gravitacionales

Demo interactiva con **datos reales de LIGO** (GW150914, la primera detección directa de ondas gravitacionales):
datos blanqueados de Hanford y Livingston, plantilla post-newtoniana ajustada por filtro adaptado, espectrograma del
«chirp», simulación de la fusión a escala con el campo de ondas, y sonificación.

**Demo:** <https://amurlaniakea.github.io/gw-viz-old/> (se despliega desde `docs/` con GitHub Actions)
· Repo hermano más robusto, sin interfaz visual: [`gw-viz`](https://github.com/amurlaniakea/gw-viz)

> *«Tecnosfera al servicio de la biosfera.»*

## Qué puedes hacer

- Mover las masas y ver cuánto se parece tu plantilla a lo que registraron los detectores (SNR local, retardo L1−H1, polaridad).
- «Optimizar con los datos»: el ajuste revela que la **masa de chirp** está bien determinada pero m₁ y m₂ por separado no (una cresta, no un punto).
- Reproducir la fusión en cámara lenta (separación en M y km, velocidad orbital, ondas en espiral con tiempo retardado) con cursor sincronizado en la señal y el espectrograma.
- Escuchar el dato real y la plantilla.
- Cambiar la interfaz entre **español, inglés y francés** (selector arriba a la derecha; se recuerda tu elección). Añadir otro idioma = añadir un objeto en `docs/js/i18n.js`; `tests/i18n.test.mjs` exige que todas las claves existan en todos los idiomas.

## Ciencia y validación

| Componente | Fuente | Cómo se comprueba |
|---|---|---|
| Inspiral TaylorT4 a 2.5PN (integrado con RK4) | Blanchet, *Living Rev. Relativ.* 17, 2 (2014) | f(t) frente a TaylorT4 de LALSuite < 0,7 % en 4 sistemas (`tests/physics.test.mjs`) |
| Ringdown, modo 220 | Berti, Cardoso & Will, *PRD* 73, 064030 (2006) | frente a Leaver exacto (paquete `qnm`): < 3 % en f, < 6 % en decaimiento |
| Masa y espín finales | Jiménez-Forteza et al., *PRD* 95, 064024 (2017) | tabla generada con LALSuite (`scripts/make_lal_fixtures.py`) |
| Datos | [GWOSC](https://gwosc.org), CC BY 4.0 | `scripts/build_data.py`: PSD de Welch (mediana) → blanqueado → paso banda 35–350 Hz |
| Filtro adaptado | correlación cruzada por FFT | inyecciones sintéticas de semilla fija (`tests/lab.test.mjs`) |

Valores de referencia del evento: Abbott et al., *PRL* 116, 061102 y 116, 241102 (2016). **Las masas de la interfaz están en el
marco del detector** (corridas al rojo, z≈0,09): 38,9 y 31,6 M☉ ↔ 36 y 29 M☉ en el marco de la fuente.

## Límites (léelos antes de citar nada)

- Sin espines ni precesión. La inspiral se extiende hasta v/c≈0,5, más allá del régimen donde la teoría PN es rigurosa;
  fusión y ringdown son una unión didáctica, **no relatividad numérica**.
- El SNR mostrado es una estimación *local* en una ventana de 1 s; no sustituye al análisis oficial (SNR de red ≈ 24).
- No sirve para inferencia de parámetros. Para eso, usa pipelines como `pycbc` o `bilby`.
- Los tests comprueban la lógica y la física frente a referencias independientes, **no** la apariencia visual (no hay tests de navegador).

## Ejecutar y reproducir

    npm test                                   # 21 tests (Node ≥ 20)
    python3 -m http.server -d docs 8000        # abre http://localhost:8000

Regenerar los datos reales (necesita `numpy scipy` y `h5py`, o `gwpy` para descargar):

    python3 scripts/build_data.py --local RUTA/con/GW150914_H1.hdf5_y_L1   # sin red
    python3 scripts/build_data.py                                          # descarga de GWOSC

Regenerar las referencias de LALSuite (solo si cambias la física): `pip install lalsuite qnm numpy` y `python3 scripts/make_lal_fixtures.py`.

## Código Python anterior

`gw_analysis/`, `src/`, `cli_analyze.py` y `notebooks/` son el toolkit anterior (v0.1). Se conservan por historia: su «SNR» es
aproximado, no un filtro adaptado. El análisis riguroso vive en `gw-viz` y en este `docs/js`.

## Licencia y cita

AGPL-3.0-or-later · © Pedro Sordo Martínez · ver `CITATION.cff` · Datos: GWOSC (CC BY 4.0).
