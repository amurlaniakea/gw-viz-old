const selectEl = document.getElementById('event-select');
const strainSvg = document.getElementById('strain-svg');
const skySvg = document.getElementById('sky-svg');
const catalogBody = document.querySelector('#catalog-table tbody');

// DOM Elements for stats
const els = {
  m1: document.getElementById('val-m1'),
  m2: document.getElementById('val-m2'),
  mc: document.getElementById('val-mc'),
  dist: document.getElementById('val-dist'),
  snr: document.getElementById('val-snr'),
  freqFinal: document.getElementById('freq-final'),
  ampMax: document.getElementById('amp-max')
};

let currentEventData = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  try {
    const res = await fetch('./data/events_index.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    
    // Populate Select
    selectEl.innerHTML = '';
    for (const ev of payload.events) {
      const opt = document.createElement('option');
      opt.value = ev.id;
      opt.textContent = `${ev.name || ev.id} (${ev.date})`;
      selectEl.appendChild(opt);
    }

    selectEl.addEventListener('change', () => loadEvent(selectEl.value));
    
    // Load first event
    if (payload.events.length > 0) {
      await loadEvent(payload.events[0].id);
    }
  } catch (err) {
    console.error(err);
    alert("Error cargando datos iniciales.");
  }
}

async function loadEvent(id) {
  try {
    const res = await fetch(`./data/${id}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    currentEventData = await res.json();
    
    updateStats(currentEventData);
    drawStrainChart(currentEventData);
    drawSkyMap(currentEventData);
    highlightTableRow(id);
  } catch (err) {
    console.error(err);
  }
}

function updateStats(ev) {
  els.m1.textContent = `${ev.mass_1?.toFixed(1) || '--'} M☉`;
  els.m2.textContent = `${ev.mass_2?.toFixed(1) || '--'} M☉`;
  
  // Calculate Chirp Mass if not present or just display stored
  let mc = ev.chirp_mass;
  if (!mc && ev.mass_1 && ev.mass_2) {
    mc = ((ev.mass_1 * ev.mass_2) ** (3/5)) / ((ev.mass_1 + ev.mass_2) ** (1/5));
  }
  els.mc.textContent = `${mc?.toFixed(1) || '--'} M☉`;
  
  els.dist.textContent = `${ev.distance_mpc?.toFixed(0) || '--'} Mpc`;
  els.snr.textContent = ev.snr_combined?.toFixed(1) || '--';
  
  // Approximate final frequency based on total mass (simplified physics model for demo)
  // f_final approx 4400 Hz * (Mc/M_sun)^-5/6 ... rough estimate for visualization
  if (mc) {
     const f_est = 4400 * Math.pow(mc, -5/6);
     els.freqFinal.textContent = `${f_est.toFixed(0)} Hz`;
  } else {
     els.freqFinal.textContent = '-- Hz';
  }
  
  // Max amplitude scales inversely with distance and directly with chirp mass^1.5 roughly
  // Just a placeholder calculation for visual consistency
  if (ev.distance_mpc && mc) {
      const amp_est = (100 / ev.distance_mpc) * Math.pow(mc, 1.5);
      els.ampMax.textContent = `${(amp_est * 10).toFixed(1)} ×10⁻²¹`; 
  } else {
      els.ampMax.textContent = '-- ×10⁻²¹';
  }
}

function drawStrainChart(ev) {
  strainSvg.innerHTML = ''; // Clear previous
  
  const width = 800;
  const height = 300;
  const centerY = height / 2;
  
  // Generate synthetic chirp data points
  // We simulate the inspiral -> merger -> ringdown
  const points = [];
  const duration = 0.2; // seconds typical for stellar BH mergers
  const samples = 400;
  
  // Base frequency depends on masses
  const baseFreq = ev.chirp_mass ? 30 * Math.pow(ev.chirp_mass, -5/6) : 50;
  
  for (let i = 0; i <= samples; i++) {
    const t_norm = i / samples; // 0 to 1
    const t_real = t_norm * duration;
    
    // Frequency increases as we approach merger (t=0.8 is merger peak in this norm)
    // Simple power law approximation: f ~ (tc - t)^-3/8
    const tc = 0.8; // Time of coalescence in normalized units
    let freq = baseFreq;
    if (t_norm < tc) {
       const dt = tc - t_norm;
       freq = baseFreq * Math.pow(dt, -3/8) * 0.1; // Scale factor to keep it visible
    } else {
       // Ringdown: exponential decay oscillation
       freq = baseFreq * 2; 
    }
    
    // Amplitude envelope
    let amp = 0;
    if (t_norm < tc) {
       amp = Math.pow(tc - t_norm, -1/4) * 0.5; // Grows as they get closer
    } else {
       amp = Math.exp(-(t_norm - tc) * 20) * 0.5; // Decays after merger
    }
    
    // Phase integration (approximate)
    // For visual purposes, we just use sin(freq * t * scale)
    // To make it look like a chirp, we accumulate phase manually would be better,
    // but for a quick static demo, varying frequency visually works if plotted carefully.
    // Let's use a simpler visual trick: increasing density of waves.
    
    const phase = 2 * Math.PI * freq * t_real * 100; // Arbitrary scaling for visuals
    
    const h = amp * Math.sin(phase);
    points.push({ x: t_norm * width, y: centerY - h * 100 }); // Scale Y
  }
  
  // Draw Path
  const pathData = points.map((p, i) => `${i===0?'M':'L'} ${p.x},${p.y}`).join(' ');
  
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathData);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#38bdf8'); // Cyan
  path.setAttribute('stroke-width', '2');
  path.setAttribute('opacity', '0.8');
  
  // Add Glow Effect via filter (simple duplicate stroke)
  const glowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  glowPath.setAttribute('d', pathData);
  glowPath.setAttribute('fill', 'none');
  glowPath.setAttribute('stroke', '#38bdf8');
  glowPath.setAttribute('stroke-width', '6');
  glowPath.setAttribute('opacity', '0.2');
  glowPath.setAttribute('filter', 'blur(4px)'); // Note: SVG blur requires defs, skipping for simplicity, using opacity
  
  strainSvg.appendChild(glowPath);
  strainSvg.appendChild(path);
  
  // Axis Lines
  const axisY = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  axisY.setAttribute('x1', '0'); axisY.setAttribute('y1', centerY);
  axisY.setAttribute('x2', width); axisY.setAttribute('y2', centerY);
  axisY.setAttribute('stroke', '#1e293b');
  axisY.setAttribute('stroke-dasharray', '4,4');
  strainSvg.appendChild(axisY);
}

function drawSkyMap(ev) {
  skySvg.innerHTML = '';
  const cx = 100, cy = 100;
  
  // Background Circle
  const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bgCircle.setAttribute('cx', cx); bgCircle.setAttribute('cy', cy);
  bgCircle.setAttribute('r', 80);
  bgCircle.setAttribute('fill', '#020617');
  bgCircle.setAttribute('stroke', '#1e293b');
  skySvg.appendChild(bgCircle);
  
  // Ellipse of Uncertainty (Simulated based on SNR/Distance)
  // Higher SNR/Lower Distance -> Smaller ellipse
  const uncertaintySize = ev.snr_combined ? Math.max(10, 60 - ev.snr_combined * 2) : 40;
  
  const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  ellipse.setAttribute('cx', cx);
  ellipse.setAttribute('cy', cy);
  ellipse.setAttribute('rx', uncertaintySize);
  ellipse.setAttribute('ry', uncertaintySize * 0.6);
  ellipse.setAttribute('transform', `rotate(${Math.random()*45} ${cx} ${cy})`); // Random orientation for demo
  ellipse.setAttribute('fill', 'rgba(167, 139, 250, 0.2)');
  ellipse.setAttribute('stroke', '#a78bfa');
  ellipse.setAttribute('stroke-width', '1.5');
  skySvg.appendChild(ellipse);
  
  // Center Point (Best Fit Location)
  const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  point.setAttribute('cx', cx);
  point.setAttribute('cy', cy);
  point.setAttribute('r', 3);
  point.setAttribute('fill', '#fff');
  skySvg.appendChild(point);
  
  // Label
  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', cx);
  label.setAttribute('y', cy + 90);
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('fill', '#94a3b8');
  label.setAttribute('font-size', '10');
  label.textContent = 'Región de Cielo';
  skySvg.appendChild(label);
}

function highlightTableRow(id) {
  const rows = catalogBody.querySelectorAll('tr');
  rows.forEach(row => {
    row.classList.remove('selected');
    if (row.dataset.id === id) {
      row.classList.add('selected');
    }
  });
}

// Initialize Catalog Table separately since we need full data list
async function initCatalog() {
  // We assume events_index has basic info, but for table we might need more.
  // For this MVP, we'll just list what's in index.
  // Ideally, we'd fetch all details, but that's many requests.
  // Let's stick to the index for the table structure.
  const res = await fetch('./data/events_index.json');
  const payload = await res.json();
  
  catalogBody.innerHTML = '';
  for (const ev of payload.events) {
    const tr = document.createElement('tr');
    tr.dataset.id = ev.id;
    tr.innerHTML = `
      <td>${ev.id}</td>
      <td>BH-BH</td> <!-- Placeholder type -->
      <td>${ev.date}</td>
      <td>--</td> <!-- MC calculated on demand usually, keeping simple here -->
      <td>--</td>
      <td>LIGO/Virgo</td>
    `;
    tr.addEventListener('click', () => {
      selectEl.value = ev.id;
      loadEvent(ev.id);
    });
    catalogBody.appendChild(tr);
  }
}

initCatalog();
