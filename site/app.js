const svg = document.getElementById('waveform-chart');
const btnGen = document.getElementById('btn-regenerate');
const sliders = {
  m1: document.getElementById('slider-m1'),
  m2: document.getElementById('slider-m2'),
  snr: document.getElementById('slider-snr')
};
const vals = {
  m1: document.getElementById('val-m1'),
  m2: document.getElementById('val-m2'),
  snr: document.getElementById('val-snr')
};
const outputs = {
  mc: document.getElementById('out-mc'),
  duration: document.getElementById('out-duration'),
  snr: document.getElementById('out-snr')
};

// Update labels on slider move
Object.keys(sliders).forEach(key => {
  sliders[key].addEventListener('input', () => {
    vals[key].textContent = parseFloat(sliders[key].value).toFixed(1);
  });
});

btnGen.addEventListener('click', fetchAndRender);

// Initial load
fetchAndRender();

async function fetchAndRender() {
  const params = new URLSearchParams({
    m1: sliders.m1.value,
    m2: sliders.m2.value,
    snr_simulated: sliders.snr.value,
    f_start: 20,
    f_end: 500
  });

  try {
    const res = await fetch(`/api/lab/waveform?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    
    renderChart(data.data.time_s, data.data.strain_theory, data.data.strain_observed);
    updateMetrics(data.parameters, data.metrics);
  } catch (err) {
    console.error(err);
    alert("Error cargando datos científicos.");
  }
}

function renderChart(times, hTheory, hObserved) {
  svg.innerHTML = ''; // Clear
  
  const width = 800;
  const height = 300;
  const midY = height / 2;
  
  // Find max amplitude for scaling
  const maxAbs = Math.max(
    ...hTheory.map(Math.abs), 
    ...hObserved.map(Math.abs)
  ) || 1;
  
  const scaleY = (height / 2 - 20) / maxAbs;
  const scaleX = width / times[times.length - 1];
  
  // Helper to create path string
  const getPath = (arr) => {
    let d = "";
    arr.forEach((val, i) => {
      const x = times[i] * scaleX;
      const y = midY - val * scaleY;
      d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)},${y.toFixed(2)} `;
    });
    return d;
  };

  // Draw Theory (Blue)
  const pathTheory = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pathTheory.setAttribute('d', getPath(hTheory));
  pathTheory.setAttribute('stroke', '#38bdf8');
  pathTheory.setAttribute('stroke-width', '2');
  pathTheory.setAttribute('fill', 'none');
  svg.appendChild(pathTheory);

  // Draw Observed (White/Grey semi-transparent)
  const pathObs = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pathObs.setAttribute('d', getPath(hObserved));
  pathObs.setAttribute('stroke', 'rgba(255,255,255,0.6)');
  pathObs.setAttribute('stroke-width', '1');
  pathObs.setAttribute('fill', 'none');
  svg.appendChild(pathObs);
  
  // Axis Line
  const axis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  axis.setAttribute('x1', '0'); axis.setAttribute('y1', midY);
  axis.setAttribute('x2', width); axis.setAttribute('y2', midY);
  axis.setAttribute('stroke', '#334155');
  axis.setAttribute('stroke-dasharray', '4,4');
  svg.insertBefore(axis, svg.firstChild);
}

function updateMetrics(params, metrics) {
  outputs.mc.textContent = `${params.chirp_mass_mc} M☉`;
  outputs.duration.textContent = `${metrics.duration_seconds.toFixed(2)} s`;
  outputs.snr.textContent = metrics.snr_measured_approx;
}
