class AudioEngine {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.bpm = 124;
    this.currentStep = 0;
    this.nextStepTime = 0;
    this.timerId = null;
    this.steps = new Array(16).fill(false);

    this.params = {
      cutoff: 1500,
      resonance: 6,
      decay: 0.2
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
    this.bpm = Math.max(40, Math.min(300, Number(value)));
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

  playVoice(time) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const amp = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(55, time);

    filter.type = 'lowpass';
    filter.Q.setValueAtTime(this.params.resonance, time);
    filter.frequency.setValueAtTime(this.params.cutoff, time);
    filter.frequency.exponentialRampToValueAtTime(80, time + this.params.decay);

    amp.gain.setValueAtTime(0.7, time);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + this.params.decay + 0.05);

    osc.connect(filter);
    filter.connect(amp);
    amp.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + this.params.decay + 0.05);
  }

  scheduler() {
    while (this.nextStepTime < this.ctx.currentTime + 0.1) {
      if (this.steps[this.currentStep]) {
        this.playVoice(this.nextStepTime);
      }
      if (this.onStepTick) {
        this.onStepTick(this.currentStep);
      }
      const secondsPerStep = (60 / this.bpm) / 4;
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
