/**
 * UI: слайдеры, TORCH MOVEMENT, START/STOP/RESET, readout (ТЗ §6, §15, §25–26, §35, §49–52).
 * Этап 8.
 */

import { WIRE_DIAMETERS, RANGES, DEFAULTS } from "./data.js";
import {
  state,
  setParams,
  startWelding,
  stopWelding,
  resetWelding,
} from "./welding-model.js";

/** @type {Record<string, HTMLElement | null>} */
const el = {};

function fmt(n, digits = 1) {
  return Number(n).toFixed(digits);
}

function syncReadouts() {
  const wfsText = `${fmt(state.wireFeed, 1)} m/min`;
  const voltageSetText = `${fmt(state.voltageSet, 1)} V`;

  if (el.diameterVal) el.diameterVal.textContent = `${fmt(state.wireDiameter, 1)} mm`;
  if (el.wfsVal) el.wfsVal.textContent = wfsText;
  if (el.wfsOut) el.wfsOut.textContent = wfsText;
  if (el.voltageVal) el.voltageVal.textContent = voltageSetText;
  if (el.voltageSetOut) el.voltageSetOut.textContent = voltageSetText;
  if (el.torchVal) el.torchVal.textContent = state.torchMovement ? "ON" : "OFF";

  if (el.currentOut) {
    el.currentOut.textContent =
      state.current == null ? "--- A" : `${Math.round(state.current)} A`;
  }
  if (el.actualVOut) {
    el.actualVOut.textContent =
      state.voltageActual == null ? "--- V" : `${fmt(state.voltageActual, 1)} V`;
  }
  if (el.stickOut) {
    el.stickOut.textContent = `${fmt(state.stickOut, 1)} mm`;
  }
  if (el.stabilityOut) {
    const label = state.stabilityLabel || "---";
    el.stabilityOut.textContent = label;
    el.stabilityOut.dataset.stability = label;
  }

  const running = state.welding;
  if (el.btnStart) el.btnStart.disabled = running;
  if (el.btnStop) el.btnStop.disabled = !running;
}

/**
 * @param {HTMLElement} root
 */
export function initControls(root) {
  el.diameter = root.querySelector("#ctrl-diameter");
  el.wfs = root.querySelector("#ctrl-wfs");
  el.voltage = root.querySelector("#ctrl-voltage");
  el.torch = root.querySelector("#ctrl-torch");
  el.diameterVal = root.querySelector("#val-diameter");
  el.wfsVal = root.querySelector("#val-wfs");
  el.voltageVal = root.querySelector("#val-voltage");
  el.torchVal = root.querySelector("#val-torch");
  el.wfsOut = root.querySelector("#out-wfs");
  el.voltageSetOut = root.querySelector("#out-voltage-set");
  el.currentOut = root.querySelector("#out-current");
  el.actualVOut = root.querySelector("#out-actual-v");
  el.stickOut = root.querySelector("#out-stick");
  el.stabilityOut = root.querySelector("#out-stability");
  el.btnStart = root.querySelector("#btn-start");
  el.btnStop = root.querySelector("#btn-stop");
  el.btnReset = root.querySelector("#btn-reset");

  if (el.diameter instanceof HTMLSelectElement) {
    el.diameter.innerHTML = WIRE_DIAMETERS.map(
      (d) => `<option value="${d.mm}">Ø ${d.mm} mm</option>`
    ).join("");
    el.diameter.value = String(DEFAULTS.wireDiameter);
    el.diameter.addEventListener("change", () => {
      setParams({ wireDiameter: Number(el.diameter.value) });
      syncReadouts();
    });
  }

  if (el.wfs instanceof HTMLInputElement) {
    Object.assign(el.wfs, {
      min: String(RANGES.wireFeed.min),
      max: String(RANGES.wireFeed.max),
      step: String(RANGES.wireFeed.step),
      value: String(DEFAULTS.wireFeed),
    });
    el.wfs.addEventListener("input", () => {
      setParams({ wireFeed: Number(el.wfs.value) });
      syncReadouts();
    });
  }

  if (el.voltage instanceof HTMLInputElement) {
    Object.assign(el.voltage, {
      min: String(RANGES.voltage.min),
      max: String(RANGES.voltage.max),
      step: String(RANGES.voltage.step),
      value: String(DEFAULTS.voltageSet),
    });
    el.voltage.addEventListener("input", () => {
      setParams({ voltageSet: Number(el.voltage.value) });
      syncReadouts();
    });
  }

  if (el.torch instanceof HTMLInputElement) {
    el.torch.checked = false;
    el.torch.addEventListener("change", () => {
      setParams({ torchMovement: el.torch.checked });
      syncReadouts();
    });
  }

  el.btnStart?.addEventListener("click", () => {
    startWelding();
    syncReadouts();
  });
  el.btnStop?.addEventListener("click", () => {
    stopWelding();
    syncReadouts();
  });
  el.btnReset?.addEventListener("click", () => {
    resetWelding();
    syncReadouts();
  });

  setParams({
    wireDiameter: DEFAULTS.wireDiameter,
    wireFeed: DEFAULTS.wireFeed,
    voltageSet: DEFAULTS.voltageSet,
    torchMovement: false,
  });
  syncReadouts();
}

export function updateControlsDisplay() {
  syncReadouts();
}
