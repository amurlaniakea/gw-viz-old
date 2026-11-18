const chartEl = document.getElementById('chart');
const detailEl = document.getElementById('detail');
const skymapEl = document.getElementById('skymap');

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/events/GW150914');
    const event = await res.json();
    renderDetail(event);
    renderSkyMap(event);

    const strainRes = await fetch('/api/events/GW150914/strain');
    const strain = await strainRes.json();
    renderChart(strain);
  } catch (err) {
    detailEl.innerHTML = `<p style="color:red;">Error cargando datos: ${err.message}</p>`;
  }
});

function renderDetail(event) {
  detailEl.innerHTML = `
    <h2>${event.name}</h2>
    <p><strong>Fecha:</strong> ${event.date}</p>
    <p>${event.description}</p>
    
    <div class="stat-grid">
      <div class="stat">
        <span class="stat-label">Masa 1</span>
        <span class="stat-value">${event.mass_1} M☉</span>
      </div>
      <div class="stat">
        <span class="stat-label">Masa 2</span>
        <span class="stat-value">${event.mass_2} M☉</span>
      </div>
      <div class="stat">
        <span class="stat-label">Masa Final</span>
        <span class="stat-value">${event.final_mass} M☉</span>
      </div>
      <div class="stat">
        <span class="stat-label">Energía Radiada</span>
        <span class="stat-value">${event.radiated_energy} M☉ c²</span>
      </div>
      <div class="stat">
        <span class="stat-label">Distancia</span>
        <span class="stat-value">${event.distance_mpc} Mpc</span>
      </div>
    </div>
  `;
}

function renderChart(strain) {
  const trace = {
    x: strain.map(d => d.t),
    y: strain.map(d => d.h),
    mode: 'lines',
    line: { color: '#38bdf8', width: 1.5 },
    name: 'Strain (h)'
  };

  const layout = {
    title: 'GW150914 - Strain vs Tiempo',
    xaxis: { title: 'Tiempo (s)', color: '#94a3b8', gridcolor: '#1e293b' },
    yaxis: { title: 'Strain (h)', color: '#94a3b8', gridcolor: '#1e293b' },
    paper_bgcolor: '#0f172a',
    plot_bgcolor: '#0f172a',
    font: { color: '#e2e8f0' },
    margin: { t: 40, r: 20, b: 40, l: 60 },
    hovermode: 'x unified'
  };

  Plotly.newPlot('chart', [trace], layout, { responsive: true });
}

function renderSkyMap(event) {
  skymapEl.innerHTML = `
    <svg viewBox="0 0 400 200" style="width: 100%; max-width: 600px; background: #020617; border-radius: 8px; border: 1px solid #1e293b;">
      <defs>
        <radialGradient id="skyGradient">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#020617"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#skyGradient)"/>
      
      <!-- Estrellas de fondo -->
      ${generateStars(60)}
      
      <!-- Elipse de localizacion de GW150914 -->
      <ellipse cx="200" cy="100" rx="70" ry="25" fill="rgba(239, 68, 68, 0.1)" stroke="#ef4444" stroke-width="2" stroke-dasharray="4"/>
      <text x="200" y="140" fill="#e2e8f0" text-anchor="middle" font-family="sans-serif" font-size="14">${event.location}</text>
      <text x="200" y="105" fill="#ef4444" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="bold">${event.name}</text>
    </svg>
  `;
}

function generateStars(count) {
  let stars = '';
  for (let i = 0; i < count; i++) {
    const cx = Math.random() * 400;
    const cy = Math.random() * 200;
    const r = Math.random() * 1.5;
    stars += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="white" opacity="${Math.random() * 0.8 + 0.2}"/>`;
  }
  return stars;
}
