import { initRenderer, renderCanvas, resizeCanvas } from "./renderer.js";

const canvas = document.getElementById("weld-canvas");

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Canvas #weld-canvas не найден");
}

initRenderer(canvas);
renderCanvas({});

window.addEventListener("resize", () => {
  resizeCanvas();
  renderCanvas({});
});

function loop() {
  renderCanvas({});
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
