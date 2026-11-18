const translations = {
  es: {
    subtitle: "Simulador Educativo de Formas de Onda Post-Newtonianas",
    controlsTitle: "Parámetros Binarios",
    helpM1: "Aumentar m1 reduce duración pero aumenta amplitud final.",
    helpM2: "Relación de masas afecta simetría de señal.",
    helpSnr: "SNR bajo = difícil distinguir señal del ruido.",
    btnGen: "▶ Generar Señal Teórica",
    btnReal: "📂 Cargar Datos Reales GW150914",
    legTheory: "— Teoría (Limpia)",
    legObserved: "— Observado/Simulado (Ruido)",
    lblMc: "𝑀_c (Masa Chirp)",
    lblDur: "Duración Total",
    lblFreq: "Frec. Máxima",
    sumConcept: "¿Qué estás viendo? (Conceptos Físicos)",
    txtIntro: "Esta herramienta simula la señal de strain (h) producida por la fusión de dos agujeros negros.",
    sumFormula: "Física Utilizada (Aproximación PN)",
    txtFormulaIntro: "Usamos la aproximación Leading Order Post-Newtoniana. Fórmulas clave:",
    eqLabel1: "Masa Chirp (Mc): Parámetro fundamental.",
    eqLabel2: "Evolución de Frecuencia f(τ): Sube conforme se acerca τ→0.",
    eqLabel3: "Amplitud h(t): Escala con Mc y distancia D.",
    txtNote: "Nota: Simplificación didáctica. LIGO usa modelos numéricos complejos (EOB/Phenom)."
  },
  en: {
    subtitle: "Educational Simulator of Post-Newtonian Waveforms",
    controlsTitle: "Binary Parameters",
    helpM1: "Increasing m1 reduces duration but increases final amplitude.",
    helpM2: "Mass ratio affects signal symmetry.",
    helpSnr: "Low SNR = hard to distinguish signal from noise.",
    btnGen: "▶ Generate Theoretical Signal",
    btnReal: "📂 Load Real Data GW150914",
    legTheory: "— Theory (Clean)",
    legObserved: "— Observed/Simulated (Noise)",
    lblMc: "ℳ_c (Chirp Mass)",
    lblDur: "Total Duration",
    lblFreq: "Max Frequency",
    sumConcept: "What are you seeing? (Physical Concepts)",
    txtIntro: "This tool simulates the strain (h) signal produced by the merger of two black holes.",
    sumFormula: "Physics Used (PN Approximation)",
    txtFormulaIntro: "We use the Leading Order Post-Newtonian approximation. Key formulas:",
    eqLabel1: "Chirp Mass (Mc): Fundamental parameter.",
    eqLabel2: "Frequency Evolution f(τ): Rises as τ→0 approaches.",
    eqLabel3: "Amplitude h(t): Scales with Mc and distance D.",
    txtNote: "Note: Didactic simplification. LIGO uses complex numerical models (EOB/Phenom)."
  },
  fr: {
    subtitle: "Simulateur Éducatif de Formes d'Onde Post-Newtiniennes",
    controlsTitle: "Paramètres Binaires",
    helpM1: "Augmenter m1 réduit la durée mais augmente l'amplitude finale.",
    helpM2: "Le rapport de masse affecte la symétrie du signal.",
    helpSnr: "Faible SNR = difficile de distinguer le signal du bruit.",
    btnGen: "▶ Générer Signal Théorique",
    btnReal: "📂 Charger Données Réelles GW150914",
    legTheory: "— Théorie (Propre)",
    legObserved: "— Observé/Simulé (Bruit)",
    lblMc: "ℳ_c (Masse Chirp)",
    lblDur: "Durée Totale",
    lblFreq: "Fréq. Maximale",
    sumConcept: "Que voyez-vous ? (Concepts Physiques)",
    txtIntro: "Cet outil simule le signal de déformation (h) produit par la fusion de deux trous noirs.",
    sumFormula: "Physique Utilisée (Approximation PN)",
    txtFormulaIntro: "Nous utilisons l'approximation post-newtonienne d'ordre principal. Formules clés :",
    eqLabel1: "Masse Chirp (Mc): Paramètre fondamental.",
    eqLabel2: "Évolution Fréquence f(τ): Augmente quand τ→0 approche.",
    eqLabel3: "Amplitude h(t): Échelle avec Mc et distance D.",
    txtNote: "Note : Simplification didactique. LIGO utilise des modèles numériques complexes (EOB/Phenom)."
  }
};

function setLanguage(lang) {
  const t = translations[lang];
  if (!t) return;

  // Header & Controls
  document.getElementById('ui-subtitle').textContent = t.subtitle;
  document.getElementById('ui-controls-title').textContent = t.controlsTitle;
  document.getElementById('ui-help-m1').textContent = t.helpM1;
  document.getElementById('ui-help-m2').textContent = t.helpM2;
  document.getElementById('ui-help-snr').textContent = t.helpSnr;
  document.getElementById('btn-regenerate').textContent = t.btnGen;
  document.getElementById('btn-load-real').textContent = t.btnReal;
  
  // Legend
  document.getElementById('ui-leg-theory').textContent = t.legTheory;
  document.getElementById('ui-leg-observed').textContent = t.legObserved;
  
  // Metrics Labels
  document.getElementById('ui-lbl-mc').innerHTML = t.lblMc;
  document.getElementById('ui-lbl-dur').textContent = t.lblDur;
  document.getElementById('ui-lbl-freq').textContent = t.lblFreq;

  // Educational Sections
  document.getElementById('ui-sum-concept').textContent = t.sumConcept;
  document.getElementById('ui-txt-intro').textContent = t.txtIntro;
  
  document.getElementById('ui-sum-formula').textContent = t.sumFormula;
  document.getElementById('ui-txt-formula-intro').textContent = t.txtFormulaIntro;
  document.getElementById('ui-eq-label-1').textContent = t.eqLabel1;
  document.getElementById('ui-eq-label-2').textContent = t.eqLabel2;
  document.getElementById('ui-eq-label-3').textContent = t.eqLabel3;
  document.getElementById('ui-txt-note').textContent = t.txtNote;

  // Buttons State
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  
  document.documentElement.lang = lang;
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', (e) => setLanguage(e.target.dataset.lang));
  });
});
