import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { CreateFileForm } from "./create-transaction-form";

export default async function NewFilePage() {
  const session = await auth();

  const clients = await prisma.client.findMany({
    where: { userId: session!.user.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/transactions"
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
        >
          ← Back to Transactions
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">New transaction</h1>
        <p className="mt-1 text-sm text-muted">
          A few details to get started — you can fill in the rest later.
        </p>
      </div>

      <CreateFileForm clients={clients} />
    </div>
  );
}
