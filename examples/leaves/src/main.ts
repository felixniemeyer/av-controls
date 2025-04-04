import './style.css'

import { BranchRenderer } from './branchRenderer';

const canvas = document.querySelector('#webgl') as HTMLCanvasElement;
const gl = canvas.getContext('webgl2', {
  preserveDrawingBuffer: true,
  premultipliedAlpha: false,
  alpha: false,
});

if(!gl) {
  throw new Error('Failed to create WebGL2 context');
}

// Initialize the BranchRenderer
const branchRenderer = new BranchRenderer(gl, 100);

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  branchRenderer.resize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', resize);

resize();

const timeScale = 1
const t0 = performance.now();
let now = 0;
const mainLoop = () => {
  const newNow = (performance.now() - t0) * 0.001;
  const deltaTime = newNow - now;
  now = newNow;
  branchRenderer.update(deltaTime * timeScale);
  branchRenderer.render();
  requestAnimationFrame(mainLoop);
};

mainLoop();