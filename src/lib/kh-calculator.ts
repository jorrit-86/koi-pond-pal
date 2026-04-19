export const DEFAULT_TARGET_KH = 6;
export const BASE_VOLUME_LITERS = 13000;
export const GRAMS_PER_DKH_AT_BASE_VOLUME = 390;
export const MAX_DAILY_DOSE_AT_BASE_VOLUME = 400;

export type KhCalculationInput = {
  currentKh: number;
  targetKh: number;
  pondVolumeLiters: number;
};

export type KhCalculationStatus = "below" | "at_target" | "above";

export type KhCalculationResult = {
  recommendedTargetKh: number;
  deltaKh: number;
  gramsPerDkh: number;
  totalDoseGrams: number;
  maxDailyDose: number;
  doseDays: number;
  doseSchedule: number[];
  status: KhCalculationStatus;
};

export function createDoseSchedule(totalDoseGrams: number, maxDailyDose: number) {
  const doses: number[] = [];
  let remaining = totalDoseGrams;

  while (remaining > 0) {
    const dose = Math.min(remaining, maxDailyDose);
    doses.push(dose);
    remaining -= dose;
  }

  return doses;
}

export function calculateKhAdvice(input: KhCalculationInput): KhCalculationResult {
  const { currentKh, targetKh, pondVolumeLiters } = input;

  const gramsPerDkh =
    (pondVolumeLiters / BASE_VOLUME_LITERS) * GRAMS_PER_DKH_AT_BASE_VOLUME;

  const deltaKh = targetKh - currentKh;

  const totalDoseGrams = deltaKh > 0 ? Math.round(deltaKh * gramsPerDkh) : 0;

  const maxDailyDose = Math.round(
    (pondVolumeLiters / BASE_VOLUME_LITERS) * MAX_DAILY_DOSE_AT_BASE_VOLUME,
  );

  const safeMaxDailyDose = Math.max(maxDailyDose, 1);
  const doseDays =
    totalDoseGrams > 0 ? Math.ceil(totalDoseGrams / safeMaxDailyDose) : 0;

  const doseSchedule =
    totalDoseGrams > 0 ? createDoseSchedule(totalDoseGrams, safeMaxDailyDose) : [];

  let status: KhCalculationStatus = "at_target";
  if (deltaKh > 0) {
    status = "below";
  } else if (deltaKh < 0) {
    status = "above";
  }

  return {
    recommendedTargetKh: DEFAULT_TARGET_KH,
    deltaKh,
    gramsPerDkh,
    totalDoseGrams,
    maxDailyDose: safeMaxDailyDose,
    doseDays,
    doseSchedule,
    status,
  };
}
