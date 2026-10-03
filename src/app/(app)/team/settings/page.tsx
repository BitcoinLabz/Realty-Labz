import { redirect } from "next/navigation";
import { ClipboardCheck, FileCheck2, Store } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageMembership } from "@/lib/authorization";
import { STANDARD_OFFICE_CHECKLIST } from "@/lib/office-checklist";
import { Card } from "@/components/ui/card";
import { DetailTabs } from "@/components/ui/detail-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { PaperworkSettings } from "./paperwork-settings";
import { ChecklistSettings } from "./checklist-settings";
import { VendorSettings } from "./vendor-settings";

// Office settings (2026-10-02): the three lists an office sets up once and
// every file then uses. Only whoever can manage the roster may change them;
// the server actions check that again on every write.
export default async function OfficeSettingsPage() {
  const session = await auth();
  const teamId = session?.user?.teamId;
  if (!teamId) redirect("/dashboard");

  const members = await prisma.user.findMany({ where: { teamId }, select: { role: true } });
  if (!canManageMembership(session!.user, members)) redirect("/team");

  const [requirements, checklist, vendors] = await Promise.all([
    prisma.requiredDocument.findMany({ where: { teamId }, orderBy: { order: "asc" } }),
    prisma.officeChecklistItem.findMany({ where: { teamId }, orderBy: { order: "asc" } }),
    prisma.vendor.findMany({ where: { teamId }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
  ]);

  const tabs = [
    {
      id: "paperwork",
      label: "Paperwork",
      content: (
        <Card
          title="Paperwork every file needs"
          icon={FileCheck2}
          tone="accent"
          description="Agents see this list on each transaction and upload right next to each item. No approval step — once it's on file, it counts."
        >
          <PaperworkSettings items={requirements.map((r) => ({ id: r.id, label: r.label, sides: r.sides }))} />
        </Card>
      ),
    },
    {
      id: "checklist",
      label: "Office checklist",
      content: (
        <Card
          title="Your office checklist"
          icon={ClipboardCheck}
          tone="warning"
          description="Added to a file automatically the moment it goes Under contract. Only your office works it; the agent sees where it stands."
        >
          <ChecklistSettings
            items={checklist.map((c) => ({ id: c.id, label: c.label }))}
            usingStandard={STANDARD_OFFICE_CHECKLIST}
          />
        </Card>
      ),
    },
    {
      id: "vendors",
      label: "Vendors",
      content: (
        <Card
          title="Preferred vendors"
          icon={Store}
          tone="violet"
          description="Your office's go-to title, lending, inspection and sign companies. Agents and the office attach them to files."
        >
          <VendorSettings
            vendors={vendors.map((v) => ({
              id: v.id,
              kind: v.kind,
              name: v.name,
              contactName: v.contactName,
              email: v.email,
              phone: v.phone,
              notes: v.notes,
            }))}
          />
        </Card>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Office settings"
        description="Set these up once. Every transaction in your office uses them from then on."
        backHref="/team"
        backLabel="Overview"
      />
      <DetailTabs tabs={tabs} />
    </div>
  );
}
