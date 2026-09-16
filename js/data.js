/**
 * Конфиг и справочники (ТЗ §6–11, §43). Этап 2.
 */

export const WIRE_DIAMETERS = [
  { mm: 0.8, K: 0.05, currentMin: 40, currentMax: 145 },
  { mm: 1.0, K: 0.038, currentMin: 60, currentMax: 230 },
  { mm: 1.2, K: 0.025, currentMin: 75, currentMax: 250 },
];

export const RANGES = {
  wireFeed: { min: 1.0, max: 18.0, step: 0.1 },
  voltage: { min: 10.0, max: 30.0, step: 0.1 },
};

/** UI панели v2: ручки 7h–17h, подписи шкал, tau дисплея. */
export const UI_CONFIG = {
  /** 12h = 0°, по часовой. 7h → 17h (= 5h). */
  knobStartHour: 7,
  knobEndHour: 17,
  knobStartDeg: 210,
  knobSweepDeg: 300,
  /** Сглаживание I/U на дисплее при КЗ-OFF (этап 4). */
  displayTau: 0.18,
  wfs: {
    labels: [1, 3, 6, 9, 12, 15, 18],
    minorStep: 1,
  },
  voltage: {
    labels: [10, 15, 20, 25, 30],
    minorStep: 1,
  },
};

export const DEFAULTS = {
  wireDiameter: 1.0,
  wireFeed: 6.1,
  voltageSet: 20.4,
};

/** Каркас для калибровки (этапы 3+). Stick-out: ТЗ §25–27 / этап 4. Stability: ТЗ §13, §21–23, §34. */
export const WELDING_CONFIG = {
  stickOutBase: 15,
  stickOutMin: 12,
  stickOutMax: 18,
  /** Макс. относительная коррекция тока от stick-out (±). */
  currentCorrectionLimit: 0.08,
  /** Масштаб длины дуги от mismatch напряжения (ТЗ §21–22). */
  arcLengthFactor: 0.9,
  dropletFrequency: 1,
  shortCircuitThreshold: 1,
  penetrationFactor: 1,
  poolWidthFactor: 1,
  poolDepthFactor: 1,
  /** U_ref = voltageRefSlope × I + voltageRefOffset (ТЗ §13). */
  voltageRefSlope: 0.04,
  voltageRefOffset: 14,
  /** |ΔU / U_ref| → WARNING / UNSTABLE. */
  stabilityWarningAbs: 0.11,
  stabilityUnstableAbs: 0.24,
  /** Только отрицательный mismatch (high WFS / low U) → ARC FAILURE. */
  arcFailureMismatch: -0.4,
  arcFailureHoldMs: 1600,
  arcGapScaleMin: 0.4,
  arcGapScaleMax: 1.7,
  /** <0 mismatch → быстрее цикл КЗ; >0 → реже. */
  cycleRateFactor: 0.95,
  cycleRateMin: 0.4,
  cycleRateMax: 2.1,
  dropletSizeFactor: 0.9,
  dropletSizeMin: 0.55,
  dropletSizeMax: 1.95,
  /** Мерцание дуги при низкой stability (0…1). */
  arcFlickerFactor: 0.55,
};

/** Аудио MVP (ТЗ §40–41). Коэффициенты только здесь. */
export const AUDIO_CONFIG = {
  masterVolume: 0.42,
  hissGain: 0.38,
  pulseGain: 0.9,
  crackleGain: 0.55,
  /** Ток (A), при котором интенсивность ≈ 1. */
  currentRef: 160,
  /** Мин. arcIntensity, чтобы шипение дуги было слышно. */
  hissArcMin: 0.12,
  interruptChancePerSec: 2.4,
  interruptMs: 160,
  crackleRatePerSec: 9,
  pulseMinIntervalMs: 45,
  fadeTau: 0.03,
  samples: {
    hiss: "audio/arc-hiss.wav",
    pulse: "audio/sc-pulse.wav",
    crackle: "audio/crackle.wav",
  },
};

/** Длительности фаз FSM (мс). Этап 3. */
export const CYCLE_TIMING = {
  wireFeedMs: 900,
  shortIgnitionMs: 220,
  arcIgnitionMs: 280,
  dropletFormMs: 520,
  shortTransferMs: 180,
  arcRecoveryMs: 240,
};

/** Нормализованный зазор проволоки↔ванна (1 = idle gap, 0 = контакт). */
export const WIRE_GAP = {
  idle: 1,
  arc: 0.55,
  recovery: 0.75,
};

/**
 * @param {number} mm
 * @returns {{ mm: number, K: number, currentMin: number, currentMax: number }}
 */
export function getWireSpec(mm) {
  return WIRE_DIAMETERS.find((d) => d.mm === mm) ?? WIRE_DIAMETERS[1];
}
