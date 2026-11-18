/**
 * GW Laboratory - Motor Científico JS v2
 * Enfocado en claridad visual y feedback inmediato.
 */

const canvas = document.getElementById('waveform-canvas');
const ctx = canvas.getContext('2d');
const btnGen = document.getElementById('btn-regenerate');

// Inputs
const sliders = {
    m1: document.getElementById('slider-m1'),
    m2: document.getElementById('slider-m2'),
    snr: document.getElementById('slider-snr')
};

// Labels
const vals = {
    m1: document.getElementById('val-m1'),
    m2: document.getElementById('val-m2'),
    snr: document.getElementById('val-snr')
};

// Outputs
const outputs = {
    mc: document.getElementById('out-mc'),
    duration: document.getElementById('out-duration'),
    freq: document.getElementById('out-freq') // NUEVO: Frecuencia final
};

function init() {
    // Listeners para actualizar etiquetas visuales inmediatamente
    ['m1', 'm2', 'snr'].forEach(key => {
        sliders[key].addEventListener('input', () => {
            vals[key].textContent = parseFloat(sliders[key].value).toFixed(1);
        });
    });

    btnGen.addEventListener('click', calculateAndRender);
    
    // Render inicial automático
    setTimeout(calculateAndRender, 300);
}

function calcChirpMass(m1, m2) {
    const mu = (m1 * m2) / (m1 + m2);
    const M = m1 + m2;
    return Math.pow(mu, 3/5) / Math.pow(M, 1/5);
}

function generatePhysics(m1, m2, fStart, fEnd, snrTarget) {
    const Mc = calcChirpMass(m1, m2);
    const TIME_SCALE = 4.925e-6; 
    
    // K factor para tau(f)
    const K_factor = (5.0 / 256.0) * Math.pow(Math.PI * Mc * TIME_SCALE, -5/3);
    
    // Tiempo total desde f_start hasta merger
    const t_total = K_factor * Math.pow(fStart, -8/3);
    
    if (!isFinite(t_total) || t_total <= 0) {
         return null;
    }

    const nPoints = 1500;
    const times = new Array(nPoints);
    const hClean = new Array(nPoints);
    const hNoisy = new Array(nPoints);
    
    let phase = 0;
    const dt = t_total / nPoints;
    
    let maxAmpRaw = 0;
    const ampsRaw = new Array(nPoints);
    const freqs = new Array(nPoints);

    for (let i = 0; i < nPoints; i++) {
        const t = i * dt;
        times[i] = t;
        
        const tau = Math.max(t_total - t, 1e-8);
        
        // Frecuencia instantánea
        let f = (1.0 / Math.PI) * Math.pow(tau / K_factor, -3/8);
        if (f > 2000) f = 2000;
        if (isNaN(f)) f = 2000;
        
        freqs[i] = f;
        
        phase += 2 * Math.PI * f * dt;
        
        // Amplitud cruda ~ f^(-7/6)
        let amp = Math.pow(f, -7/6);
        ampsRaw[i] = amp;
        if (amp > maxAmpRaw) maxAmpRaw = amp;
    }
    
    // Normalización visual [0, 1]
    const scaleVis = maxAmpRaw > 0 ? 1.0 / maxAmpRaw : 1.0;
    
    for (let i = 0; i < nPoints; i++) {
        let envelope = 1.0;
        const progress = i / nPoints;
        // Ringdown simulado en últimos 5%
        if (progress > 0.95) {
            envelope = Math.exp(-(progress - 0.95) * 80); 
        }
        
        hClean[i] = ampsRaw[i] * scaleVis * Math.cos(phase) * envelope;
    }
    
    // Ruido
    let sigNormSq = 0;
    for(let v of hClean) sigNormSq += v*v;
    const sigNorm = Math.sqrt(sigNormSq);
    const noiseNormReq = sigNorm / snrTarget;
    const sigmaNoise = noiseNormReq / Math.sqrt(nPoints);
    
    let seed = Date.now() % 100000;
    function randGauss() {
        seed = (seed * 9301 + 49297) % 233280;
        const u1 = seed / 233280;
        seed = (seed * 9301 + 49297) % 233280;
        const u2 = seed / 233280;
        if(u1 === 0) u1 = 1e-10;
        return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    }
    
    for (let i = 0; i < nPoints; i++) {
        hNoisy[i] = hClean[i] + (randGauss() * sigmaNoise);
    }
    
    // Métrica extra: Frecuencia final (aprox en momento de merger visual)
    // Tomamos la frecuencia en el punto donde empieza el ringdown (95%)
    const idxMerge = Math.floor(nPoints * 0.95);
    const fFinal = freqs[idxMerge];

    return { times, hClean, hNoisy, duration: t_total, Mc, fFinal };
}

function drawChart(data) {
    if (!data) return;

    const width = canvas.width;
    const height = canvas.height;
    const midY = height / 2;
    
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);
    
    // Grid sutil
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY); ctx.lineTo(width, midY);
    ctx.stroke();

    // Escala Y dinámica basada en el máximo observado (incluye ruido)
    let maxAbs = 0;
    for(let i=0; i<data.hNoisy.length; i++) {
        const absVal = Math.abs(data.hNoisy[i]);
        if(absVal > maxAbs) maxAbs = absVal;
    }
    if(maxAbs === 0) maxAbs = 1;
    
    // Dejamos margen para que no toque bordes
    const scaleY = (height * 0.45) / maxAbs;
    const scaleX = width / data.duration;
    
    function drawPath(arr, color, lineWidth) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for(let i=0; i<arr.length; i++) {
            const x = data.times[i] * scaleX;
            const y = midY - arr[i] * scaleY;
            const yc = Math.min(height, Math.max(0, y));
            if(i===0) ctx.moveTo(x, yc); else ctx.lineTo(x, yc);
        }
        ctx.stroke();
    }

    // 1. Ruido/Observado (Blanco tenue, debajo)
    drawPath(data.hNoisy, 'rgba(255, 255, 255, 0.3)', 1);
    
    // 2. Teoría (Cian brillante, encima)
    drawPath(data.hClean, '#38bdf8', 2.5);
    
    // Marcador de Fusión (Vertical dashed line en 95% del tiempo)
    const mergeX = data.duration * 0.95 * scaleX;
    ctx.strokeStyle = '#ef4444'; // Rojo alerta
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(mergeX, 0);
    ctx.lineTo(mergeX, height);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText("MERGER", mergeX + 5, 20);
}

function updateMetrics(data, snrInput) {
    if(outputs.mc) outputs.mc.textContent = `${data.Mc.toFixed(2)} M☉`;
    if(outputs.duration) outputs.duration.textContent = `${data.duration.toFixed(2)} s`;
    if(outputs.freq) outputs.freq.textContent = `${data.fFinal.toFixed(0)} Hz`;
}

function calculateAndRender() {
    try {
        const m1 = parseFloat(sliders.m1.value);
        const m2 = parseFloat(sliders.m2.value);
        const snr = parseFloat(sliders.snr.value);
        
        if(isNaN(m1) || isNaN(m2) || isNaN(snr)) return;

        const data = generatePhysics(m1, m2, 20.0, 500.0, snr);
        
        if(data) {
            drawChart(data);
            updateMetrics(data, snr);
        } else {
            ctx.fillStyle = '#ef4444';
            ctx.fillText("Error calculando física", 20, 50);
        }
        
    } catch (err) {
        console.error(err);
    }
}

if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
