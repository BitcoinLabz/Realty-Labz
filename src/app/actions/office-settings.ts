"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageMembership } from "@/lib/authorization";
import { STANDARD_OFFICE_CHECKLIST } from "@/lib/office-checklist";
import type { FormState } from "@/app/actions/auth";
import type { DealSide, VendorKind } from "@/generated/prisma/enums";

// Office settings (2026-10-02): the paperwork list, the standard office
// checklist, and the vendor directory. Changed only by whoever can manage
// the roster (canManageMembership) -- the same people who run the office.
// Every write is scoped by { id, teamId } so an id from another office is
// inert.

const SIDES: DealSide[] = ["BUYER", "SELLER", "DUAL", "TENANT", "LANDLORD"];
const KINDS: VendorKind[] = ["TITLE", "LENDER", "INSPECTOR", "APPRAISER", "SIGNS", "OTHER"];

// A sensible starting list an office can trim, rather than a blank page.
const STARTER_PAPERWORK: { label: string; sides: DealSide[] }[] = [
  { label: "Purchase agreement", sides: ["BUYER", "SELLER", "DUAL"] },
  { label: "Agency disclosure", sides: ["BUYER", "SELLER", "DUAL", "TENANT", "LANDLORD"] },
  { label: "Seller's disclosure statement", sides: ["SELLER", "DUAL"] },
  { label: "Lead-based paint disclosure", sides: ["BUYER", "SELLER", "DUAL"] },
  { label: "Pre-approval or proof of funds", sides: ["BUYER", "DUAL"] },
  { label: "Listing agreement", sides: ["SELLER", "DUAL"] },
  { label: "Closing statement", sides: ["BUYER", "SELLER", "DUAL"] },
  { label: "Lease agreement", sides: ["TENANT", "LANDLORD"] },
];

async function officeManager(): Promise<{ teamId: string } | null> {
  const session = await auth();
  if (!session?.user?.teamId) return null;
  const members = await prisma.user.findMany({
    where: { teamId: session.user.teamId },
    select: { role: true },
  });
  return canManageMembership(session.user, members) ? { teamId: session.user.teamId } : null;
}

function text(value: FormDataEntryValue | null, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function revalidate() {
  revalidatePath("/team/settings");
  revalidatePath("/team");
}

async function nextOrder(teamId: string, model: "requiredDocument" | "officeChecklistItem") {
  const last =
    model === "requiredDocument"
      ? await prisma.requiredDocument.findFirst({ where: { teamId }, orderBy: { order: "desc" }, select: { order: true } })
      : await prisma.officeChecklistItem.findFirst({ where: { teamId }, orderBy: { order: "desc" }, select: { order: true } });
  return (last?.order ?? -1) + 1;
}

// ---------- Paperwork list ----------

export async function addRequiredDocumentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const office = await officeManager();
  if (!office) return { error: "Only your broker or an admin can change office settings." };

  const label = text(formData.get("label"), 120);
  if (!label) return { fieldErrors: { label: "Name the document" } };
  const sides = formData.getAll("sides").filter((s): s is DealSide => SIDES.includes(s as DealSide));
  if (sides.length === 0) return { fieldErrors: { sides: "Pick at least one transaction type" } };

  await prisma.requiredDocument.create({
    data: { teamId: office.teamId, label, sides, order: await nextOrder(office.teamId, "requiredDocument") },
  });
  revalidate();
  return { success: "Added" };
}

export async function addStarterPaperworkAction() {
  const office = await officeManager();
  if (!office) return;

  const existing = await prisma.requiredDocument.findMany({
    where: { teamId: office.teamId },
    select: { label: true },
  });
  const have = new Set(existing.map((r) => r.label.toLowerCase()));
  let order = await nextOrder(office.teamId, "requiredDocument");
  const toAdd = STARTER_PAPERWORK.filter((r) => !have.has(r.label.toLowerCase()));
  if (toAdd.length === 0) return;

  await prisma.requiredDocument.createMany({
    data: toAdd.map((r) => ({ teamId: office.teamId, label: r.label, sides: r.sides, order: order++ })),
  });
  revalidate();
}

export async function updateRequiredDocumentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const office = await officeManager();
  if (!office) return { error: "Only your broker or an admin can change office settings." };

  const id = formData.get("id");
  if (typeof id !== "string") return { error: "Missing item" };
  const label = text(formData.get("label"), 120);
  if (!label) return { fieldErrors: { label: "Name the document" } };
  const sides = formData.getAll("sides").filter((s): s is DealSide => SIDES.includes(s as DealSide));
  if (sides.length === 0) return { fieldErrors: { sides: "Pick at least one transaction type" } };

  await prisma.requiredDocument.updateMany({ where: { id, teamId: office.teamId }, data: { label, sides } });
  revalidate();
  return { success: "Saved" };
}

// Removing an item from the list never touches documents already filed --
// their link just clears (onDelete: SetNull).
export async function deleteRequiredDocumentAction(formData: FormData) {
  const office = await officeManager();
  if (!office) return;
  const id = formData.get("id");
  if (typeof id !== "string") return;
  await prisma.requiredDocument.deleteMany({ where: { id, teamId: office.teamId } });
  revalidate();
}

// ---------- Office checklist template ----------

export async function addChecklistItemAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const office = await officeManager();
  if (!office) return { error: "Only your broker or an admin can change office settings." };

  const label = text(formData.get("label"), 120);
  if (!label) return { fieldErrors: { label: "Name the task" } };

  await prisma.officeChecklistItem.create({
    data: { teamId: office.teamId, label, order: await nextOrder(office.teamId, "officeChecklistItem") },
  });
  revalidate();
  return { success: "Added" };
}

export async function addStarterChecklistAction() {
  const office = await officeManager();
  if (!office) return;

  const existing = await prisma.officeChecklistItem.findMany({
    where: { teamId: office.teamId },
    select: { label: true },
  });
  const have = new Set(existing.map((r) => r.label.toLowerCase()));
  let order = await nextOrder(office.teamId, "officeChecklistItem");
  const toAdd = STANDARD_OFFICE_CHECKLIST.filter((label) => !have.has(label.toLowerCase()));
  if (toAdd.length === 0) return;

  await prisma.officeChecklistItem.createMany({
    data: toAdd.map((label) => ({ teamId: office.teamId, label, order: order++ })),
  });
  revalidate();
}

export async function deleteChecklistItemAction(formData: FormData) {
  const office = await officeManager();
  if (!office) return;
  const id = formData.get("id");
  if (typeof id !== "string") return;
  await prisma.officeChecklistItem.deleteMany({ where: { id, teamId: office.teamId } });
  revalidate();
}

// Swap with the neighbour above or below. Both rows are fetched through
// teamId, so only this office's items can move.
export async function moveOfficeItemAction(formData: FormData) {
  const office = await officeManager();
  if (!office) return;

  const id = formData.get("id");
  const list = formData.get("list");
  const direction = formData.get("direction") === "up" ? "up" : "down";
  if (typeof id !== "string" || (list !== "paperwork" && list !== "checklist")) return;

  const rows =
    list === "paperwork"
      ? await prisma.requiredDocument.findMany({ where: { teamId: office.teamId }, orderBy: { order: "asc" }, select: { id: true, order: true } })
      : await prisma.officeChecklistItem.findMany({ where: { teamId: office.teamId }, orderBy: { order: "asc" }, select: { id: true, order: true } });

  const index = rows.findIndex((r) => r.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= rows.length) return;

  // Renumber the whole list in its new order -- simpler and immune to
  // duplicate order values left over from earlier edits.
  const ids = rows.map((r) => r.id);
  [ids[index], ids[swapWith]] = [ids[swapWith], ids[index]];
  await prisma.$transaction(
    ids.map((rowId, order) =>
      list === "paperwork"
        ? prisma.requiredDocument.updateMany({ where: { id: rowId, teamId: office.teamId }, data: { order } })
        : prisma.officeChecklistItem.updateMany({ where: { id: rowId, teamId: office.teamId }, data: { order } }),
    ),
  );
  revalidate();
}

// ---------- Vendor directory ----------

function vendorFields(formData: FormData) {
  const kind = formData.get("kind");
  return {
    kind: KINDS.includes(kind as VendorKind) ? (kind as VendorKind) : null,
    name: text(formData.get("name"), 120),
    contactName: text(formData.get("contactName"), 120),
    email: text(formData.get("email"), 200),
    phone: text(formData.get("phone"), 40),
    notes: text(formData.get("notes"), 500),
  };
}

export async function saveVendorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const office = await officeManager();
  if (!office) return { error: "Only your broker or an admin can change office settings." };

  const { kind, name, ...rest } = vendorFields(formData);
  if (!kind) return { fieldErrors: { kind: "Pick a type" } };
  if (!name) return { fieldErrors: { name: "Give the vendor a name" } };
  if (rest.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rest.email)) {
    return { fieldErrors: { email: "That doesn't look like an email address" } };
  }

  const id = formData.get("id");
  if (typeof id === "string" && id) {
    await prisma.vendor.updateMany({ where: { id, teamId: office.teamId }, data: { kind, name, ...rest } });
  } else {
    await prisma.vendor.create({ data: { teamId: office.teamId, kind, name, ...rest } });
  }
  revalidate();
  return { success: "Saved" };
}

// Removing a vendor detaches it from every file (DealVendor cascades); the
// files themselves are untouched.
export async function deleteVendorAction(formData: FormData) {
  const office = await officeManager();
  if (!office) return;
  const id = formData.get("id");
  if (typeof id !== "string") return;
  await prisma.vendor.deleteMany({ where: { id, teamId: office.teamId } });
  revalidate();
}
