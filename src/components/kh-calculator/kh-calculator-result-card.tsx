import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KhCalculationResult } from "@/lib/kh-calculator";
import { useTranslation } from "react-i18next";

type KhCalculatorResultCardProps = {
  calculation: KhCalculationResult;
  measuredKh: number;
  targetKh: number;
};

function formatKh(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

export function KhCalculatorResultCard({
  calculation,
  measuredKh,
  targetKh,
}: KhCalculatorResultCardProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("khCalculator.result.title")}</CardTitle>
        <CardDescription>
          {t("khCalculator.result.baseInfo")}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border p-3">
          <p className="text-sm text-muted-foreground">{t("khCalculator.result.recommendedTargetKh")}</p>
          <p className="text-xl font-semibold">{formatKh(calculation.recommendedTargetKh)} dKH</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-sm text-muted-foreground">{t("khCalculator.result.measuredKh")}</p>
          <p className="text-xl font-semibold">{formatKh(measuredKh)} dKH</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-sm text-muted-foreground">{t("khCalculator.result.targetKh")}</p>
          <p className="text-xl font-semibold">{formatKh(targetKh)} dKH</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-sm text-muted-foreground">{t("khCalculator.result.khDifference")}</p>
          <p className="text-xl font-semibold">
            {formatKh(Math.abs(calculation.deltaKh))} dKH
          </p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-sm text-muted-foreground">{t("khCalculator.result.totalRequiredDose")}</p>
          <p className="text-xl font-semibold">{calculation.totalDoseGrams} g</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-sm text-muted-foreground">{t("khCalculator.result.maxDailyDose")}</p>
          <p className="text-xl font-semibold">{calculation.maxDailyDose} g/day</p>
        </div>
      </CardContent>
    </Card>
  );
}
