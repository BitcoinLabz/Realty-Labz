import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { HomeOfficeYearResult } from "@/lib/home-office";
import { homeOfficeStatus } from "@/lib/home-office-status";

export function StatusBanner({ result }: { result: HomeOfficeYearResult }) {
  const status = homeOfficeStatus(result);
  const Icon = status.tone === "success" ? CheckCircle2 : AlertTriangle;
  return (
    <p
      className={`flex items-start gap-2 rounded-2xl px-5 py-4 text-sm ${
        status.tone === "success" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
      }`}
    >
      <Icon size={17} className="mt-0.5 shrink-0" />
      {status.text}
    </p>
  );
}
