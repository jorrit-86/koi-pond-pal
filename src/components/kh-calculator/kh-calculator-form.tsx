import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "react-i18next";

type KhCalculatorFormProps = {
  measuredKh: string;
  targetKh: string;
  pondVolumeLiters: string;
  useRecommendedTarget: boolean;
  errors: {
    measuredKh?: string;
    targetKh?: string;
    pondVolumeLiters?: string;
  };
  onMeasuredKhChange: (value: string) => void;
  onTargetKhChange: (value: string) => void;
  onPondVolumeChange: (value: string) => void;
  onUseRecommendedTargetChange: (value: boolean) => void;
};

export function KhCalculatorForm({
  measuredKh,
  targetKh,
  pondVolumeLiters,
  useRecommendedTarget,
  errors,
  onMeasuredKhChange,
  onTargetKhChange,
  onPondVolumeChange,
  onUseRecommendedTargetChange,
}: KhCalculatorFormProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("khCalculator.form.title")}</CardTitle>
        <CardDescription>{t("khCalculator.form.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="kh-measured">{t("khCalculator.form.measuredKhLabel")}</Label>
          <Input
            id="kh-measured"
            type="number"
            min={0}
            step="0.1"
            inputMode="decimal"
            value={measuredKh}
            onChange={(event) => onMeasuredKhChange(event.target.value)}
            placeholder={t("khCalculator.form.measuredKhPlaceholder")}
          />
          {errors.measuredKh ? (
            <p className="text-sm text-destructive">{errors.measuredKh}</p>
          ) : null}
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">{t("khCalculator.form.useRecommendedTarget")}</p>
              <p className="text-xs text-muted-foreground">
                {t("khCalculator.recommendationText")}
              </p>
            </div>
            <Switch
              checked={useRecommendedTarget}
              onCheckedChange={onUseRecommendedTargetChange}
              aria-label={t("khCalculator.form.useRecommendedTarget")}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="kh-target">{t("khCalculator.form.targetKhLabel")}</Label>
          <Input
            id="kh-target"
            type="number"
            min={0}
            step="0.1"
            inputMode="decimal"
            value={targetKh}
            onChange={(event) => onTargetKhChange(event.target.value)}
            disabled={useRecommendedTarget}
            placeholder={t("khCalculator.form.targetKhPlaceholder")}
          />
          {errors.targetKh ? <p className="text-sm text-destructive">{errors.targetKh}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="kh-volume">{t("khCalculator.form.pondVolumeLabel")}</Label>
          <Input
            id="kh-volume"
            type="number"
            min={1}
            step="1"
            inputMode="numeric"
            value={pondVolumeLiters}
            onChange={(event) => onPondVolumeChange(event.target.value)}
            placeholder={t("khCalculator.form.pondVolumePlaceholder")}
          />
          {errors.pondVolumeLiters ? (
            <p className="text-sm text-destructive">{errors.pondVolumeLiters}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
