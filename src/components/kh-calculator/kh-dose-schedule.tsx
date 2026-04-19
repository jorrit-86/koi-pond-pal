import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

type KhDoseScheduleProps = {
  doseSchedule: number[];
};

export function KhDoseSchedule({ doseSchedule }: KhDoseScheduleProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("khCalculator.schedule.title")}</CardTitle>
        <CardDescription>{t("khCalculator.schedule.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {doseSchedule.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("khCalculator.schedule.empty")}
          </p>
        ) : (
          <div className="space-y-2">
            {doseSchedule.map((dose, index) => (
              <div
                key={`kh-dose-day-${index + 1}`}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <p className="font-medium">{t("khCalculator.schedule.dayLabel", { day: index + 1 })}</p>
                <p className="text-lg font-semibold">{dose} g</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
