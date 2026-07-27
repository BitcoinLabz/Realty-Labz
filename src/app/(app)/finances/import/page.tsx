import { CsvImportFlow } from "./csv-import-flow";

export default function FinancesImportPage() {
  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-muted">Bring in transactions from a bank statement export.</p>
      <CsvImportFlow />
    </div>
  );
}
