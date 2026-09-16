import { initRenderer, renderCanvas, resizeCanvas } from "./renderer.js";
import { initControls, updateControlsDisplay } from "./controls.js";
import { state, updateWeldingModel } from "./welding-model.js";
import { updateArc } from "./arc-model.js";

const canvas = document.getElementById("weld-canvas");
const panel = document.getElementById("controls-panel");

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Canvas #weld-canvas не найден");
}
if (!(panel instanceof HTMLElement)) {
  throw new Error("Панель #controls-panel не найдена");
}

initRenderer(canvas);
initControls(panel);
renderCanvas(state);

window.addEventListener("resize", () => {
  resizeCanvas();
  renderCanvas(state);
});

function loop(time) {
  updateWeldingModel(time);
  updateArc(state, time);
  updateControlsDisplay();
  renderCanvas(state);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
