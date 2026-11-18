/**
 * GW Laboratory v3 - Visual Clarity Focus
 * Objetivo: Mostrar un chirp limpio y reconocible, no ruido digital.
 */

const canvas = document.getElementById('waveform-canvas');
if (!canvas) { console.error("Canvas not found"); throw new Error(); }
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
    
    // Render inicial
    setTimeout(calculateAndRender, 300);
}

function calcChirpMass(m1, m2) {
    const mu = (m1 * m2) / (m1 + m2);
    const M = m1 + m2;
    return Math.pow(mu, 3/5) / Math.pow(M, 1/5);
}

/**
 * Genera física optimizada para VISUALIZACIÓN EDUCATIVA.
 * No busca precisión absoluta de LIGO, sino claridad pedagógica.
 */
function generatePhysics(m1, m2, fStart, fEnd, snrTarget) {
    const Mc = calcChirpMass(m1, m2);
    const TIME_SCALE = 4.925e-6; 
    
    // K factor para tau(f)
    const K_factor = (5.0 / 256.0) * Math.pow(Math.PI * Mc * TIME_SCALE, -5/3);
    
    // Tiempo hasta merger desde f_start
    let t_total = K_factor * Math.pow(fStart, -8/3);
    
    // ESTRATEGIA VISUAL:
    // Si t_total es muy largo (>1s), recortamos la vista a los últimos 0.3s 
    // para que se vea el "chirp" denso y claro, no una línea plana lenta.
    const VIEW_DURATION = 0.3; // Segundos visibles
    
    if (t_total < VIEW_DURATION) {
        // Caso extremo: masas muy grandes, evento muy corto
        t_total = Math.max(t_total, 0.05); 
    } else {
        // Empezamos a dibujar desde t_final - VIEW_DURATION
        t_total = VIEW_DURATION;
    }

    // Resolución alta para evitar aliasing (garzúa)
    // 800 px ancho -> necesitamos al menos 1600-2000 puntos para suavidad
    const nPoints = 2000;
    const times = new Array(nPoints);
    const hClean = new Array(nPoints);
    const hNoisy = new Array(nPoints);
    
    let phase = 0;
    const dt = t_total / nPoints;
    
    let maxAmpRaw = 0;
    const ampsRaw = new Array(nPoints);
    const freqs = new Array(nPoints);

    for (let i = 0; i < nPoints; i++) {
        // Tiempo relativo dentro de la ventana de visión
        // tau va desde t_total hasta 0 (merger)
        const tau = Math.max(t_total - (i * dt), 1e-6);
        
        // Frecuencia instantánea f(tau)
        let f = (1.0 / Math.PI) * Math.pow(tau / K_factor, -3/8);
        
        // Limitar frecuencia máxima para evitar explosión numérica excesiva
        // Pero permitir subidas rápidas para el efecto chirp
        if (f > 1500) f = 1500; 
        
        freqs[i] = f;
        
        // Acumulación de fase
        phase += 2 * Math.PI * f * dt;
        
        // Amplitud cruda ~ f^(-7/6)
        let amp = Math.pow(f, -7/6);
        ampsRaw[i] = amp;
        if (amp > maxAmpRaw) maxAmpRaw = amp;
        
        times[i] = i * dt; // Tiempo absoluto desde inicio de la ventana
    }
    
    // Normalización visual [0, 1]
    const scaleVis = maxAmpRaw > 0 ? 1.0 / maxAmpRaw : 1.0;
    
    for (let i = 0; i < nPoints; i++) {
        let envelope = 1.0;
        const progress = i / nPoints;
        
        // Ringdown suave pero visible al final
        if (progress > 0.90) {
            envelope = Math.exp(-(progress - 0.90) * 50); 
        }
        
        hClean[i] = ampsRaw[i] * scaleVis * Math.cos(phase) * envelope;
    }
    
    // Ruido controlado
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
    
    const idxMerge = Math.floor(nPoints * 0.90);
    const fFinal = freqs[idxMerge];

    return { times, hClean, hNoisy, duration: t_total, Mc, fFinal };
}

function drawChart(data) {
    if (!data) return;

    const width = canvas.width;
    const height = canvas.height;
    const midY = height / 2;
    
    // Fondo oscuro limpio
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);
    
    // Eje central sutil
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
    
    // Dejamos margen superior/inferior del 10%
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
            
            // Clamp estricto para no salirse del canvas
            const yc = Math.min(height - 5, Math.max(5, y));
            
            if(i===0) ctx.moveTo(x, yc); 
            else ctx.lineTo(x, yc);
        }
        ctx.stroke();
    }

    // 1. Dibujar Ruido/Observado primero (fondo)
    drawPath(data.hNoisy, 'rgba(255, 255, 255, 0.4)', 1);
    
    // 2. Dibujar Teoría encima (línea principal gruesa)
    drawPath(data.hClean, '#38bdf8', 2.5);
    
    // Marcador MERGER (vertical rojo)
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
