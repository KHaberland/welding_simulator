/**
 * Canvas renderer — боковой вид (ТЗ §4–5). Этап 1: статичная геометрия + заглушки.
 */

/** @type {HTMLCanvasElement | null} */
let canvas = null;
/** @type {CanvasRenderingContext2D | null} */
let ctx = null;

/** Доли высоты canvas и относительные размеры (боковой вид). */
const SCENE = {
  plateHeightRatio: 0.3,
  nozzleTopRatio: 0.06,
  nozzleHeightRatio: 0.1,
  nozzleWidthRatio: 0.09,
  wireWidthRatio: 0.008,
  arcGapRatio: 0.055,
  poolHalfWidthRatio: 0.07,
  poolDepthRatio: 0.035,
  beadHalfWidthRatio: 0.055,
  beadHeightRatio: 0.02,
  penetrationDepthRatio: 0.1,
  penetrationHalfWidthRatio: 0.05,
};

/**
 * @param {HTMLCanvasElement} canvasEl
 */
export function initRenderer(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext("2d");
  resizeCanvas();
}

export function resizeCanvas() {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width * dpr));
  const h = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

/**
 * Статичная сцена бокового вида. State пока не используется (заглушки).
 * @param {object} [_state]
 */
export function renderCanvas(_state = {}) {
  if (!canvas || !ctx) return;
  resizeCanvas();

  const w = canvas.width;
  const h = canvas.height;
  const s = Math.min(w, h);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const plateH = Math.max(s * 0.18, h * SCENE.plateHeightRatio);
  const surfaceY = h - plateH;
  const cx = w * 0.5;

  drawBackground(w, h, surfaceY);
  drawPlate(w, surfaceY, plateH);
  drawPenetrationStub(cx, surfaceY, plateH, s);
  drawBeadStub(cx, surfaceY, s);
  drawPoolStub(cx, surfaceY, s);
  drawNozzleAndWire(cx, surfaceY, s, h);
  drawArcStub(cx, surfaceY, s);
}

/**
 * @param {number} w
 * @param {number} h
 * @param {number} surfaceY
 */
function drawBackground(w, h, surfaceY) {
  const g = ctx.createLinearGradient(0, 0, 0, surfaceY);
  g.addColorStop(0, "#151922");
  g.addColorStop(1, "#1c222c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, surfaceY);
}

/**
 * Пластина в разрезе — нижняя часть Canvas.
 * @param {number} w
 * @param {number} surfaceY
 * @param {number} plateH
 */
function drawPlate(w, surfaceY, plateH) {
  const metal = ctx.createLinearGradient(0, surfaceY, 0, surfaceY + plateH);
  metal.addColorStop(0, "#8a9098");
  metal.addColorStop(0.12, "#6a7078");
  metal.addColorStop(1, "#3a4048");
  ctx.fillStyle = metal;
  ctx.fillRect(0, surfaceY, w, plateH);

  ctx.strokeStyle = "#c8ced6";
  ctx.lineWidth = Math.max(2, plateH * 0.02);
  ctx.beginPath();
  ctx.moveTo(0, surfaceY);
  ctx.lineTo(w, surfaceY);
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, surfaceY, w, plateH);
  ctx.clip();
  ctx.strokeStyle = "rgba(20, 24, 30, 0.35)";
  ctx.lineWidth = 1;
  const step = Math.max(10, plateH * 0.12);
  for (let x = -plateH; x < w + plateH; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, surfaceY);
    ctx.lineTo(x + plateH, surfaceY + plateH);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Заглушка проплавления под ванной (в разрезе металла).
 */
function drawPenetrationStub(cx, surfaceY, plateH, s) {
  const halfW = s * SCENE.penetrationHalfWidthRatio;
  const depth = Math.min(s * SCENE.penetrationDepthRatio, plateH * 0.55);

  ctx.save();
  ctx.fillStyle = "rgba(40, 90, 160, 0.55)";
  ctx.strokeStyle = "rgba(120, 180, 255, 0.85)";
  ctx.lineWidth = Math.max(1.5, s * 0.003);
  ctx.setLineDash([s * 0.012, s * 0.008]);
  ctx.beginPath();
  ctx.moveTo(cx - halfW, surfaceY);
  ctx.quadraticCurveTo(cx, surfaceY + depth * 1.15, cx + halfW, surfaceY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * Заглушка сварочной ванны на поверхности.
 */
function drawPoolStub(cx, surfaceY, s) {
  const halfW = s * SCENE.poolHalfWidthRatio;
  const depth = s * SCENE.poolDepthRatio;

  const g = ctx.createRadialGradient(cx, surfaceY - depth * 0.4, s * 0.004, cx, surfaceY, halfW);
  g.addColorStop(0, "rgba(255, 220, 100, 0.9)");
  g.addColorStop(0.4, "rgba(230, 110, 30, 0.75)");
  g.addColorStop(1, "rgba(100, 30, 10, 0.25)");

  ctx.save();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, surfaceY - depth * 0.2, halfW, depth, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Заглушка валика слева от зоны дуги.
 */
function drawBeadStub(cx, surfaceY, s) {
  const halfW = s * SCENE.beadHalfWidthRatio;
  const bh = s * SCENE.beadHeightRatio;
  const left = cx - halfW * 3.4;

  ctx.save();
  ctx.fillStyle = "#5a626c";
  ctx.strokeStyle = "#2e343c";
  ctx.lineWidth = Math.max(1, s * 0.002);
  ctx.beginPath();
  ctx.moveTo(left, surfaceY);
  ctx.quadraticCurveTo(left + halfW * 0.5, surfaceY - bh, left + halfW, surfaceY - bh * 0.9);
  ctx.quadraticCurveTo(left + halfW * 1.5, surfaceY - bh * 0.35, left + halfW * 2.1, surfaceY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Сопло + вертикальная проволока 90° к поверхности.
 */
function drawNozzleAndWire(cx, surfaceY, s, h) {
  const nw = s * SCENE.nozzleWidthRatio;
  const nh = h * SCENE.nozzleHeightRatio;
  const top = h * SCENE.nozzleTopRatio;
  const wireW = Math.max(3, s * SCENE.wireWidthRatio);
  const arcGap = h * SCENE.arcGapRatio;

  const nozzleBottom = top + nh;
  const wireTop = nozzleBottom - s * 0.006;
  const wireTipY = surfaceY - arcGap;

  // усечённый корпус горелки над соплом
  ctx.fillStyle = "#4a5562";
  ctx.fillRect(cx - nw * 0.28, top - s * 0.025, nw * 0.56, s * 0.028);

  const nozzleGrad = ctx.createLinearGradient(cx - nw / 2, top, cx + nw / 2, top);
  nozzleGrad.addColorStop(0, "#2a3038");
  nozzleGrad.addColorStop(0.35, "#6a7480");
  nozzleGrad.addColorStop(0.65, "#9aa4b0");
  nozzleGrad.addColorStop(1, "#2a3038");
  ctx.fillStyle = nozzleGrad;
  ctx.beginPath();
  ctx.moveTo(cx - nw / 2, top);
  ctx.lineTo(cx + nw / 2, top);
  ctx.lineTo(cx + nw * 0.38, nozzleBottom);
  ctx.lineTo(cx - nw * 0.38, nozzleBottom);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#1a1e24";
  ctx.lineWidth = Math.max(1.5, s * 0.002);
  ctx.stroke();

  ctx.fillStyle = "#0c0e12";
  ctx.fillRect(cx - wireW * 1.6, nozzleBottom - s * 0.008, wireW * 3.2, s * 0.008);

  // проволока вертикально (90°)
  const wireLen = Math.max(0, wireTipY - wireTop);
  ctx.fillStyle = "#c0c6ce";
  ctx.fillRect(cx - wireW / 2, wireTop, wireW, wireLen);

  // расплавленный конец (заглушка)
  ctx.fillStyle = "#e8a040";
  ctx.beginPath();
  ctx.ellipse(cx, wireTipY, wireW * 1.1, wireW * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Заглушка дуги между концом проволоки и ванной.
 */
function drawArcStub(cx, surfaceY, s) {
  const h = canvas.height;
  const arcGap = h * SCENE.arcGapRatio;
  const tipY = surfaceY - arcGap;
  const midY = (tipY + surfaceY) / 2;
  const flare = s * 0.04;

  const g = ctx.createRadialGradient(cx, midY, s * 0.004, cx, midY, flare * 1.6);
  g.addColorStop(0, "rgba(255, 255, 220, 0.95)");
  g.addColorStop(0.3, "rgba(255, 180, 40, 0.8)");
  g.addColorStop(0.65, "rgba(80, 140, 255, 0.4)");
  g.addColorStop(1, "rgba(40, 80, 200, 0)");

  ctx.save();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.004, tipY);
  ctx.quadraticCurveTo(cx - flare, midY, cx - flare * 0.85, surfaceY - 2);
  ctx.quadraticCurveTo(cx, surfaceY + s * 0.008, cx + flare * 0.85, surfaceY - 2);
  ctx.quadraticCurveTo(cx + flare, midY, cx + s * 0.004, tipY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
