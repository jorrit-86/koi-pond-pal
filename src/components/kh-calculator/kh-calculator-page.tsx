import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { KhAdviceCard } from "@/components/kh-calculator/kh-advice-card";
import { KhCalculatorForm } from "@/components/kh-calculator/kh-calculator-form";
import { KhCalculatorResultCard } from "@/components/kh-calculator/kh-calculator-result-card";
import { KhDoseSchedule } from "@/components/kh-calculator/kh-dose-schedule";
import { DEFAULT_TARGET_KH, calculateKhAdvice } from "@/lib/kh-calculator";
import { useUserPreferences } from "@/hooks/use-user-preferences";

const DEFAULT_POND_VOLUME = 13000;
const KH_CALCULATOR_STORAGE_KEY = "kh-calculator-preferences-v1";

type KhCalculatorPageProps = {
  onNavigate: (tab: string) => void;
};

type ValidationErrors = {
  measuredKh?: string;
  targetKh?: string;
  pondVolumeLiters?: string;
};

function parseNonNegativeNumber(rawValue: string) {
  if (rawValue.trim().length === 0) {
    return null;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function formatKh(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

export function KhCalculatorPage({ onNavigate: _onNavigate }: KhCalculatorPageProps) {
  const { t } = useTranslation();
  const { preferences, loading: loadingPreferences } = useUserPreferences();
  const [measuredKh, setMeasuredKh] = useState<string>("");
  const [targetKh, setTargetKh] = useState<string>(DEFAULT_TARGET_KH.toString());
  const [pondVolumeLiters, setPondVolumeLiters] = useState<string>(DEFAULT_POND_VOLUME.toString());
  const [useRecommendedTarget, setUseRecommendedTarget] = useState<boolean>(true);
  const [hasUserEditedPondVolume, setHasUserEditedPondVolume] = useState<boolean>(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KH_CALCULATOR_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as {
        targetKh?: number;
        pondVolumeLiters?: number;
        useRecommendedTarget?: boolean;
      };

      if (typeof parsed.useRecommendedTarget === "boolean") {
        setUseRecommendedTarget(parsed.useRecommendedTarget);
      }

      if (typeof parsed.targetKh === "number" && parsed.targetKh >= 0) {
        setTargetKh(parsed.targetKh.toString());
      }

      if (typeof parsed.pondVolumeLiters === "number" && parsed.pondVolumeLiters > 0) {
        setPondVolumeLiters(Math.round(parsed.pondVolumeLiters).toString());
      }
    } catch (error) {
      console.warn("Unable to restore KH calculator preferences:", error);
    }
  }, []);

  useEffect(() => {
    const parsedTarget = parseNonNegativeNumber(targetKh);
    const parsedVolume = Number(pondVolumeLiters);
    const targetToPersist = parsedTarget ?? DEFAULT_TARGET_KH;
    const volumeToPersist =
      Number.isFinite(parsedVolume) && parsedVolume > 0 ? parsedVolume : DEFAULT_POND_VOLUME;

    const payload = {
      targetKh: targetToPersist,
      pondVolumeLiters: volumeToPersist,
      useRecommendedTarget,
    };

    localStorage.setItem(KH_CALCULATOR_STORAGE_KEY, JSON.stringify(payload));
  }, [targetKh, pondVolumeLiters, useRecommendedTarget]);

  useEffect(() => {
    if (loadingPreferences || hasUserEditedPondVolume) {
      return;
    }

    const preferencePondSize = (preferences as { pond_size_liters?: number | string })?.pond_size_liters;
    if (preferencePondSize == null) {
      return;
    }

    const parsedPreferenceVolume = Number(preferencePondSize);
    if (!Number.isFinite(parsedPreferenceVolume) || parsedPreferenceVolume <= 0) {
      return;
    }

    setPondVolumeLiters(Math.round(parsedPreferenceVolume).toString());
  }, [hasUserEditedPondVolume, loadingPreferences, preferences]);

  const effectiveTargetKh = useRecommendedTarget ? DEFAULT_TARGET_KH : parseNonNegativeNumber(targetKh);
  const parsedMeasuredKh = parseNonNegativeNumber(measuredKh);
  const parsedVolume = Number(pondVolumeLiters);
  const parsedPondVolume = Number.isFinite(parsedVolume) && parsedVolume > 0 ? parsedVolume : null;

  const errors: ValidationErrors = useMemo(() => {
    const validationErrors: ValidationErrors = {};

    if (parsedMeasuredKh === null) {
      validationErrors.measuredKh = t("khCalculator.validation.measuredKh");
    }

    if (!useRecommendedTarget && effectiveTargetKh === null) {
      validationErrors.targetKh = t("khCalculator.validation.targetKh");
    }

    if (parsedPondVolume === null) {
      validationErrors.pondVolumeLiters = t("khCalculator.validation.pondVolume");
    }

    return validationErrors;
  }, [effectiveTargetKh, parsedMeasuredKh, parsedPondVolume, t, useRecommendedTarget]);

  const isValid = Object.keys(errors).length === 0;

  const calculation = useMemo(() => {
    if (!isValid || parsedMeasuredKh === null || effectiveTargetKh === null || parsedPondVolume === null) {
      return null;
    }

    return calculateKhAdvice({
      currentKh: parsedMeasuredKh,
      targetKh: effectiveTargetKh,
      pondVolumeLiters: parsedPondVolume,
    });
  }, [effectiveTargetKh, isValid, parsedMeasuredKh, parsedPondVolume]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">{t("khCalculator.title")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("khCalculator.subtitle")}
        </p>
      </div>

      <KhCalculatorForm
        measuredKh={measuredKh}
        targetKh={targetKh}
        pondVolumeLiters={pondVolumeLiters}
        useRecommendedTarget={useRecommendedTarget}
        errors={errors}
        onMeasuredKhChange={setMeasuredKh}
        onTargetKhChange={setTargetKh}
        onPondVolumeChange={(value) => {
          setHasUserEditedPondVolume(true);
          setPondVolumeLiters(value);
        }}
        onUseRecommendedTargetChange={(enabled) => {
          setUseRecommendedTarget(enabled);
          if (enabled) {
            setTargetKh(DEFAULT_TARGET_KH.toString());
          }
        }}
      />

      {calculation ? (
        <>
          <KhCalculatorResultCard
            calculation={calculation}
            measuredKh={parsedMeasuredKh as number}
            targetKh={effectiveTargetKh as number}
          />

          <KhDoseSchedule doseSchedule={calculation.doseSchedule} />
          <KhAdviceCard status={calculation.status} />
        </>
      ) : (
        <div className="rounded-md border p-4 text-sm text-muted-foreground">
          {t("khCalculator.enterValidValues")}
        </div>
      )}

      {calculation ? (
        <div className="rounded-md border bg-muted/40 p-4 text-sm">
          <p>
            {t("khCalculator.quickCheckPrefix")}{" "}
            <span className="font-semibold">{formatKh(parsedMeasuredKh as number)} dKH</span>,{" "}
            {t("khCalculator.quickCheckTarget")}{" "}
            <span className="font-semibold">{formatKh(effectiveTargetKh as number)} dKH</span>,{" "}
            {t("khCalculator.quickCheckTotal")}{" "}
            <span className="font-semibold">{calculation.totalDoseGrams} g</span>.
          </p>
        </div>
      ) : null}
    </div>
  );
}
