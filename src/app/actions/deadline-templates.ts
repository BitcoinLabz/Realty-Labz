"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  canManageSharedResources,
  ownerOnlyFilter,
  teamSharedFilter,
} from "@/lib/authorization";
import { buildDeadlinesFromTemplate, parseAnchorDateUtc } from "@/lib/deadline-templates";
import type { FormState } from "@/app/actions/auth";

type TemplateItemInput = { label: string; offsetDays: number };

// Items arrive as one JSON blob from a hidden input -- the pattern
// saveFormFieldsAction established for the field designer and
// applyContractAnalysisAction reused. A row list edited in local React state
// isn't a good fit for per-row form submissions.
//
// Rejects the whole payload on a bad row (like saveFormFieldsAction) rather
// than silently dropping rows: a deadline quietly missing from a set the agent
// thinks they configured is worse than a visible error.
function parseItems(raw: FormDataEntryValue | null): TemplateItemInput[] | null {
  if (typeof raw !== "string" || !raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const items: TemplateItemInput[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") return null;
    const row = entry as Record<string, unknown>;
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const offsetDays = Number(row.offsetDays);
    if (!label || label.length > 200) return null;
    if (!Number.isInteger(offsetDays) || Math.abs(offsetDays) > 3650) return null;
    items.push({ label, offsetDays });
  }
  return items;
}

function parseName(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  if (!name || name.length > 100) return null;
  return name;
}

export async function createDeadlineTemplateAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };
  if (!canManageSharedResources(session.user)) {
    return { error: "Only a manager can add deadline sets" };
  }

  const name = parseName(formData.get("name"));
  if (!name) return { fieldErrors: { name: "Give this set a name" } };

  const items = parseItems(formData.get("items"));
  if (!items) return { error: "Something's off in the deadline rows — check them and try again." };
  if (items.length === 0) return { error: "Add at least one deadline to this set" };

  await prisma.deadlineTemplate.create({
    data: {
      userId: session.user.id,
      name,
      items: {
        create: items.map((item, index) => ({
          label: item.label,
          offsetDays: item.offsetDays,
          order: index,
        })),
      },
    },
  });

  revalidatePath("/forms/deadline-sets");
  return { success: `"${name}" saved.` };
}

export async function updateDeadlineTemplateAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };
  if (!canManageSharedResources(session.user)) {
    return { error: "Only a manager can edit deadline sets" };
  }

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing deadline set" };

  const name = parseName(formData.get("name"));
  if (!name) return { fieldErrors: { name: "Give this set a name" } };

  const items = parseItems(formData.get("items"));
  if (!items) return { error: "Something's off in the deadline rows — check them and try again." };
  if (items.length === 0) return { error: "Add at least one deadline to this set" };

  const template = await prisma.deadlineTemplate.findFirst({
    where: { id, ...teamSharedFilter(session.user) },
  });
  if (!template) return { error: "Deadline set not found" };

  // Replace the whole item list rather than diffing it -- the same
  // delete-all-then-createMany-in-a-transaction idiom saveFormFieldsAction
  // uses, and the reason is the same: the editor holds rows in local state,
  // so a diff would be more moving parts for no gain.
  await prisma.$transaction([
    prisma.deadlineTemplate.update({ where: { id: template.id }, data: { name } }),
    prisma.deadlineTemplateItem.deleteMany({ where: { templateId: template.id } }),
    prisma.deadlineTemplateItem.createMany({
      data: items.map((item, index) => ({
        templateId: template.id,
        label: item.label,
        offsetDays: item.offsetDays,
        order: index,
      })),
    }),
  ]);

  revalidatePath("/forms/deadline-sets");
  return { success: `"${name}" updated.` };
}

export async function deleteDeadlineTemplateAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;
  if (!canManageSharedResources(session.user)) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  // deleteMany with the access filter in the where clause, never delete-by-id:
  // an id alone carries no ownership.
  await prisma.deadlineTemplate.deleteMany({
    where: { id, ...teamSharedFilter(session.user) },
  });

  revalidatePath("/forms/deadline-sets");
}

/**
 * Applies a set to a transaction, dating every item off the supplied anchor.
 *
 * ADDS, never replaces: existing deadlines are untouched. Applying twice
 * duplicates rather than destroying, which is the recoverable failure -- and
 * an agent can delete a duplicate, but can't get back a deadline the app
 * silently removed.
 */
export async function applyDeadlineTemplateAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const dealId = formData.get("dealId");
  const templateId = formData.get("templateId");
  const anchorDate = formData.get("anchorDate");

  if (typeof dealId !== "string" || !dealId) return { error: "Missing transaction" };
  if (typeof templateId !== "string" || !templateId) {
    return { fieldErrors: { templateId: "Choose a deadline set" } };
  }
  if (typeof anchorDate !== "string" || !parseAnchorDateUtc(anchorDate)) {
    return { fieldErrors: { anchorDate: "Choose a valid start date" } };
  }

  // Same guard as createDeadlineAction: the transaction is checked under
  // ownerOnlyFilter before anything is written to it.
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, ...ownerOnlyFilter(session.user) },
    select: { id: true },
  });
  if (!deal) return { error: "Transaction not found" };

  const template = await prisma.deadlineTemplate.findFirst({
    where: { id: templateId, ...teamSharedFilter(session.user) },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!template) return { error: "Deadline set not found" };

  // The agent can adjust day counts (and drop rows) before applying -- a land
  // purchase runs on different timelines than a standard resale. Those edits
  // apply to THIS transaction only; the saved set is never touched. With no
  // adjusted list submitted, fall back to the set exactly as saved.
  const rawItems = formData.get("items");
  const adjusted = parseItems(rawItems);
  if (rawItems && !adjusted) {
    return { error: "Something's off in the deadline rows — check them and try again." };
  }
  const itemsToApply = adjusted ?? template.items;

  const deadlines = buildDeadlinesFromTemplate(itemsToApply, anchorDate);
  if (deadlines.length === 0) return { error: "There are no deadlines to add" };

  await prisma.dealDeadline.createMany({
    data: deadlines.map((d) => ({ dealId, label: d.label, dueDate: d.dueDate })),
  });

  revalidatePath(`/transactions/${dealId}`);
  revalidatePath("/dashboard");

  const count = deadlines.length;
  return { success: `Added ${count} deadline${count === 1 ? "" : "s"} from "${template.name}".` };
}
