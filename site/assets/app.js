/**
 * GW Detection Lab - Dual Detector Simulation
 * Simulates H1 and L1 strain channels with correlated noise and signal delay.
 */

const canvasH1 = document.getElementById('canvas-h1');
const canvasL1 = document.getElementById('canvas-l1');
const ctxH1 = canvasH1.getContext('2d');
const ctxL1 = canvasL1.getContext('2d');

const btnGen = document.getElementById('btn-regenerate');
const sliders = {
    m1: document.getElementById('slider-m1'),
    m2: document.getElementById('slider-m2'),
    snr: document.getElementById('slider-snr')
};

const outputs = {
    mc: document.getElementById('out-mc'),
    duration: document.getElementById('out-duration'),
    status: document.getElementById('out-status')
};

function init() {
    ['m1', 'm2', 'snr'].forEach(key => {
        sliders[key].addEventListener('input', () => {
            const val = parseFloat(sliders[key].value);
            document.getElementById(`val-${key}`).textContent = val.toFixed(1);
        });
    });

    btnGen.addEventListener('click', simulateDetection);
    setTimeout(simulateDetection, 300);
}

function calcChirpMass(m1, m2) {
    const mu = (m1 * m2) / (m1 + m2);
    const M = m1 + m2;
    return Math.pow(mu, 3/5) / Math.pow(M, 1/5);
}

/**
 * Genera la señal teórica base (sin ruido aún)
 */
function generateBaseWaveform(m1, m2, fStart, fEnd, snrTarget) {
    const Mc = calcChirpMass(m1, m2);
    const TIME_SCALE = 4.925e-6; 
    
    // K factor
    const K_factor = (5.0 / 256.0) * Math.pow(Math.PI * Mc * TIME_SCALE, -5/3);
    
    let t_total = K_factor * Math.pow(fStart, -8/3);
    if (t_total > 2.0) t_total = 2.0; // Cap estricto para demo clara

    const nPoints = 1000; // Menos puntos para rendimiento fluido
    const times = new Array(nPoints);
    const hClean = new Array(nPoints);
    
    let phase = 0;
    const dt = t_total / nPoints;
    
    let maxAmpRaw = 0;
    const ampsRaw = new Array(nPoints);
    const freqs = new Array(nPoints);

    for (let i = 0; i < nPoints; i++) {
        const t = i * dt;
        times[i] = t;
        
        const tau = Math.max(t_total - t, 1e-8);
        
        let f = (1.0 / Math.PI) * Math.pow(tau / K_factor, -3/8);
        if (f > 2000) f = 2000;
        if (isNaN(f)) f = 2000;
        
        freqs[i] = f;
        phase += 2 * Math.PI * f * dt;
        
        let amp = Math.pow(f, -7/6);
        ampsRaw[i] = amp;
        if (amp > maxAmpRaw) maxAmpRaw = amp;
    }
    
    const scaleVis = maxAmpRaw > 0 ? 1.0 / maxAmpRaw : 1.0;
    
    for (let i = 0; i < nPoints; i++) {
        let envelope = 1.0;
        const progress = i / nPoints;
        
        // Ringdown brusco
        if (progress > 0.95) {
            envelope = Math.exp(-(progress - 0.95) * 200); 
        }
        
        hClean[i] = ampsRaw[i] * scaleVis * Math.cos(phase) * envelope;
    }
    
    return { times, hClean, duration: t_total, Mc };
}

/**
 * Simula la detección en dos canales con ruido independiente y desfase temporal
 */
function simulateDetection() {
    const m1 = parseFloat(sliders.m1.value);
    const m2 = parseFloat(sliders.m2.value);
    const snr = parseFloat(sliders.snr.value);
    
    if(isNaN(m1) || isNaN(m2) || isNaN(snr)) return;

    // 1. Generar señal limpia
    const baseData = generateBaseWaveform(m1, m2, 20.0, 500.0, snr);
    
    // 2. Calcular nivel de ruido necesario para el SNR dado
    // SNR = Signal_Power / Noise_Power -> Noise_Power = Signal_Power / SNR^2
    let sigPower = 0;
    for(let v of baseData.hClean) sigPower += v*v;
    sigPower /= baseData.hClean.length;
    
    const noisePower = sigPower / (snr * snr);
    const sigmaNoise = Math.sqrt(noisePower);

    // 3. Generar Canal H1 (Hanford)
    // Ruido gaussiano blanco simple para demo
    let seedH = Date.now();
    function randGauss(seedRef) {
        seedRef.val = (seedRef.val * 9301 + 49297) % 233280;
        const u1 = seedRef.val / 233280;
        seedRef.val = (seedRef.val * 9301 + 49297) % 233280;
        const u2 = seedRef.val / 233280;
        if(u1 === 0) u1 = 1e-10;
        return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    }
    
    const h1Seed = { val: seedH };
    const h1Noisy = baseData.hClean.map(v => v + randGauss(h1Seed) * sigmaNoise);

    // 4. Generar Canal L1 (Livingston)
    // Desfase temporal aprox 7ms (0.007s). Como fs es alto, calculamos shift en índices.
    // dt = duration / nPoints. Shift indices = 0.007 / dt
    const dt = baseData.duration / baseData.hClean.length;
    const shiftIndices = Math.round(0.007 / dt);
    
    const l1Seed = { val: seedH + 1000 }; // Semilla diferente para ruido independiente
    const l1CleanShifted = [];
    // Aplicar shift circular simple o padding
    for(let i=0; i<baseData.hClean.length; i++) {
        const srcIdx = i - shiftIndices;
        if(srcIdx >= 0 && srcIdx < baseData.hClean.length) {
            l1CleanShifted.push(baseData.hClean[srcIdx]);
        } else {
            l1CleanShifted.push(0); // Fuera de rango
        }
    }
    
    const l1Noisy = l1CleanShifted.map(v => v + randGauss(l1Seed) * sigmaNoise);

    // 5. Dibujar
    drawChannel(ctxH1, canvasH1.width, canvasH1.height, baseData.times, h1Noisy, '#38bdf8', 'H1');
    drawChannel(ctxL1, canvasL1.width, canvasL1.height, baseData.times, l1Noisy, '#a78bfa', 'L1');
    
    // 6. Métricas
    outputs.mc.textContent = `${baseData.Mc.toFixed(2)} M☉`;
    outputs.duration.textContent = `${baseData.duration.toFixed(2)} s`;
    
    if (snr < 8) {
        outputs.status.textContent = "Indetectable";
        outputs.status.className = "status-bad";
    } else if (snr < 15) {
        outputs.status.textContent = "Marginal";
        outputs.status.className = "status-warn";
    } else {
        outputs.status.textContent = "Claro";
        outputs.status.className = "status-ok";
    }
}

function drawChannel(ctx, width, height, times, data, color, label) {
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);
    
    const midY = height / 2;
    
    // Grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY); ctx.lineTo(width, midY);
    ctx.stroke();

    // Escala Y automática basada en el máximo absoluto del canal
    let maxAbs = 0;
    for(let v of data) {
        if(Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
    }
    if(maxAbs === 0) maxAbs = 1;
    
    const scaleY = (height * 0.4) / maxAbs;
    const scaleX = width / times[times.length - 1];
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    
    for(let i=0; i<data.length; i++) {
        const x = times[i] * scaleX;
        const y = midY - data[i] * scaleY;
        const yc = Math.min(height, Math.max(0, y));
        if(i===0) ctx.moveTo(x, yc); else ctx.lineTo(x, yc);
    }
    ctx.stroke();
    
    // Etiqueta de tiempo de merger
    const mergeX = times[times.length-1] * scaleX * 0.95;
    ctx.strokeStyle = '#ef4444';
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(mergeX, 0);
    ctx.lineTo(mergeX, height);
    ctx.stroke();
    ctx.setLineDash([]);
}

if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
