/**

 * Canvas renderer — боковой вид (ТЗ §4–5). Этап 3: FSM + капля + дуга.

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

 * @param {object} st

 */

export function renderCanvas(st = {}) {

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

  const stickBase = 15;

  const stickOut = st.stickOut != null ? st.stickOut : stickBase;

  const stickScale = stickOut / stickBase;

  const arcGap = h * SCENE.arcGapRatio * stickScale;

  const gapNorm = st.wireGapNorm != null ? st.wireGapNorm : 1;

  const tipY = surfaceY - arcGap * Math.max(0, gapNorm);



  drawBackground(w, h, surfaceY);

  drawPlate(w, surfaceY, plateH);

  drawPenetrationStub(cx, surfaceY, plateH, s);

  drawBeadStub(cx, surfaceY, s);

  drawPoolStub(cx, surfaceY, s, st);

  drawNozzleAndWire(cx, surfaceY, s, h, tipY, st);

  drawContactGlow(cx, surfaceY, s, st);

  drawArc(cx, tipY, surfaceY, s, st);

  drawDroplets(cx, tipY, surfaceY, s, st);

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

 * @param {number} cx

 * @param {number} surfaceY

 * @param {number} s

 * @param {object} st

 */

function drawPoolStub(cx, surfaceY, s, st) {

  const halfW = s * SCENE.poolHalfWidthRatio;

  const depth = s * SCENE.poolDepthRatio;

  const lit = st.welding ? 0.55 + 0.45 * (st.arcIntensity || 0) : 0.35;



  const g = ctx.createRadialGradient(cx, surfaceY - depth * 0.4, s * 0.004, cx, surfaceY, halfW);

  g.addColorStop(0, `rgba(255, 220, 100, ${0.5 + 0.4 * lit})`);

  g.addColorStop(0.4, `rgba(230, 110, 30, ${0.4 + 0.35 * lit})`);

  g.addColorStop(1, "rgba(100, 30, 10, 0.25)");



  ctx.save();

  ctx.fillStyle = g;

  ctx.beginPath();

  ctx.ellipse(cx, surfaceY - depth * 0.2, halfW, depth, 0, 0, Math.PI * 2);

  ctx.fill();

  ctx.restore();

}



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

 * @param {number} cx

 * @param {number} surfaceY

 * @param {number} s

 * @param {number} h

 * @param {number} tipY

 * @param {object} st

 */

function drawNozzleAndWire(cx, surfaceY, s, h, tipY, st) {

  const nw = s * SCENE.nozzleWidthRatio;

  const nh = h * SCENE.nozzleHeightRatio;

  const stickBase = 15;

  const stickOut = st.stickOut != null ? st.stickOut : stickBase;

  // Больше stick-out → сопло выше (длиннее видимый вылет проволоки).

  const stickLift = ((stickOut - stickBase) / stickBase) * h * 0.045;

  const top = h * SCENE.nozzleTopRatio - stickLift;

  const wireW = Math.max(3, s * SCENE.wireWidthRatio);



  const nozzleBottom = top + nh;

  const wireTop = nozzleBottom - s * 0.006;



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



  const wireLen = Math.max(0, tipY - wireTop);

  ctx.fillStyle = "#c0c6ce";

  ctx.fillRect(cx - wireW / 2, wireTop, wireW, wireLen);



  // расплавленный конец

  const heat = Math.max(st.contactGlow || 0, (st.arcIntensity || 0) * 0.7);

  const tipR = wireW * (1.1 + 0.4 * heat);

  ctx.fillStyle =
    heat > 0.2
      ? `rgb(${(200 + 55 * heat) | 0},${(120 + 40 * heat) | 0},40)`
      : "#e8a040";

  ctx.beginPath();

  ctx.ellipse(cx, tipY, tipR, tipR * 0.85, 0, 0, Math.PI * 2);

  ctx.fill();

}



/**

 * @param {number} cx

 * @param {number} surfaceY

 * @param {number} s

 * @param {object} st

 */

function drawContactGlow(cx, surfaceY, s, st) {

  const g = st.contactGlow || 0;

  if (g < 0.05) return;

  const r = s * (0.025 + 0.04 * g);

  const grad = ctx.createRadialGradient(cx, surfaceY, 0, cx, surfaceY, r);

  grad.addColorStop(0, `rgba(255, 240, 180, ${0.9 * g})`);

  grad.addColorStop(0.45, `rgba(255, 140, 40, ${0.55 * g})`);

  grad.addColorStop(1, "rgba(255, 80, 0, 0)");

  ctx.fillStyle = grad;

  ctx.beginPath();

  ctx.arc(cx, surfaceY, r, 0, Math.PI * 2);

  ctx.fill();

}



/**

 * @param {number} cx

 * @param {number} tipY

 * @param {number} surfaceY

 * @param {number} s

 * @param {object} st

 */

function drawArc(cx, tipY, surfaceY, s, st) {

  const inten = st.arcIntensity || 0;

  if (inten < 0.05 || tipY >= surfaceY - 1) return;



  const midY = (tipY + surfaceY) / 2;

  const flare = s * 0.04 * (0.7 + 0.5 * inten);



  const g = ctx.createRadialGradient(cx, midY, s * 0.004, cx, midY, flare * 1.6);

  g.addColorStop(0, `rgba(255, 255, 220, ${0.95 * inten})`);

  g.addColorStop(0.3, `rgba(255, 180, 40, ${0.8 * inten})`);

  g.addColorStop(0.65, `rgba(80, 140, 255, ${0.4 * inten})`);

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



/**

 * Капля: y 0 = кончик проволоки, 1 = поверхность ванны (ТЗ §38).

 * @param {number} cx

 * @param {number} tipY

 * @param {number} surfaceY

 * @param {number} s

 * @param {object} st

 */

function drawDroplets(cx, tipY, surfaceY, s, st) {

  const list = st.droplets;

  if (!list || !list.length) return;

  const span = Math.max(1, surfaceY - tipY);

  const baseR = Math.max(3, s * SCENE.wireWidthRatio * 1.8);



  for (const d of list) {

    const y = tipY + span * (d.y || 0);

    const r = baseR * Math.max(0.2, d.radius || 0.5);

    const temp = d.temperature != null ? d.temperature : 0.7;

    const g = ctx.createRadialGradient(cx - r * 0.25, y - r * 0.25, r * 0.1, cx, y, r);

    g.addColorStop(0, `rgba(255, ${(200 + 40 * temp) | 0}, ${(80 + 40 * temp) | 0}, 0.95)`);

    g.addColorStop(0.6, `rgba(220, 100, 20, 0.9)`);

    g.addColorStop(1, `rgba(120, 40, 10, 0.5)`);

    ctx.fillStyle = g;

    ctx.beginPath();

    ctx.ellipse(cx, y, r, r * 0.9, 0, 0, Math.PI * 2);

    ctx.fill();

  }

}

