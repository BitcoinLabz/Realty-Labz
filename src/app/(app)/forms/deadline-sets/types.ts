export type DeadlineTemplateItemDTO = {
  label: string;
  offsetDays: number;
};

export type DeadlineTemplateDTO = {
  id: string;
  name: string;
  creatorName: string;
  items: DeadlineTemplateItemDTO[];
};
