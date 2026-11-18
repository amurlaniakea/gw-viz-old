const selectEl = document.getElementById('event-select');
const canvas = document.getElementById('strain-canvas');
const ctx = canvas.getContext('2d');
const detailPanel = document.getElementById('detail-panel');
const caption = document.getElementById('chart-caption');

let currentEvent = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  try {
    const res = await fetch('./data/events_index.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    
    selectEl.innerHTML = '';
    for (const ev of payload.events) {
      const opt = document.createElement('option');
      opt.value = ev.id;
      opt.textContent = `${ev.name || ev.id} (${ev.date})`;
      selectEl.appendChild(opt);
    }

    selectEl.addEventListener('change', () => loadEvent(selectEl.value));
    
    // Cargar primero por defecto
    if (payload.events.length > 0) {
      await loadEvent(payload.events[0].id);
    }
  } catch (err) {
    detailPanel.textContent = `Error: ${err.message}`;
  }
}

async function loadEvent(id) {
  try {
    const res = await fetch(`./data/${id}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    currentEvent = await res.json();
    
    renderDetail(currentEvent);
    await renderStrain(id);
  } catch (err) {
    detailPanel.textContent = `Error cargando evento: ${err.message}`;
  }
}

function renderDetail(ev) {
  detailPanel.innerHTML = `
    <h2>${ev.name || ev.id}</h2>
    <div><strong>Fecha:</strong> ${ev.date || 'N/A'}</div>
    <div><strong>Masa 1:</strong> ${ev.mass_1} M☉</div>
    <div><strong>Masa 2:</strong> ${ev.mass_2} M☉</div>
    <div><strong>Distancia:</strong> ${ev.distance_mpc || 'N/A'} Mpc</div>
    <div><strong>Detectores:</strong> ${(ev.detectors || []).join(', ')}</div>
    <hr/>
    <small>Fuente: Datos abiertos GWOSC (simplificados).</small>
  `;
}

async function renderStrain(id) {
  // Limpiar canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Dibujar ejes simples
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 20); ctx.lineTo(40, canvas.height - 40); // Y axis
  ctx.moveTo(40, canvas.height - 40); ctx.lineTo(canvas.width - 20, canvas.height - 40); // X axis
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px sans-serif';
  ctx.fillText('Amplitud h(t)', 10, 30);
  ctx.fillText('Tiempo (s)', canvas.width - 80, canvas.height - 10);

  // Intentar cargar CSV de strain si es GW150914, sino generar placeholder
  let points = [];
  
  if (id === 'GW150914') {
    try {
      const csvRes = await fetch('./data/gw150914_strain.csv');
      if (csvRes.ok) {
        const text = await csvRes.text();
        const lines = text.trim().split('\n');
        // Asumimos formato: time,strain
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',');
          if (parts.length >= 2) {
            points.push({ t: parseFloat(parts[0]), h: parseFloat(parts[1]) });
          }
        }
      }
    } catch (e) {
      console.warn("No CSV found, using synthetic chirp");
    }
  }

  if (points.length === 0) {
    // Generar chirp sintético básico para demostración visual
    // f(t) aumenta cuadráticamente cerca de merger
    const duration = 0.2; // segundos
    const steps = 200;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * duration;
      // Modelo muy simplificado: amplitud crece, frecuencia crece
      const freq = 35 + (t / duration) * 200; 
      const amp = 0.5 * Math.pow((t / duration), 2);
      const phase = 2 * Math.PI * freq * t;
      points.push({ t: t, h: amp * Math.sin(phase) });
    }
    caption.textContent = `Señal sintética aproximada (Chirp Newtoniano)`;
  } else {
    caption.textContent = `Datos reales de strain (GWOSC)`;
  }

  // Escalar y dibujar
  if (points.length > 0) {
    const maxH = Math.max(...points.map(p => Math.abs(p.h))) || 1;
    const scaleY = (canvas.height / 2 - 40) / maxH;
    const scaleX = (canvas.width - 60) / (points[points.length-1].t || 1);
    
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const x = 40 + p.t * scaleX;
      const y = (canvas.height / 2) - (p.h * scaleY);
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
