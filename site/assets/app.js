/**
 * GW Laboratory - Fixed Chirp Visualization
 * Solución al aliasing: Submuestreo adaptativo y suavizado de trazo.
 */

const canvas = document.getElementById('waveform-canvas');
if (!canvas) throw new Error("Canvas not found");
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
    freq: document.getElementById('out-freq')
};

function init() {
    ['m1', 'm2', 'snr'].forEach(key => {
        sliders[key].addEventListener('input', () => {
            vals[key].textContent = parseFloat(sliders[key].value).toFixed(1);
        });
    });

    btnGen.addEventListener('click', calculateAndRender);
    setTimeout(calculateAndRender, 300);
}

function calcChirpMass(m1, m2) {
    const mu = (m1 * m2) / (m1 + m2);
    const M = m1 + m2;
    return Math.pow(mu, 3/5) / Math.pow(M, 1/5);
}

/**
 * Genera física con enfoque en VISIBILIDAD.
 * Truco: Calculamos muchos puntos internos pero dibujamos menos,
 * usando promedio móvil para suavizar el ruido visual.
 */
function generatePhysics(m1, m2, fStart, fEnd, snrTarget) {
    const Mc = calcChirpMass(m1, m2);
    const TIME_SCALE = 4.925e-6; 
    const K_factor = (5.0 / 256.0) * Math.pow(Math.PI * Mc * TIME_SCALE, -5/3);
    
    // Ventana temporal fija para evitar escalas absurdas
    const VIEW_DURATION = 0.25; // 250ms alrededor del merger
    
    // Resolución interna alta (para precisión matemática)
    const INTERNAL_POINTS = 4000;
    const dt_internal = VIEW_DURATION / INTERNAL_POINTS;
    
    let phase = 0;
    const internalTimes = [];
    const internalH = [];
    const internalFreqs = [];
    
    let maxAmpRaw = 0;
    const ampsRaw = [];

    for (let i = 0; i < INTERNAL_POINTS; i++) {
        const tau = Math.max(VIEW_DURATION - (i * dt_internal), 1e-8);
        
        let f = (1.0 / Math.PI) * Math.pow(tau / K_factor, -3/8);
        if (f > 1500) f = 1500; 
        if (isNaN(f)) f = 1500;
        
        phase += 2 * Math.PI * f * dt_internal;
        
        let amp = Math.pow(f, -7/6);
        ampsRaw.push(amp);
        if (amp > maxAmpRaw) maxAmpRaw = amp;
        
        internalFreqs.push(f);
        internalTimes.push(i * dt_internal);
    }
    
    const scaleVis = maxAmpRaw > 0 ? 1.0 / maxAmpRaw : 1.0;
    
    // Construir señal limpia normalizada
    for (let i = 0; i < INTERNAL_POINTS; i++) {
        let envelope = 1.0;
        const progress = i / INTERNAL_POINTS;
        if (progress > 0.90) {
            envelope = Math.exp(-(progress - 0.90) * 50); 
        }
        internalH.push(ampsRaw[i] * scaleVis * Math.cos(phase) * envelope);
    }
    
    // Añadir Ruido
    let sigNormSq = 0;
    for(let v of internalH) sigNormSq += v*v;
    const sigNorm = Math.sqrt(sigNormSq);
    const noiseNormReq = sigNorm / snrTarget;
    const sigmaNoise = noiseNormReq / Math.sqrt(INTERNAL_POINTS);
    
    let seed = Date.now() % 100000;
    function randGauss() {
        seed = (seed * 9301 + 49297) % 233280;
        const u1 = seed / 233280;
        seed = (seed * 9301 + 49297) % 233280;
        const u2 = seed / 233280;
        if(u1 === 0) u1 = 1e-10;
        return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    }
    
    const internalNoisy = internalH.map(v => v + (randGauss() * sigmaNoise));

    // --- SUBMUESTREO PARA DIBUJO SUAVE ---
    // El canvas tiene ~800px de ancho. Dibujamos 800 puntos.
    // Promediamos grupos de puntos internos para eliminar el "zigzag" digital.
    const DRAW_POINTS = 800;
    const step = Math.floor(INTERNAL_POINTS / DRAW_POINTS);
    
    const drawTimes = [];
    const drawClean = [];
    const drawNoisy = [];
    
    for (let i = 0; i < DRAW_POINTS; i++) {
        const startIdx = i * step;
        const endIdx = Math.min(startIdx + step, INTERNAL_POINTS);
        
        // Promedio simple (Box Filter) para suavizar
        let sumClean = 0, sumNoisy = 0;
        let count = 0;
        
        for (let j = startIdx; j < endIdx; j++) {
            sumClean += internalH[j];
            sumNoisy += internalNoisy[j];
            count++;
        }
        
        if (count > 0) {
            drawTimes.push(internalTimes[startIdx]);
            drawClean.push(sumClean / count);
            drawNoisy.push(sumNoisy / count);
        }
    }
    
    const idxMerge = Math.floor(DRAW_POINTS * 0.90);
    const fFinal = internalFreqs[Math.floor(INTERNAL_POINTS * 0.90)];

    return { 
        times: drawTimes, 
        hClean: drawClean, 
        hNoisy: drawNoisy, 
        duration: VIEW_DURATION, 
        Mc, 
        fFinal 
    };
}

function drawChart(data) {
    if (!data) return;

    const width = canvas.width;
    const height = canvas.height;
    const midY = height / 2;
    
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);
    
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY); ctx.lineTo(width, midY);
    ctx.stroke();

    // Escala Y dinámica
    let maxAbs = 0;
    for(let i=0; i<data.hNoisy.length; i++) {
        const absVal = Math.abs(data.hNoisy[i]);
        if(absVal > maxAbs) maxAbs = absVal;
    }
    if(maxAbs === 0) maxAbs = 1;
    
    const usableHeight = height * 0.8;
    const scaleY = usableHeight / (maxAbs * 2); 
    const scaleX = width / data.duration;
    
    function drawPath(arr, color, lineWidth) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        
        for(let i=0; i<arr.length; i++) {
            const x = data.times[i] * scaleX;
            const y = midY - arr[i] * scaleY;
            const yc = Math.min(height - 5, Math.max(5, y));
            
            if(i===0) ctx.moveTo(x, yc); 
            else ctx.lineTo(x, yc);
        }
        ctx.stroke();
    }

    // 1. Ruido (Blanco tenue)
    drawPath(data.hNoisy, 'rgba(255, 255, 255, 0.4)', 1);
    
    // 2. Teoría (Cian brillante)
    drawPath(data.hClean, '#38bdf8', 2.5);
    
    // Marcador MERGER
    const mergeX = data.duration * 0.90 * scaleX;
    ctx.strokeStyle = '#ef4444';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mergeX, 0);
    ctx.lineTo(mergeX, height);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText("MERGER", mergeX + 5, 15);
}

function updateMetrics(data, snrInput) {
    if(outputs.mc) outputs.mc.textContent = `${data.Mc.toFixed(2)} M☉`;
    if(outputs.duration) outputs.duration.textContent = `${data.duration.toFixed(3)} s`;
    if(outputs.freq) outputs.freq.textContent = `${data.fFinal.toFixed(0)} Hz`;
}

function calculateAndRender() {
    try {
        const m1 = parseFloat(sliders.m1.value);
        const m2 = parseFloat(sliders.m2.value);
        const snr = parseFloat(sliders.snr.value);
        
        if(isNaN(m1) || isNaN(m2) || isNaN(snr)) return;

        const data = generatePhysics(m1, m2, 20.0, 500.0, snr);
        drawChart(data);
        updateMetrics(data, snr);
        
    } catch (err) {
        console.error(err);
    }
}

if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
