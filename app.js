const engine = new AudioEngine();

const playBtn = document.getElementById('playBtn');
const bpmInput = document.getElementById('bpm');
const cutoffInput = document.getElementById('cutoff');
const resInput = document.getElementById('resonance');
const decayInput = document.getElementById('decay');
const seqGrid = document.getElementById('sequencerGrid');

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
cutoffInput.addEventListener('input', (e) => engine.setParam('cutoff', e.target.value));
resInput.addEventListener('input', (e) => engine.setParam('resonance', e.target.value));
decayInput.addEventListener('input', (e) => engine.setParam('decay', e.target.value));
