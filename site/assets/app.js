/**
 * GW Laboratory - Cálculo Científico Local
 * Implementación de aproximación Post-Newtoniana (PN) en JavaScript puro.
 */

const canvas = document.getElementById('waveform-canvas');
const ctx = canvas.getContext('2d');
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

// Actualizar etiquetas al mover sliders
Object.keys(sliders).forEach(key => {
  sliders[key].addEventListener('input', () => {
    vals[key].textContent = parseFloat(sliders[key].value).toFixed(1);
  });
});

btnGen.addEventListener('click', calculateAndRender);

// Inicializar
calculateAndRender();

function calculateChirpMass(m1, m2) {
  const mu = (m1 * m2) / (m1 + m2);
  const M_total = m1 + m2;
  return Math.pow(mu, 3/5) / Math.pow(M_total, 1/5);
}

function generateWaveform(m1, m2, fStart, fEnd, snrTarget) {
  // Constantes físicas simplificadas
  const TIME_CONV = 4.925e-6; // Segundos por masa solar aprox
  
  const Mc = calculateChirpMass(m1, m2);
  
  // Tiempo hasta coalescencia desde fStart
  // tau = K * f^(-8/3) donde K depende de Mc
  const K_factor = (5.0 / 256.0) * Math.pow(Math.PI * Mc * TIME_CONV, -5/3);
  
  const t_start_abs = K_factor * Math.pow(fStart, -8/3);
  const t_end_abs = K_factor * Math.pow(fEnd, -8/3);
  
  // Duración total (con margen pequeño)
  const duration = t_start_abs + (t_start_abs * 0.1); 
  
  // Resolución de muestra
  const fs = 2000; // Hz de muestreo visual
  const nSamples = Math.floor(duration * fs);
  
  const times = new Float32Array(nSamples);
  const hClean = new Float32Array(nSamples);
  const hNoisy = new Float32Array(nSamples);
  
  let phaseAccumulator = 0;
  
  for (let i = 0; i < nSamples; i++) {
    const t = i / fs;
    times[i] = t;
    
    // Tiempo restante hasta merger (tau)
    const tau = Math.max(t_start_abs - t, 1e-6);
    
    // Frecuencia instantánea f(tau) ~ tau^(-3/8)
    const freq = (1.0 / Math.PI) * Math.pow(tau / K_factor, -3/8);
    
    // Limitar frecuencia extrema para evitar NaN
    const safeFreq = Math.min(freq, 2000.0);
    
    // Fase acumulada dphi = 2*pi*f*dt
    phaseAccumulator += 2 * Math.PI * safeFreq * (1/fs);
    
    // Amplitud A ~ f^(-7/6)
    let amp = Math.pow(safeFreq, -7/6);
    
    // Normalizar amplitud máxima a ~1e-21
    // (Calculamos un factor de escala aproximado basado en valores típicos)
    amp *= 1e-21 * 1000; // Escala arbitraria pero consistente para visualización
    
    // Envolvente de ringdown simple (caída tras merger teórico)
    let envelope = 1.0;
    if (tau < 0.01) { // Cerca del merger
       envelope = Math.exp(-(0.01 - tau) * 100); 
    }
    
    const hVal = amp * Math.cos(phaseAccumulator) * envelope;
    hClean[i] = hVal;
  }
  
  // Añadir ruido gaussiano para simular SNR
  // Ruido blanco: sigma tal que ||noise|| = ||signal|| / SNR
  let signalNormSq = 0;
  for(let i=0; i<nSamples; i++) signalNormSq += hClean[i]*hClean[i];
  const signalNorm = Math.sqrt(signalNormSq);
  
  const noiseNormRequired = signalNorm / snrTarget;
  const sigmaNoise = noiseNormRequired / Math.sqrt(nSamples);
  
  // Generador pseudoaleatorio simple (LCG) para reproducibilidad sin librerías externas
  let seed = 42;
  function randomGaussian() {
    // Box-Muller transform simplificado
    seed = (seed * 9301 + 49297) % 233280;
    const u1 = seed / 233280;
    seed = (seed * 9301 + 49297) % 233280;
    const u2 = seed / 233280;
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }
  
  for (let i = 0; i < nSamples; i++) {
    const noise = randomGaussian() * sigmaNoise;
    hNoisy[i] = hClean[i] + noise;
  }
  
  return { times, hClean, hNoisy, duration, Mc };
}

function drawChart(data) {
  const width = canvas.width;
  const height = canvas.height;
  const midY = height / 2;
  
  ctx.clearRect(0, 0, width, height);
  
  // Fondo
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, width, height);
  
  // Eje central
  ctx.strokeStyle = '#334155';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(width, midY);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Encontrar max amplitud para escalar Y
  let maxAbs = 0;
  for(let i=0; i<data.hNoisy.length; i++) {
    if(Math.abs(data.hNoisy[i]) > maxAbs) maxAbs = Math.abs(data.hNoisy[i]);
  }
  if(maxAbs === 0) maxAbs = 1;
  
  const scaleY = (midY - 20) / maxAbs;
  const scaleX = width / data.times[data.times.length - 1];
  
  // Dibujar Teoría (Azul Cian)
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for(let i=0; i<data.hClean.length; i++) {
    const x = data.times[i] * scaleX;
    const y = midY - data.hClean[i] * scaleY;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.stroke();
  
  // Dibujar Observado (Blanco Translucido)
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for(let i=0; i<data.hNoisy.length; i++) {
    const x = data.times[i] * scaleX;
    const y = midY - data.hNoisy[i] * scaleY;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.stroke();
}

function calculateAndRender() {
  const m1 = parseFloat(sliders.m1.value);
  const m2 = parseFloat(sliders.m2.value);
  const snr = parseFloat(sliders.snr.value);
  
  // Validación básica
  if(m1 <= 0 || m2 <= 0 || snr <= 0) return;
  
  const data = generateWaveform(m1, m2, 20.0, 500.0, snr);
  
  drawChart(data);
  
  // Actualizar métricas
  outputs.mc.textContent = `${data.Mc.toFixed(2)} M☉`;
  outputs.duration.textContent = `${data.duration.toFixed(2)} s`;
  outputs.snr.textContent = snr.toFixed(1);
}
