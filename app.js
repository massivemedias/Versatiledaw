const engine = new AudioEngine();
const knobRegistry = [];

// Définitions des 5 Presets Moog
const MOOG_PRESETS = {
  minimoog: {
    osc1Wave: 'sawtooth',
    osc2Wave: 'sawtooth',
    params: {
      osc1Octave: 0,
      osc2Octave: 0,
      osc2Detune: 8,
      oscMix: 0.5,
      subLevel: 0.4,
      drive: 2.8,
      filterCutoff: 650,
      filterRes: 7.5,
      filterEnvAmt: 4200,
      fAttack: 0.005,
      fDecay: 0.22,
      fSustain: 0.05,
      fRelease: 0.12,
      ampAttack: 0.005,
      ampDecay: 0.24,
      ampSustain: 0.0,
      ampRelease: 0.08
    }
  },
  sub37: {
    osc1Wave: 'sawtooth',
    osc2Wave: 'square',
    params: {
      osc1Octave: 0,
      osc2Octave: -1,
      osc2Detune: 12,
      oscMix: 0.6,
      subLevel: 0.5,
      drive: 7.2,
      filterCutoff: 1200,
      filterRes: 9.0,
      filterEnvAmt: 5000,
      fAttack: 0.008,
      fDecay: 0.18,
      fSustain: 0.1,
      fRelease: 0.15,
      ampAttack: 0.005,
      ampDecay: 0.2,
      ampSustain: 0.1,
      ampRelease: 0.1
    }
  },
  taurus: {
    osc1Wave: 'sawtooth',
    osc2Wave: 'sawtooth',
    params: {
      osc1Octave: -1,
      osc2Octave: -1,
      osc2Detune: 4,
      oscMix: 0.5,
      subLevel: 0.7,
      drive: 1.5,
      filterCutoff: 380,
      filterRes: 2.5,
      filterEnvAmt: 1800,
      fAttack: 0.02,
      fDecay: 0.45,
      fSustain: 0.4,
      fRelease: 0.35,
      ampAttack: 0.02,
      ampDecay: 0.5,
      ampSustain: 0.4,
      ampRelease: 0.3
    }
  },
  grandmother: {
    osc1Wave: 'triangle',
    osc2Wave: 'square',
    params: {
      osc1Octave: 0,
      osc2Octave: 1,
      osc2Detune: 3,
      oscMix: 0.45,
      subLevel: 0.1,
      drive: 3.5,
      filterCutoff: 1800,
      filterRes: 11.0,
      filterEnvAmt: 3200,
      fAttack: 0.001,
      fDecay: 0.14,
      fSustain: 0.0,
      fRelease: 0.08,
      ampAttack: 0.001,
      ampDecay: 0.15,
      ampSustain: 0.0,
      ampRelease: 0.06
    }
  },
  mother32: {
    osc1Wave: 'sawtooth',
    osc2Wave: 'square',
    params: {
      osc1Octave: 0,
      osc2Octave: 0,
      osc2Detune: 0,
      oscMix: 0.2,
      subLevel: 0.2,
      drive: 4.8,
      filterCutoff: 850,
      filterRes: 13.5,
      filterEnvAmt: 5500,
      fAttack: 0.002,
      fDecay: 0.16,
      fSustain: 0.0,
      fRelease: 0.1,
      ampAttack: 0.002,
      ampDecay: 0.18,
      ampSustain: 0.0,
      ampRelease: 0.08
    }
  }
};

// Contrôles UI Globaux
const playBtn = document.getElementById('playBtn');
const bpmInput = document.getElementById('bpm');
const presetSelect = document.getElementById('presetSelect');
const osc1Wave = document.getElementById('osc1Wave');
const osc2Wave = document.getElementById('osc2Wave');
const seqGrid = document.getElementById('sequencerGrid');

// Initialisation Séquenceur 16 pas
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

osc1Wave.addEventListener('change', (e) => { engine.osc1Wave = e.target.value; });
osc2Wave.addEventListener('change', (e) => { engine.osc2Wave = e.target.value; });

// Composant Rotary Knob Ableton
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
    knobRegistry.push(this);
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

  setValue(newVal) {
    this.val = Math.max(this.min, Math.min(this.max, newVal));
    this.update();
  }

  update() {
    engine.setParam(this.param, this.val);

    let display = this.val >= 1000 && this.unit === 'Hz' ? (this.val / 1000).toFixed(1) + 'k' : this.val.toFixed(this.step < 0.1 ? 3 : this.step < 1 ? 2 : 0);
    this.valDisplay.innerText = `${display} ${this.unit}`.trim();

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

    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#2a2d36';
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, currentAngle);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ff8800';
    ctx.lineCap = 'round';
    ctx.stroke();

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
      this.setValue(this.defaultVal);
    });
  }
}

// Initialisation des potentiomètres
document.querySelectorAll('.knob-wrap').forEach((el) => new AbletonKnob(el));

// Gestion du chargement des Presets
function loadPreset(presetKey) {
  const preset = MOOG_PRESETS[presetKey];
  if (!preset) return;

  osc1Wave.value = preset.osc1Wave;
  osc2Wave.value = preset.osc2Wave;
  engine.osc1Wave = preset.osc1Wave;
  engine.osc2Wave = preset.osc2Wave;

  for (const [key, value] of Object.entries(preset.params)) {
    engine.setParam(key, value);
    const knob = knobRegistry.find(k => k.param === key);
    if (knob) {
      knob.setValue(value);
    }
  }
}

presetSelect.addEventListener('change', (e) => {
  loadPreset(e.target.value);
});

// Chargement initial du Minimoog
loadPreset('minimoog');
