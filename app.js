const engine = new AudioEngine();

// Contrôles globaux
const playBtn = document.getElementById('playBtn');
const bpmInput = document.getElementById('bpm');
const seqGrid = document.getElementById('sequencerGrid');

// Initialisation Séquenceur
for (let i = 0; i < 16; i++) {
  const btn = document.createElement('button');
  btn.className = 'step-btn';
  btn.innerText = (i + 1).toString().padStart(2, '0');
  btn.addEventListener('click', () => {
    const active = engine.toggleStep(i);
    btn.classList.toggle('active', active);
  });
  seqGrid.appendChild(btn);
}

engine.onStepTick = (stepIndex) => {
  const stepButtons = seqGrid.children;
  for (let i = 0; i < stepButtons.length; i++) {
    stepButtons[i].classList.toggle('current', i === stepIndex);
  }
};

playBtn.addEventListener('click', () => {
  if (engine.isPlaying) {
    engine.stop();
    playBtn.innerText = 'PLAY';
  } else {
    engine.start();
    playBtn.innerText = 'STOP';
  }
});

bpmInput.addEventListener('input', (e) => engine.setBpm(e.target.value));

// Composant Rotary Knob style Ableton Live
class AbletonKnob {
  constructor(el) {
    this.el = el;
    this.param = el.dataset.param;
    this.min = parseFloat(el.dataset.min);
    this.max = parseFloat(el.dataset.max);
    this.val = parseFloat(el.dataset.val);
    this.step = parseFloat(el.dataset.step) || 1;
    this.unit = el.dataset.unit || '';
    this.label = el.dataset.label || '';
    this.defaultVal = this.val;

    this.render();
    this.attachEvents();
    this.update();
  }

  render() {
    this.el.innerHTML = `
      <canvas class="knob-canvas" width="88" height="88"></canvas>
      <span class="knob-label">${this.label}</span>
      <span class="knob-val"></span>
    `;
    this.canvas = this.el.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.valDisplay = this.el.querySelector('.knob-val');
  }

  getNormalized() {
    return (this.val - this.min) / (this.max - this.min);
  }

  update() {
    engine.setParam(this.param, this.val);

    // Affichage texte
    let display = this.val >= 1000 && this.unit === 'Hz' ? (this.val / 1000).toFixed(1) + 'k' : this.val.toFixed(this.step < 0.1 ? 3 : this.step < 1 ? 2 : 0);
    this.valDisplay.innerText = `${display} ${this.unit}`.trim();

    // Rendu graphique Ableton
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = 32;

    ctx.clearRect(0, 0, w, h);

    const startAngle = 0.75 * Math.PI;
    const endAngle = 2.25 * Math.PI;
    const currentAngle = startAngle + this.getNormalized() * (endAngle - startAngle);

    // Track de fond
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#2f323a';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Arc actif
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, currentAngle);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#00ff88';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Curseur central
    const pointerR = r - 10;
    const px = cx + pointerR * Math.cos(currentAngle);
    const py = cy + pointerR * Math.sin(currentAngle);
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  attachEvents() {
    let startY = 0;
    let startVal = 0;

    const onPointerMove = (e) => {
      const deltaY = startY - e.clientY;
      const speed = e.shiftKey ? 0.001 : 0.005;
      const range = this.max - this.min;
      let newVal = startVal + deltaY * range * speed;
      newVal = Math.max(this.min, Math.min(this.max, newVal));
      
      const invStep = 1 / this.step;
      this.val = Math.round(newVal * invStep) / invStep;
      this.update();
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    this.el.addEventListener('pointerdown', (e) => {
      startY = e.clientY;
      startVal = this.val;
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });

    this.el.addEventListener('dblclick', () => {
      this.val = this.defaultVal;
      this.update();
    });
  }
}

// Instanciation de tous les potentiomètres
document.querySelectorAll('.knob-wrap').forEach((el) => new AbletonKnob(el));
