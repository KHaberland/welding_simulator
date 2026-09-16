/**
 * Поворотная ручка: шкала 7h–17h, подписи, pointer-drag (v2 § этап 2–3).
 */

import { UI_CONFIG } from "./data.js";

const NS = "http://www.w3.org/2000/svg";
let knobUid = 0;

/**
 * @param {string} name
 * @param {Record<string, string | number>} attrs
 * @param {SVGElement | null} [parent]
 */
function svgEl(name, attrs, parent) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, String(value));
  }
  parent?.appendChild(node);
  return node;
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @param {number} step
 */
function snap(value, min, max, step) {
  const clamped = Math.min(max, Math.max(min, value));
  const n = Math.round((clamped - min) / step) * step + min;
  return Number(Math.min(max, Math.max(min, n)).toFixed(1));
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function valueToDeg(value, min, max) {
  const t = (value - min) / (max - min);
  return UI_CONFIG.knobStartDeg + t * UI_CONFIG.knobSweepDeg;
}

/**
 * Угол от 12h по часовой, градусы 0…360.
 * @param {PointerEvent} event
 * @param {DOMRect} rect
 */
function pointerDeg(event, rect) {
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

/**
 * @param {number} from
 * @param {number} to
 */
function shortestDelta(from, to) {
  let d = to - from;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

/**
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @param {number} deg
 */
function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

/**
 * @param {SVGElement} ticks
 * @param {number} min
 * @param {number} max
 * @param {number[]} labels
 * @param {number} minorStep
 */
function drawTicks(ticks, min, max, labels, minorStep) {
  const majorSet = new Set(labels.map((n) => Number(n.toFixed(4))));
  for (let v = min; v <= max + 1e-9; v += minorStep) {
    const value = Number(v.toFixed(4));
    const major = majorSet.has(value);
    const deg = valueToDeg(value, min, max);
    const inner = polar(50, 50, major ? 34 : 38, deg);
    const outer = polar(50, 50, 44, deg);
    svgEl(
      "line",
      {
        x1: inner.x,
        y1: inner.y,
        x2: outer.x,
        y2: outer.y,
        stroke: major ? "#c5ccd6" : "#6b7380",
        "stroke-width": major ? 1.6 : 1,
        "stroke-linecap": "round",
      },
      ticks
    );
  }
}

/**
 * @param {SVGElement} group
 * @param {number} min
 * @param {number} max
 * @param {number[]} labels
 * @param {string} unit
 */
function drawLabels(group, min, max, labels, unit) {
  for (const n of labels) {
    const deg = valueToDeg(n, min, max);
    const isUnit = Boolean(unit) && Number(n) === Number(max);
    const pos = polar(50, 50, isUnit ? 56 : 53.5, deg);
    const node = svgEl(
      "text",
      {
        x: pos.x.toFixed(2),
        y: pos.y.toFixed(2),
        fill: "#d7dde6",
        "font-size": "11",
        "font-weight": "700",
        "font-family": "Segoe UI, system-ui, sans-serif",
        "text-anchor": "middle",
        "dominant-baseline": isUnit ? "auto" : "middle",
        class: isUnit ? "knob-label knob-label--unit" : "knob-label",
      },
      group
    );

    if (isUnit) {
      const tNum = svgEl("tspan", { x: pos.x.toFixed(2), dy: "-0.15em" }, node);
      tNum.textContent = String(n);
      const tUnit = svgEl(
        "tspan",
        {
          x: pos.x.toFixed(2),
          dy: "1.2em",
          fill: "#8b93a0",
          "font-size": "8",
          "font-weight": "600",
          class: "knob-unit",
        },
        node
      );
      tUnit.textContent = unit;
    } else {
      node.textContent = String(n);
    }
  }
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   min: number,
 *   max: number,
 *   step: number,
 *   value: number,
 *   labels?: number[],
 *   minorStep?: number,
 *   onChange: (value: number) => void,
 * }} options
 */
export function mountKnob(host, options) {
  const min = options.min;
  const max = options.max;
  const step = options.step;
  const labels = options.labels ?? [];
  const minorStep = options.minorStep ?? 1;
  const onChange = options.onChange;

  let value = snap(options.value, min, max, step);
  let raw = value;
  let dragging = false;
  let lastDeg = 0;

  const uid = ++knobUid;
  const unit = options.unit ?? host.dataset.unit ?? "";
  const svg = svgEl("svg", {
    viewBox: "-20 -20 140 140",
    fill: "none",
    "aria-hidden": "true",
    class: "knob-dial",
  });
  svg.style.width = "calc(var(--knob-size) * 1.4)";
  svg.style.height = "calc(var(--knob-size) * 1.4)";
  svg.style.display = "block";
  svg.style.touchAction = "none";
  svg.style.userSelect = "none";
  svg.style.cursor = "grab";
  svg.style.overflow = "visible";

  const gradId = `knob-face-${uid}`;
  const defs = svgEl("defs", {}, svg);
  const grad = svgEl(
    "radialGradient",
    { id: gradId, cx: "36%", cy: "30%", r: "70%" },
    defs
  );
  svgEl("stop", { offset: "0%", "stop-color": "#4a5260" }, grad);
  svgEl("stop", { offset: "55%", "stop-color": "#2c323c" }, grad);
  svgEl("stop", { offset: "100%", "stop-color": "#1a1e24" }, grad);

  const ticks = svgEl("g", { class: "knob-ticks" }, svg);
  drawTicks(ticks, min, max, labels, minorStep);

  svgEl(
    "circle",
    {
      cx: 50,
      cy: 50,
      r: 30,
      fill: `url(#${gradId})`,
      stroke: "#5a6270",
      "stroke-width": 3,
    },
    svg
  );

  const pointer = svgEl("g", { class: "knob-pointer" }, svg);
  svgEl(
    "rect",
    {
      x: 48.2,
      y: 22,
      width: 3.6,
      height: 18,
      rx: 1.6,
      fill: "#e8a54b",
    },
    pointer
  );
  svgEl("circle", { cx: 50, cy: 50, r: 4.2, fill: "#3a414c" }, pointer);

  const labelGroup = svgEl("g", { class: "knob-labels", "pointer-events": "none" }, svg);
  drawLabels(labelGroup, min, max, labels, unit);

  /**
   * @param {number} next
   */
  function applyValue(next, syncRaw = true) {
    value = snap(next, min, max, step);
    if (syncRaw) raw = value;
    pointer.setAttribute("transform", `rotate(${valueToDeg(value, min, max)} 50 50)`);
  }

  applyValue(value);

  svg.addEventListener("pointerdown", (event) => {
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    dragging = true;
    raw = value;
    lastDeg = pointerDeg(event, svg.getBoundingClientRect());
    svg.style.cursor = "grabbing";
    svg.setPointerCapture(event.pointerId);
  });

  svg.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const deg = pointerDeg(event, svg.getBoundingClientRect());
    const delta = shortestDelta(lastDeg, deg);
    lastDeg = deg;
    raw = Math.min(max, Math.max(min, raw + (delta / UI_CONFIG.knobSweepDeg) * (max - min)));
    const snapped = snap(raw, min, max, step);
    if (snapped === value) return;
    applyValue(snapped, false);
    onChange(value);
  });

  const endDrag = (event) => {
    if (!dragging) return;
    dragging = false;
    svg.style.cursor = "grab";
    if (svg.hasPointerCapture(event.pointerId)) {
      svg.releasePointerCapture(event.pointerId);
    }
  };

  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);

  host.replaceWith(svg);

  return {
    /** @param {number} next */
    setValue(next) {
      applyValue(next);
    },
    getValue() {
      return value;
    },
  };
}
