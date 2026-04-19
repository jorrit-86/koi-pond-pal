import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KhCalculationStatus } from "@/lib/kh-calculator";
import { useTranslation } from "react-i18next";

type KhAdviceCardProps = {
  status: KhCalculationStatus;
};

export function KhAdviceCard({ status }: KhAdviceCardProps) {
  const { t } = useTranslation();
  const belowTarget = status === "below";
  const atTarget = status === "at_target";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("khCalculator.advice.title")}</CardTitle>
        <CardDescription>
          {t("khCalculator.advice.maintenanceLead")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {belowTarget ? (
          <Alert>
            <AlertTitle>
              {t("khCalculator.messages.belowTarget")}
            </AlertTitle>
            <AlertDescription className="mt-2">
              <ul className="list-disc pl-5 space-y-1">
                <li>{t("khCalculator.advice.belowTargetBullet1")}</li>
                <li>{t("khCalculator.advice.belowTargetBullet2")}</li>
                <li>{t("khCalculator.advice.belowTargetBullet3")}</li>
                <li>{t("khCalculator.advice.belowTargetBullet4")}</li>
                <li>{t("khCalculator.advice.belowTargetBullet5")}</li>
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        {atTarget ? (
          <Alert>
            <AlertTitle>{t("khCalculator.messages.atTarget")}</AlertTitle>
            <AlertDescription className="mt-2">
              {t("khCalculator.advice.atTargetFollowup")}
            </AlertDescription>
          </Alert>
        ) : null}

        {!belowTarget && !atTarget ? (
          <Alert>
            <AlertTitle>{t("khCalculator.messages.aboveTarget")}</AlertTitle>
            <AlertDescription className="mt-2">
              {t("khCalculator.advice.aboveTargetFollowup")}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="font-medium mb-1">{t("khCalculator.advice.safetyTitle")}</p>
          <p>
            {t("khCalculator.messages.safetyAdvice")}
          </p>
        </div>

        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="font-medium mb-1">{t("khCalculator.advice.maintenanceTitle")}</p>
          <p>
            {t("khCalculator.messages.maintenanceAdvice")}
          </p>
          <p className="mt-2 text-muted-foreground">
            {t("khCalculator.advice.maintenanceExample")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
