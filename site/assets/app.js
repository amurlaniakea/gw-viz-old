/**
 * GW Laboratory - Motor Científico JS Estable
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

function generatePhysics(m1, m2, fStart, fEnd, snrTarget) {
    const Mc = calcChirpMass(m1, m2);
    const TIME_SCALE = 4.925e-6; 
    
    const K_factor = (5.0 / 256.0) * Math.pow(Math.PI * Mc * TIME_SCALE, -5/3);
    
    let t_total = K_factor * Math.pow(fStart, -8/3);
    if (t_total > 5.0) t_total = 5.0; // Cap para visualización

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
        if (progress > 0.95) {
            envelope = Math.exp(-(progress - 0.95) * 80); 
        }
        
        hClean[i] = ampsRaw[i] * scaleVis * Math.cos(phase) * envelope;
    }
    
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
    
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY); ctx.lineTo(width, midY);
    ctx.stroke();

    let maxAbs = 0;
    for(let i=0; i<data.hNoisy.length; i++) {
        const absVal = Math.abs(data.hNoisy[i]);
        if(absVal > maxAbs) maxAbs = absVal;
    }
    if(maxAbs === 0) maxAbs = 1;
    
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

    drawPath(data.hNoisy, 'rgba(255, 255, 255, 0.3)', 1);
    drawPath(data.hClean, '#38bdf8', 2.5);
    
    const mergeX = data.duration * 0.95 * scaleX;
    ctx.strokeStyle = '#ef4444';
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
