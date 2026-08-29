class AudioEngine {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.bpm = 124;
    this.currentStep = 0;
    this.nextStepTime = 0;
    this.timerId = null;
    this.steps = new Array(16).fill(false);

    // Paramètres audio initiaux
    this.osc1Wave = 'sawtooth';
    this.osc2Wave = 'sawtooth';

    this.params = {
      osc1Octave: 0,
      osc2Octave: 0,
      osc2Detune: 7, // Cents
      oscMix: 0.5,   // Balance Osc1 vs Osc2
      subLevel: 0.3, // Sub Osc 1 octave down
      drive: 2.5,    // Saturation non-linéaire Ladder
      filterCutoff: 900,
      filterRes: 7,
      filterEnvAmt: 3500,
      fAttack: 0.005,
      fDecay: 0.22,
      fSustain: 0.05,
      fRelease: 0.12,
      ampAttack: 0.005,
      ampDecay: 0.25,
      ampSustain: 0.0,
      ampRelease: 0.08
    };

    this.distortionCurve = this.makeDistortionCurve(1024);
    this.onStepTick = null;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Modélisation de la courbe de distorsion non-linéaire (tanh) du mixer Moog
  makeDistortionCurve(samples) {
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; ++i) {
      const x = (i * 2) / samples - 1;
      curve[i] = Math.tanh(x * 1.8);
    }
    return curve;
  }

  setBpm(value) {
    this.bpm = Math.max(40, Math.min(240, Number(value)));
  }

  setParam(key, value) {
    if (key in this.params) {
      this.params[key] = Number(value);
    }
  }

  toggleStep(index) {
    this.steps[index] = !this.steps[index];
    return this.steps[index];
  }

  playVoice(time, stepDuration) {
    const baseFreq = 55; // Note A1 (55 Hz)

    // Calcul des fréquences avec octaves et dérives
    const osc1Freq = baseFreq * Math.pow(2, this.params.osc1Octave);
    const osc2Freq = (baseFreq * Math.pow(2, this.params.osc2Octave)) * Math.pow(2, this.params.osc2Detune / 1200);
    const subFreq = osc1Freq * 0.5;

    // 1. Oscillateurs
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const subOsc = this.ctx.createOscillator();

    osc1.type = this.osc1Wave;
    osc2.type = this.osc2Wave;
    subOsc.type = 'triangle'; // Sub-oscillateur analogique pur

    osc1.frequency.setValueAtTime(osc1Freq, time);
    osc2.frequency.setValueAtTime(osc2Freq, time);
    subOsc.frequency.setValueAtTime(subFreq, time);

    // 2. Mixer de sommation et niveaux
    const osc1Gain = this.ctx.createGain();
    const osc2Gain = this.ctx.createGain();
    const subGain = this.ctx.createGain();
    const mixerSum = this.ctx.createGain();

    osc1Gain.gain.setValueAtTime(1 - this.params.oscMix, time);
    osc2Gain.gain.setValueAtTime(this.params.oscMix, time);
    subGain.gain.setValueAtTime(this.params.subLevel, time);

    osc1.connect(osc1Gain);
    osc2.connect(osc2Gain);
    subOsc.connect(subGain);

    osc1Gain.connect(mixerSum);
    osc2Gain.connect(mixerSum);
    subGain.connect(mixerSum);

    // 3. Étage de Drive / Saturation pré-filtre
    const drivePreGain = this.ctx.createGain();
    const shaper = this.ctx.createWaveShaper();
    const drivePostGain = this.ctx.createGain();

    const driveAmount = Math.max(1, this.params.drive);
    drivePreGain.gain.setValueAtTime(driveAmount, time);
    shaper.curve = this.distortionCurve;
    shaper.oversample = '4x';
    drivePostGain.gain.setValueAtTime(1 / Math.sqrt(driveAmount), time);

    mixerSum.connect(drivePreGain);
    drivePreGain.connect(shaper);
    shaper.connect(drivePostGain);

    // 4. Moog Ladder Filter Emulation (Cascade 2 pôles x 2 = 24dB/oct 4 pôles)
    const ladder1 = this.ctx.createBiquadFilter();
    const ladder2 = this.ctx.createBiquadFilter();

    ladder1.type = 'lowpass';
    ladder2.type = 'lowpass';

    // Répartition de la résonance Moog sur les 4 pôles
    const poleQ = Math.max(0.7, Math.sqrt(this.params.filterRes));
    ladder1.Q.setValueAtTime(poleQ, time);
    ladder2.Q.setValueAtTime(poleQ, time);

    const baseCutoff = Math.max(20, this.params.filterCutoff);
    const peakCutoff = Math.max(20, Math.min(18000, baseCutoff + this.params.filterEnvAmt));
    const susCutoff = Math.max(20, Math.min(18000, baseCutoff + (this.params.filterEnvAmt * this.params.fSustain)));

    const gateDuration = stepDuration * 0.8;
    const fAttTime = time + this.params.fAttack;
    const fDecTime = fAttTime + this.params.fDecay;
    const relStartTime = time + gateDuration;
    const endFilterTime = relStartTime + this.params.fRelease;

    // Enveloppe VCF
    [ladder1, ladder2].forEach(filter => {
      filter.frequency.setValueAtTime(baseCutoff, time);
      filter.frequency.exponentialRampToValueAtTime(peakCutoff, fAttTime);
      filter.frequency.exponentialRampToValueAtTime(susCutoff, fDecTime);
      filter.frequency.setValueAtTime(susCutoff, relStartTime);
      filter.frequency.exponentialRampToValueAtTime(baseCutoff, endFilterTime);
    });

    drivePostGain.connect(ladder1);
    ladder1.connect(ladder2);

    // 5. Enveloppe VCA d'amplitude
    const amp = this.ctx.createGain();
    const aAttTime = time + this.params.ampAttack;
    const aDecTime = aAttTime + this.params.ampDecay;
    const susGain = Math.max(0.0001, this.params.ampSustain * 0.7);
    const endAmpTime = relStartTime + this.params.ampRelease;

    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(0.7, aAttTime);
    amp.gain.exponentialRampToValueAtTime(susGain, aDecTime);
    amp.gain.setValueAtTime(susGain, relStartTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, endAmpTime);

    ladder2.connect(amp);
    amp.connect(this.ctx.destination);

    const totalDuration = Math.max(endFilterTime, endAmpTime) - time;
    osc1.start(time);
    osc2.start(time);
    subOsc.start(time);

    osc1.stop(time + totalDuration + 0.05);
    osc2.stop(time + totalDuration + 0.05);
    subOsc.stop(time + totalDuration + 0.05);
  }

  scheduler() {
    const secondsPerStep = (60 / this.bpm) / 4;
    while (this.nextStepTime < this.ctx.currentTime + 0.1) {
      if (this.steps[this.currentStep]) {
        this.playVoice(this.nextStepTime, secondsPerStep);
      }
      if (this.onStepTick) {
        this.onStepTick(this.currentStep);
      }
      this.nextStepTime += secondsPerStep;
      this.currentStep = (this.currentStep + 1) % 16;
    }
    this.timerId = setTimeout(() => this.scheduler(), 25);
  }

  start() {
    this.init();
    this.isPlaying = true;
    this.currentStep = 0;
    this.nextStepTime = this.ctx.currentTime;
    this.scheduler();
  }

  stop() {
    this.isPlaying = false;
    clearTimeout(this.timerId);
    this.currentStep = 0;
  }
}
