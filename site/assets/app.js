/**
 * GW Laboratory - Motor Científico JS
 * Genera chirps Post-Newtonianos y simula detección con ruido.
 */

const canvas = document.getElementById('waveform-canvas');
if (!canvas) {
    console.error("Canvas not found!");
} else {
    const ctx = canvas.getContext('2d');
    const btnGen = document.getElementById('btn-regenerate');
    
    // Referencias a inputs
    const sliders = {
        m1: document.getElementById('slider-m1'),
        m2: document.getElementById('slider-m2'),
        snr: document.getElementById('slider-snr')
    };
    
    // Referencias a etiquetas de valor
    const vals = {
        m1: document.getElementById('val-m1'),
        m2: document.getElementById('val-m2'),
        snr: document.getElementById('val-snr')
    };

    // Referencias a outputs métricos
    const outputs = {
        mc: document.getElementById('out-mc'),
        duration: document.getElementById('out-duration'),
        snr: document.getElementById('out-snr')
    };

    // --- Inicialización ---
    
    function init() {
        if(!sliders.m1 || !sliders.m2 || !sliders.snr) {
            console.error("Sliders missing in DOM");
            return;
        }

        // Actualizar etiquetas al mover sliders
        ['m1', 'm2', 'snr'].forEach(key => {
            sliders[key].addEventListener('input', () => {
                vals[key].textContent = parseFloat(sliders[key].value).toFixed(1);
                // Opcional: Auto-recalcular al soltar? No, mejor manual para ahorrar CPU
            });
        });

        btnGen.addEventListener('click', calculateAndRender);
        
        // Primer render automático
        setTimeout(calculateAndRender, 100); 
    }

    // --- Física Core ---

    function calcChirpMass(m1, m2) {
        const mu = (m1 * m2) / (m1 + m2);
        const M = m1 + m2;
        return Math.pow(mu, 3/5) / Math.pow(M, 1/5);
    }

    /**
     * Genera la forma de onda h(t) usando aproximación PN Leading Order.
     * Devuelve arrays de tiempo y strain.
     */
    function generatePhysics(m1, m2, fStart, fEnd, snrTarget) {
        const Mc = calcChirpMass(m1, m2);
        
        // Constante de conversión G=c=M_sun=1 -> segundos
        // t_cohesion ~ 4.925e-6 s per solar mass unit factor adjustments
        const TIME_SCALE = 4.925e-6; 
        
        // Factor K para tau = K * f^(-8/3)
        // Derivado de df/dt = (96/5) pi^(8/3) (GMc/c^3)^(5/3) f^(11/3)
        // Integrando dt/df -> tau(f)
        const K_factor = (5.0 / 256.0) * Math.pow(Math.PI * Mc * TIME_SCALE, -5/3);
        
        // Tiempo total hasta merger desde f_start
        const t_total = K_factor * Math.pow(fStart, -8/3);
        
        // Si t_total es inválido o infinito, fallback
        if (!isFinite(t_total) || t_total <= 0) {
             return { times: [], hClean: [], hNoisy: [], duration: 0, Mc: 0 };
        }

        // Resolución: Queremos ver el chirp claramente. 
        // Usamos 2000 puntos distribuidos logarítmicamente en frecuencia/tiempo sería ideal,
        // pero para simplicidad de dibujo lineal, usamos muestras uniformes en tiempo.
        const nPoints = 1500;
        const times = new Array(nPoints);
        const hClean = new Array(nPoints);
        const hNoisy = new Array(nPoints);
        
        let phase = 0;
        const dt = t_total / nPoints;
        
        // Pre-calculamos amplitudes para normalizar luego
        let maxAmp = 0;
        const ampsRaw = new Array(nPoints);
        const freqs = new Array(nPoints);

        for (let i = 0; i < nPoints; i++) {
            const t = i * dt;
            times[i] = t;
            
            // Tau = tiempo restante hasta merger
            const tau = Math.max(t_total - t, 1e-8);
            
            // Frecuencia instantánea f(tau)
            // f = (1/pi) * (tau/K)^(-3/8)
            let f = (1.0 / Math.PI) * Math.pow(tau / K_factor, -3/8);
            
            // Limitar f para evitar singularidades numéricas extremas cerca de merger
            if (f > 2000) f = 2000;
            if (isNaN(f) || !isFinite(f)) f = 2000;
            
            freqs[i] = f;
            
            // Fase acumulada dphi = 2*pi*f*dt
            phase += 2 * Math.PI * f * dt;
            
            // Amplitud A ~ f^(-7/6)
            let amp = Math.pow(f, -7/6);
            ampsRaw[i] = amp;
            if (amp > maxAmp) maxAmp = amp;
        }
        
        // Normalizar amplitud física a rango visible [0, 1] para el gráfico
        // En realidad h ~ 1e-21, pero para visualizarlo escalamos por maxAmp
        const scaleFactor = maxAmp > 0 ? 1.0 / maxAmp : 1.0;
        
        for (let i = 0; i < nPoints; i++) {
            // Señal Limpia (Teoría)
            // Aplicamos envolvente suave de ringdown cerca del final (últimos 5% del tiempo)
            let envelope = 1.0;
            const progress = i / nPoints;
            if (progress > 0.95) {
                // Caída exponencial simulando merger/ringdown
                envelope = Math.exp(-(progress - 0.95) * 100); 
            }
            
            const hVal = ampsRaw[i] * scaleFactor * Math.cos(phase) * envelope;
            hClean[i] = hVal;
        }
        
        // Añadir Ruido Gaussiano para SNR objetivo
        // SNR = ||Signal|| / ||Noise||
        // Calculamos norma L2 de la señal limpia
        let sigNormSq = 0;
        for(let v of hClean) sigNormSq += v*v;
        const sigNorm = Math.sqrt(sigNormSq);
        
        // Normo requerida del ruido para el SNR dado
        const noiseNormReq = sigNorm / snrTarget;
        const sigmaNoise = noiseNormReq / Math.sqrt(nPoints);
        
        // Generador pseudoaleatorio simple (LCG)
        let seed = Date.now() % 100000; // Semilla variable para cambiar ruido cada click
        function randGauss() {
            // Box-Muller
            seed = (seed * 9301 + 49297) % 233280;
            const u1 = seed / 233280;
            seed = (seed * 9301 + 49297) % 233280;
            const u2 = seed / 233280;
            if(u1 === 0) u1 = 1e-10;
            return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        }
        
        for (let i = 0; i < nPoints; i++) {
            const noise = randGauss() * sigmaNoise;
            hNoisy[i] = hClean[i] + noise;
        }
        
        return { times, hClean, hNoisy, duration: t_total, Mc };
    }

    // --- Renderizado Canvas ---

    function drawChart(data) {
        if (!data.times || data.times.length === 0) {
            ctx.fillStyle = '#ef4444';
            ctx.font = '16px sans-serif';
            ctx.fillText("Error: Datos inválidos", 20, 50);
            return;
        }

        const width = canvas.width;
        const height = canvas.height;
        const midY = height / 2;
        
        // Limpiar fondo oscuro
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, width, height);
        
        // Dibujar rejilla sutil
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, midY); ctx.lineTo(width, midY); // Eje X
        ctx.stroke();

        // Determinar escala Y automática basada en la señal MÁS GRANDE (normalizada a +/- 1)
        // Como ya normalizamos ampsRaw a 1.0, el rango esperado es [-1, 1]
        // Pero el ruido puede superar esto si SNR es bajo.
        // Calculamos max absoluto real para ajustar viewport
        let maxAbs = 0;
        for(let i=0; i<data.hNoisy.length; i++) {
            const absVal = Math.abs(data.hNoisy[i]);
            if(absVal > maxAbs) maxAbs = absVal;
        }
        if(maxAbs === 0) maxAbs = 1;
        
        // Margen vertical (dejamos 10% arriba y abajo)
        const scaleY = (height * 0.4) / maxAbs;
        const scaleX = width / data.duration;
        
        // Helper para dibujar path
        function drawPath(arr, color, lineWidth) {
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            for(let i=0; i<arr.length; i++) {
                const x = data.times[i] * scaleX;
                const y = midY - arr[i] * scaleY;
                
                // Clamp Y para evitar salirse del canvas
                const yClamped = Math.min(height, Math.max(0, y));
                
                if(i===0) ctx.moveTo(x, yClamped);
                else ctx.lineTo(x, yClamped);
            }
            ctx.stroke();
        }

        // 1. Dibujar Observado (Ruido + Señal) en Blanco/Gris tenue
        drawPath(data.hNoisy, 'rgba(255, 255, 255, 0.4)', 1);
        
        // 2. Dibujar Teoría (Señal Limpia) en Cian Brillante
        drawPath(data.hClean, '#38bdf8', 2);
        
        // Etiquetas de ejes simples
        ctx.fillStyle = '#64748b';
        ctx.font = '12px monospace';
        ctx.fillText(`t=0`, 5, midY - 5);
        ctx.fillText(`t=${data.duration.toFixed(2)}s`, width - 60, midY - 5);
        ctx.fillText("h(t)", 5, 20);
    }

    function updateMetrics(data, snrInput) {
        if(outputs.mc) outputs.mc.textContent = `${data.Mc.toFixed(2)} M☉`;
        if(outputs.duration) outputs.duration.textContent = `${data.duration.toFixed(2)} s`;
        if(outputs.snr) outputs.snr.textContent = snrInput.toFixed(1);
    }

    // --- Control Principal ---

    function calculateAndRender() {
        try {
            const m1 = parseFloat(sliders.m1.value);
            const m2 = parseFloat(sliders.m2.value);
            const snr = parseFloat(sliders.snr.value);
            
            // Validaciones básicas
            if(isNaN(m1) || isNaN(m2) || isNaN(snr)) {
                alert("Valores inválidos en sliders");
                return;
            }
            if(m1 <= 0 || m2 <= 0 || snr <= 0) {
                alert("Masas y SNR deben ser positivos");
                return;
            }

            // Parámetros físicos fijos para demo educativa (inspiral típico)
            const fStart = 20.0; // Hz
            const fEnd = 500.0;  // Hz (aproximadamente donde termina inspiral)
            
            const data = generatePhysics(m1, m2, fStart, fEnd, snr);
            
            drawChart(data);
            updateMetrics(data, snr);
            
        } catch (err) {
            console.error(err);
            ctx.fillStyle = '#ef4444';
            ctx.font = '16px sans-serif';
            ctx.fillText(`ERROR: ${err.message}`, 20, 50);
        }
    }

    // Ejecutar init cuando DOM esté listo
    if(document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
