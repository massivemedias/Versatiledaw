class AudioEngine {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.bpm = 124;
    this.currentStep = 0;
    this.nextStepTime = 0;
    this.timerId = null;
    this.steps = new Array(16).fill(false);

    // Paramètres sonores ADSR et Filtre
    this.params = {
      filterCutoff: 1200,
      filterRes: 6,
      filterEnvAmt: 4000,
      fAttack: 0.005,
      fDecay: 0.18,
      fSustain: 0.1,
      fRelease: 0.15,
      ampAttack: 0.005,
      ampDecay: 0.22,
      ampSustain: 0.0,
      ampRelease: 0.08
    };

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
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const amp = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(55, time); // Note A1

    // Calculs Filtre + Enveloppe Filtre
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(this.params.filterRes, time);

    const baseCutoff = Math.max(20, this.params.filterCutoff);
    const peakCutoff = Math.max(20, Math.min(20000, baseCutoff + this.params.filterEnvAmt));
    const susCutoff = Math.max(20, Math.min(20000, baseCutoff + (this.params.filterEnvAmt * this.params.fSustain)));

    const gateDuration = stepDuration * 0.8;
    const fAttTime = time + this.params.fAttack;
    const fDecTime = fAttTime + this.params.fDecay;
    const relStartTime = time + gateDuration;
    const endFilterTime = relStartTime + this.params.fRelease;

    filter.frequency.setValueAtTime(baseCutoff, time);
    filter.frequency.exponentialRampToValueAtTime(peakCutoff, fAttTime);
    filter.frequency.exponentialRampToValueAtTime(susCutoff, fDecTime);
    filter.frequency.setValueAtTime(susCutoff, relStartTime);
    filter.frequency.exponentialRampToValueAtTime(baseCutoff, endFilterTime);

    // Calculs Amplitude ADSR
    const aAttTime = time + this.params.ampAttack;
    const aDecTime = aAttTime + this.params.ampDecay;
    const susGain = Math.max(0.0001, this.params.ampSustain * 0.8);
    const endAmpTime = relStartTime + this.params.ampRelease;

    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(0.8, aAttTime);
    amp.gain.exponentialRampToValueAtTime(susGain, aDecTime);
    amp.gain.setValueAtTime(susGain, relStartTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, endAmpTime);

    // Routage
    osc.connect(filter);
    filter.connect(amp);
    amp.connect(this.ctx.destination);

    const totalDuration = Math.max(endFilterTime, endAmpTime) - time;
    osc.start(time);
    osc.stop(time + totalDuration + 0.05);
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
