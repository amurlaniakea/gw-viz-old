const translations = {
  es: {
    subtitle: "Simulador Educativo de Formas de Onda Post-Newtonianas",
    controlsTitle: "Parámetros Binarios",
    helpM1: "Aumentar m1 reduce la duración total pero aumenta la amplitud final.",
    helpM2: "Relación de masas afecta la simetría de la señal.",
    helpSnr: "SNR bajo = señal difícil de distinguir del ruido cuántico/termal.",
    btnGen: "▶ Generar Señal",
    legTheory: "— Teoría Pura (Limpia)",
    legObserved: "— Observado (Con Ruido)",
    lblMc: "𝑀_c (Masa Chirp)",
    lblDur: "Duración Inspirals",
    lblFreq: "Frecuencia Final",
    sumConcept: "¿Qué estás viendo? (Conceptos Físicos)",
    txtIntro: "Esta herramienta simula la señal de strain (h) producida por la fusión de dos agujeros negros o estrellas de neutrones.",
    sumFormula: "Física Utilizada (Aproximación PN)",
    txtFormulaIntro: "Para fines educativos, usamos la aproximación Leading Order Post-Newtoniana. Las fórmulas clave son:",
    txtNote: "Nota: Esta es una simplificación didáctica. LIGO usa modelos numéricos complejos (Numerical Relativity + EOB/Phenom)."
  },
  en: {
    subtitle: "Educational Simulator of Post-Newtonian Waveforms",
    controlsTitle: "Binary Parameters",
    helpM1: "Increasing m1 reduces total duration but increases final amplitude.",
    helpM2: "Mass ratio affects signal symmetry.",
    helpSnr: "Low SNR = signal hard to distinguish from quantum/thermal noise.",
    btnGen: "▶ Generate Signal",
    legTheory: "— Pure Theory (Clean)",
    legObserved: "— Observed (With Noise)",
    lblMc: "ℳ_c (Chirp Mass)",
    lblDur: "Inspiral Duration",
    lblFreq: "Final Frequency",
    sumConcept: "What are you seeing? (Physical Concepts)",
    txtIntro: "This tool simulates the strain (h) signal produced by the merger of two black holes or neutron stars.",
    sumFormula: "Physics Used (PN Approximation)",
    txtFormulaIntro: "For educational purposes, we use the Leading Order Post-Newtonian approximation. Key formulas are:",
    txtNote: "Note: This is a didactic simplification. LIGO uses complex numerical models (Numerical Relativity + EOB/Phenom)."
  },
  fr: {
    subtitle: "Simulateur Éducatif de Formes d'Onde Post-Newtiniennes",
    controlsTitle: "Paramètres Binaires",
    helpM1: "Augmenter m1 réduit la durée totale mais augmente l'amplitude finale.",
    helpM2: "Le rapport de masse affecte la symétrie du signal.",
    helpSnr: "Faible SNR = signal difficile à distinguer du bruit quantique/thermique.",
    btnGen: "▶ Générer Signal",
    legTheory: "— Théorie Pure (Propre)",
    legObserved: "— Observé (Avec Bruit)",
    lblMc: "ℳ_c (Masse Chirp)",
    lblDur: "Durée Inspiral",
    lblFreq: "Fréquence Finale",
    sumConcept: "Que voyez-vous ? (Concepts Physiques)",
    txtIntro: "Cet outil simule le signal de déformation (h) produit par la fusion de deux trous noirs ou étoiles à neutrons.",
    sumFormula: "Physique Utilisée (Approximation PN)",
    txtFormulaIntro: "À des fins éducatives, nous utilisons l'approximation post-newtonienne d'ordre principal. Les formules clés sont :",
    txtNote: "Note : Ceci est une simplification didactique. LIGO utilise des modèles numériques complexes (Relativité Numérique + EOB/Phenom)."
  }
};

function setLanguage(lang) {
  const t = translations[lang];
  if (!t) return;

  // Update DOM elements
  document.getElementById('ui-subtitle').textContent = t.subtitle;
  document.getElementById('ui-controls-title').textContent = t.controlsTitle;
  document.getElementById('ui-help-m1').textContent = t.helpM1;
  document.getElementById('ui-help-m2').textContent = t.helpM2;
  document.getElementById('ui-help-snr').textContent = t.helpSnr;
  document.getElementById('ui-btn-gen').textContent = t.btnGen;
  document.getElementById('ui-leg-theory').textContent = t.legTheory;
  document.getElementById('ui-leg-observed').textContent = t.legObserved;
  document.getElementById('ui-lbl-mc').innerHTML = t.lblMc;
  document.getElementById('ui-lbl-dur').textContent = t.lblDur;
  document.getElementById('ui-lbl-freq').textContent = t.lblFreq;
  
  document.getElementById('ui-sum-concept').textContent = t.sumConcept;
  document.getElementById('ui-txt-intro').textContent = t.txtIntro;
  
  document.getElementById('ui-sum-formula').textContent = t.sumFormula;
  document.getElementById('ui-txt-formula-intro').textContent = t.txtFormulaIntro;
  document.getElementById('ui-txt-note').textContent = t.txtNote;

  // Update buttons state
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  
  // Set html lang attribute
  document.documentElement.lang = lang;
}

// Initialize listeners for language buttons
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      setLanguage(e.target.dataset.lang);
    });
  });
});
