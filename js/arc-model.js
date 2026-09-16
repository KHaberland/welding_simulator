/**
 * Дуга: длина, интенсивность, мерцание по stability (ТЗ §21–22, §36). Этап 5.
 */

import { WELDING_CONFIG } from "./data.js";

const ARC_ON = new Set(["ARC_IGNITION", "DROPLET_FORMATION", "ARC_RECOVERY"]);

/**
 * @param {object} st
 * @param {number} [time]
 */
export function updateArc(st, time = 0) {
  const ps = st.processState;
  const stick = st.stickOut != null ? st.stickOut : WELDING_CONFIG.stickOutBase;
  const gap = st.wireGapNorm != null ? st.wireGapNorm : 0;

  if (!st.welding || ps === "IDLE" || ps === "ARC_FAILURE") {
    st.arcLength = 0;
    if (ps === "ARC_FAILURE" || ps === "IDLE") st.arcIntensity = 0;
    return;
  }

  st.arcLength = gap * stick * 0.4;

  if (!ARC_ON.has(ps)) return;

  const flicker = WELDING_CONFIG.arcFlickerFactor * (1 - (st.stability ?? 1));
  if (flicker <= 0.02) return;

  const wobble =
    0.5 +
    0.5 * Math.sin(time * 0.041) * Math.sin(time * 0.017 + (st.voltageMismatch || 0));
  st.arcIntensity *= Math.max(0.18, 1 - flicker * wobble);
}
