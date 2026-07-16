import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ClientForm } from "./client-form";
import { ClientList } from "./client-list";
import type { ClientDTO } from "./types";

export default async function ClientsPage() {
  const session = await auth();

  const clients = await prisma.client.findMany({
    where: { userId: session!.user.id },
    orderBy: { name: "asc" },
  });

  const dtos: ClientDTO[] = clients.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    notes: c.notes,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Clients</h1>
        <p className="mt-1 text-sm text-muted">Keep track of who you're working with.</p>
      </div>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Add a client</h2>
        <div className="max-w-md">
          <ClientForm />
        </div>
      </section>

      <ClientList clients={dtos} />
    </div>
  );
}
