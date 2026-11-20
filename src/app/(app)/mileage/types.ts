export type MileageLogDTO = {
  id: string;
  date: string; // yyyy-mm-dd
  miles: number;
  isBusiness: boolean;
  note: string | null;
  ratePerMile: number;
  deduction: number;
};
