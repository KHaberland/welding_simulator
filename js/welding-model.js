/**
 * Сварочная модель: FSM + КЗ + stick-out + режимы стабильности
 * (ТЗ §16–19, §21–24, §34, §37–39). Этап 5.
 */

import {
  DEFAULTS,
  WELDING_CONFIG,
  CYCLE_TIMING,
  WIRE_GAP,
  getWireSpec,
} from "./data.js";

/** @type {object} */
export const state = {
  welding: false,
  torchMovement: false,
  wireDiameter: DEFAULTS.wireDiameter,
  wireFeed: DEFAULTS.wireFeed,
  voltageSet: DEFAULTS.voltageSet,
  current: null,
  voltageActual: null,
  stickOut: WELDING_CONFIG.stickOutBase,
  arcLength: 0,
  poolWidth: 0,
  poolLength: 0,
  poolDepth: 0,
  penetration: 0,
  stability: 1.0,
  /** STABLE / WARNING / UNSTABLE / ARC FAILURE / --- */
  stabilityLabel: "---",
  /** (U_set − U_ref) / U_ref; <0 короткая дуга, >0 длинная */
  voltageMismatch: 0,
  processState: "IDLE",
  /** 1 = полный зазор, 0 = касание пластины */
  wireGapNorm: WIRE_GAP.idle,
  droplets: [],
  shortCircuitFrequency: 0,
  arcIntensity: 0,
  beadVolume: 0,
  /** яркость зоны контакта при КЗ 0…1 */
  contactGlow: 0,
};

let phaseElapsed = 0;
let lastTime = null;
let scCount = 0;
let scWindowStart = 0;
/** Дуга уже зажигалась в текущем START (движение горелки только после этого). */
let arcHasIgnited = false;
/** Скорость stick-out, мм/мс */
let stickVel = 0;
let stickTarget = WELDING_CONFIG.stickOutBase;
let stickRetargetAt = 0;
let arcFailElapsed = 0;
let formJitter = 1;

/**
 * I_base = WFS / K (ТЗ §10).
 * @param {number} wireFeed
 * @param {number} wireDiameter
 */
export function calcBaseCurrent(wireFeed, wireDiameter) {
  const { K } = getWireSpec(wireDiameter);
  return wireFeed / K;
}

/** @param {number} n @param {number} a @param {number} b */
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function voltageRef(current) {
  return (
    WELDING_CONFIG.voltageRefSlope * current + WELDING_CONFIG.voltageRefOffset
  );
}

/** Нормированное отклонение stick-out: −1…+1 при 12…18 mm. */
function stickOutNorm() {
  const { stickOutBase, stickOutMin, stickOutMax } = WELDING_CONFIG;
  const span = (stickOutMax - stickOutMin) / 2;
  return (state.stickOut - stickOutBase) / span;
}

function cycleRate() {
  const r = 1 - state.voltageMismatch * WELDING_CONFIG.cycleRateFactor;
  return clamp(r, WELDING_CONFIG.cycleRateMin, WELDING_CONFIG.cycleRateMax);
}

function phaseMs(baseMs) {
  return baseMs / cycleRate();
}

function arcGapScale() {
  return clamp(
    1 + state.voltageMismatch * WELDING_CONFIG.arcLengthFactor,
    WELDING_CONFIG.arcGapScaleMin,
    WELDING_CONFIG.arcGapScaleMax
  );
}

function scaledGap(base) {
  return base * arcGapScale();
}

function dropletSizeMul() {
  const sof = stickOutNorm();
  return (
    (1 + sof * 0.1) *
    clamp(
      1 + state.voltageMismatch * WELDING_CONFIG.dropletSizeFactor,
      WELDING_CONFIG.dropletSizeMin,
      WELDING_CONFIG.dropletSizeMax
    )
  );
}

/**
 * @param {boolean} [snap]
 */
function updateStability(snap = false) {
  const I = calcBaseCurrent(state.wireFeed, state.wireDiameter);
  const uRef = Math.max(1, voltageRef(I));
  const mismatch = (state.voltageSet - uRef) / uRef;
  state.voltageMismatch = mismatch;

  const abs = Math.abs(mismatch);
  const span = WELDING_CONFIG.stabilityUnstableAbs * 1.7;
  const target = clamp(1 - abs / span, 0, 1);

  if (!state.welding) {
    state.stability = 1;
    state.stabilityLabel = "---";
    return;
  }

  if (snap) state.stability = target;
  else state.stability += (target - state.stability) * 0.18;

  if (state.processState === "ARC_FAILURE") {
    state.stability = Math.min(state.stability, 0.04);
    state.stabilityLabel = "ARC FAILURE";
    return;
  }

  if (abs < WELDING_CONFIG.stabilityWarningAbs) {
    state.stabilityLabel = "STABLE";
  } else if (abs < WELDING_CONFIG.stabilityUnstableAbs) {
    state.stabilityLabel = "WARNING";
  } else {
    state.stabilityLabel = "UNSTABLE";
  }
}

function clearDroplets() {
  state.droplets.length = 0;
}

/** @param {Partial<{ radius: number, y: number, vy: number, temperature: number, lifetime: number, dropState: string }>} patch */
function ensureDroplet(patch = {}) {
  if (!state.droplets.length) {
    state.droplets.push({
      x: 0.5,
      y: 0,
      radius: 0.2,
      velocity: 0,
      temperature: 0.5,
      lifetime: 0,
      dropState: "forming",
    });
  }
  Object.assign(state.droplets[0], patch);
}

function setPhase(name) {
  state.processState = name;
  phaseElapsed = 0;
  if (name === "ARC_IGNITION") arcHasIgnited = true;
  if (name === "DROPLET_FORMATION") {
    const m = Math.max(0, state.voltageMismatch);
    formJitter = 1 + m * (0.12 + 0.7 * Math.random());
  } else {
    formJitter = 1;
  }
}

function enterArcFailure() {
  setPhase("ARC_FAILURE");
  state.wireGapNorm = 0;
  state.arcIntensity = 0;
  state.contactGlow = 0.4;
  state.arcLength = 0;
  ensureDroplet({
    y: 0,
    radius: 1.2,
    velocity: 0,
    temperature: 0.35,
    lifetime: 0,
    dropState: "stub",
  });
  applyOutputs();
}

/**
 * Плавный псевдослучайный stick-out (ТЗ §25–26).
 * @param {number} time
 * @param {number} dt
 */
function updateStickOut(time, dt) {
  const { stickOutBase, stickOutMin, stickOutMax } = WELDING_CONFIG;
  const active =
    state.welding && state.torchMovement && arcHasIgnited;

  if (!active) {
    stickVel = 0;
    stickTarget = stickOutBase;
    const a = Math.min(1, dt / 380);
    state.stickOut += (stickOutBase - state.stickOut) * a;
    if (Math.abs(state.stickOut - stickOutBase) < 0.04) {
      state.stickOut = stickOutBase;
    }
    return;
  }

  if (time >= stickRetargetAt) {
    const half = (stickOutMax - stickOutMin) / 2;
    stickTarget =
      stickOutBase + (Math.random() * 2 - 1) * half * (0.55 + Math.random() * 0.45);
    stickTarget = Math.max(stickOutMin, Math.min(stickOutMax, stickTarget));
    stickRetargetAt = time + 700 + Math.random() * 1400;
  }

  // soft spring к цели + слабое центрирование к базе
  const toTarget = stickTarget - state.stickOut;
  const toBase = stickOutBase - state.stickOut;
  stickVel += (toTarget * 0.000045 + toBase * 0.000008) * dt;
  stickVel *= Math.pow(0.94, dt / 16);
  // лёгкий непрерывный wobble без скачков
  stickVel += Math.sin(time * 0.0011) * 0.000004 * dt;

  state.stickOut += stickVel * dt;
  if (state.stickOut < stickOutMin) {
    state.stickOut = stickOutMin;
    stickVel = Math.abs(stickVel) * 0.25;
  } else if (state.stickOut > stickOutMax) {
    state.stickOut = stickOutMax;
    stickVel = -Math.abs(stickVel) * 0.25;
  }
}

function applyOutputs() {
  updateStability();
  if (!state.welding) {
    state.current = null;
    state.voltageActual = null;
    return;
  }
  if (state.processState === "ARC_FAILURE") {
    state.current = 0;
    state.voltageActual = 0;
    return;
  }
  const base = calcBaseCurrent(state.wireFeed, state.wireDiameter);
  const sof = stickOutNorm();
  const lim = WELDING_CONFIG.currentCorrectionLimit;
  // длиннее stick-out → чуть ниже ток, чуть выше U (умеренно, ТЗ §27)
  const currentCorr = 1 - sof * lim;
  const voltageCorr = 1 + sof * lim * 0.56;
  const ps = state.processState;
  const inSc =
    ps === "SHORT_CIRCUIT_IGNITION" || ps === "SHORT_CIRCUIT_TRANSFER";
  state.current = (inSc ? base * 1.35 : base) * currentCorr;
  state.voltageActual = inSc
    ? Math.max(2, state.voltageSet * 0.08)
    : state.voltageSet * (0.85 + 0.15 * state.arcIntensity) * voltageCorr;
}

function recordShortCircuit(now) {
  if (!scWindowStart) scWindowStart = now;
  scCount += 1;
  const dt = now - scWindowStart;
  if (dt >= 1000) {
    state.shortCircuitFrequency = (scCount * 1000) / dt;
    scCount = 0;
    scWindowStart = now;
  }
}

/**
 * @param {number} time
 * @param {number} dt
 */
function tickFsm(time, dt) {
  if (state.processState === "ARC_FAILURE") {
    state.wireGapNorm = 0;
    state.arcIntensity = 0;
    state.contactGlow = 0.28 + 0.12 * Math.sin(time * 0.008);
    ensureDroplet({
      y: 0,
      radius: 1.2,
      temperature: 0.3,
      dropState: "stub",
    });
    applyOutputs();
    return;
  }

  const T = CYCLE_TIMING;
  const sof = stickOutNorm();
  const formMs =
    (phaseMs(T.dropletFormMs) * formJitter) /
    Math.max(
      0.6,
      WELDING_CONFIG.dropletFrequency * (0.7 + state.wireFeed / 15) * (1 - sof * 0.06)
    );
  const sizeMul = dropletSizeMul();

  phaseElapsed += dt;
  const t = phaseElapsed;

  switch (state.processState) {
    case "WIRE_FEED": {
      const p = Math.min(1, t / phaseMs(T.wireFeedMs));
      state.wireGapNorm = WIRE_GAP.idle * (1 - p);
      state.arcIntensity = 0;
      state.contactGlow = 0;
      clearDroplets();
      if (p >= 1) {
        recordShortCircuit(time);
        setPhase("SHORT_CIRCUIT_IGNITION");
      }
      break;
    }
    case "SHORT_CIRCUIT_IGNITION": {
      state.wireGapNorm = 0;
      state.arcIntensity = 0;
      state.contactGlow = Math.min(1, t / (phaseMs(T.shortIgnitionMs) * 0.5));
      ensureDroplet({
        y: 0,
        radius: 0.35 + 0.25 * state.contactGlow,
        temperature: 0.7 + 0.3 * state.contactGlow,
        dropState: "melting",
      });
      if (t >= phaseMs(T.shortIgnitionMs)) {
        clearDroplets();
        setPhase("ARC_IGNITION");
      }
      break;
    }
    case "ARC_IGNITION": {
      const dur = phaseMs(T.arcIgnitionMs);
      const p = Math.min(1, t / dur);
      state.wireGapNorm = scaledGap(WIRE_GAP.arc) * p;
      state.arcIntensity = p;
      state.contactGlow = 1 - p;
      if (p >= 1) setPhase("DROPLET_FORMATION");
      break;
    }
    case "DROPLET_FORMATION": {
      const p = Math.min(1, t / formMs);
      state.wireGapNorm = scaledGap(WIRE_GAP.arc);
      state.arcIntensity = 0.85 + 0.15 * Math.sin(t * 0.02);
      state.contactGlow = 0;
      ensureDroplet({
        y: 0,
        radius: (0.25 + 0.75 * p) * sizeMul,
        velocity: 0,
        temperature: 0.6 + 0.4 * p,
        lifetime: t,
        dropState: "forming",
      });
      if (p >= 1) {
        recordShortCircuit(time);
        setPhase("SHORT_CIRCUIT_TRANSFER");
      }
      break;
    }
    case "SHORT_CIRCUIT_TRANSFER": {
      const dur = phaseMs(T.shortTransferMs);
      const p = Math.min(1, t / dur);
      state.wireGapNorm = scaledGap(WIRE_GAP.arc) * (1 - p);
      state.arcIntensity = Math.max(0, 1 - p * 1.5);
      state.contactGlow = p;
      ensureDroplet({
        y: p,
        radius: Math.max(0.15, (1 - p * 0.5) * sizeMul),
        velocity: p,
        temperature: 0.9,
        lifetime: t,
        dropState: "transfer",
      });
      if (p >= 1) {
        clearDroplets();
        setPhase("ARC_RECOVERY");
      }
      break;
    }
    case "ARC_RECOVERY": {
      const dur = phaseMs(T.arcRecoveryMs);
      const p = Math.min(1, t / dur);
      const g0 = scaledGap(WIRE_GAP.arc);
      const g1 = scaledGap(WIRE_GAP.recovery);
      state.wireGapNorm = g0 + (g1 - g0) * Math.sin(p * Math.PI);
      state.arcIntensity = 0.4 + 0.6 * p;
      state.contactGlow = Math.max(0, 1 - p * 2);
      clearDroplets();
      if (p >= 1) setPhase("DROPLET_FORMATION");
      break;
    }
    default:
      break;
  }

  applyOutputs();
}

/**
 * @param {number} [time]
 */
export function updateWeldingModel(time = 0) {
  if (!state.welding) {
    lastTime = time;
    updateStickOut(time, 16);
    applyOutputs();
    return;
  }
  const dt = lastTime == null ? 16 : Math.min(50, Math.max(0, time - lastTime));
  lastTime = time;
  updateStickOut(time, dt);
  tickFsm(time, dt);

  if (
    arcHasIgnited &&
    state.processState !== "ARC_FAILURE" &&
    state.voltageMismatch <= WELDING_CONFIG.arcFailureMismatch
  ) {
    arcFailElapsed += dt;
    if (arcFailElapsed >= WELDING_CONFIG.arcFailureHoldMs) {
      enterArcFailure();
    }
  } else if (state.processState !== "ARC_FAILURE") {
    arcFailElapsed = 0;
  }
}

export function startWelding() {
  state.welding = true;
  phaseElapsed = 0;
  lastTime = null;
  scCount = 0;
  scWindowStart = 0;
  arcHasIgnited = false;
  stickVel = 0;
  stickTarget = WELDING_CONFIG.stickOutBase;
  stickRetargetAt = 0;
  arcFailElapsed = 0;
  formJitter = 1;
  state.shortCircuitFrequency = 0;
  state.wireGapNorm = WIRE_GAP.idle;
  state.arcIntensity = 0;
  state.contactGlow = 0;
  state.arcLength = 0;
  state.stickOut = WELDING_CONFIG.stickOutBase;
  clearDroplets();
  setPhase("WIRE_FEED");
  applyOutputs();
  updateStability(true);
}

export function stopWelding() {
  state.welding = false;
  state.processState = "IDLE";
  state.wireGapNorm = WIRE_GAP.idle;
  state.arcLength = 0;
  state.arcIntensity = 0;
  state.contactGlow = 0;
  state.stabilityLabel = "---";
  state.stability = 1.0;
  arcHasIgnited = false;
  stickVel = 0;
  stickTarget = WELDING_CONFIG.stickOutBase;
  arcFailElapsed = 0;
  clearDroplets();
  phaseElapsed = 0;
  lastTime = null;
  applyOutputs();
}

/** Сброс процесса; setpoint пользователя сохраняются (ТЗ §52). */
export function resetWelding() {
  stopWelding();
  state.stickOut = WELDING_CONFIG.stickOutBase;
  state.poolWidth = 0;
  state.poolLength = 0;
  state.poolDepth = 0;
  state.penetration = 0;
  state.stability = 1.0;
  state.stabilityLabel = "---";
  state.voltageMismatch = 0;
  state.shortCircuitFrequency = 0;
  state.beadVolume = 0;
}

/**
 * @param {Partial<typeof state>} patch
 */
export function setParams(patch) {
  if (patch.wireDiameter != null) state.wireDiameter = patch.wireDiameter;
  if (patch.wireFeed != null) state.wireFeed = patch.wireFeed;
  if (patch.voltageSet != null) state.voltageSet = patch.voltageSet;
  if (patch.torchMovement != null) state.torchMovement = !!patch.torchMovement;
  applyOutputs();
}
