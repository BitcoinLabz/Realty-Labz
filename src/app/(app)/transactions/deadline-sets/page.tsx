import { CalendarClock } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  canManageSharedResources,
  teamSharedFilter,
} from "@/lib/authorization";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { TransactionsTabs } from "../section-tabs";
import { DeadlineSetList } from "./deadline-set-list";
import type { DeadlineTemplateDTO } from "./types";

export default async function DeadlineSetsPage() {
  const session = await auth();

  const templates = await prisma.deadlineTemplate.findMany({
    where: teamSharedFilter(session!.user),
    include: { user: true, items: { orderBy: { order: "asc" } } },
    orderBy: { name: "asc" },
  });

  const dtos: DeadlineTemplateDTO[] = templates.map((t) => ({
    id: t.id,
    name: t.name,
    creatorName: t.user.name ?? t.user.email,
    items: t.items.map((i) => ({ label: i.label, offsetDays: i.offsetDays })),
  }));

  const canManage = canManageSharedResources(session!.user);
  const isTeamShared = !!session!.user.teamId;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Transactions"
        description="Every property you're working on, with its paperwork, deadlines, and commission in one place."
      />
      <TransactionsTabs />
      <Card
        title={isTeamShared ? "Team deadline sets" : "Deadline sets"}
        icon={CalendarClock}
        description="Set up your standard contingencies once, then add them all to a transaction with a single date. Each deadline is a number of days from that date — no counting on a calendar."
      >
        <DeadlineSetList templates={dtos} canManage={canManage} isTeamShared={isTeamShared} />
      </Card>
    </div>
  );
}
