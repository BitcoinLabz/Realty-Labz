import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Logo } from "@/components/ui/logo";
import { VisitorForm } from "./visitor-form";

function StatusScreen({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted">{body}</p>
      </div>
    </div>
  );
}

export default async function OpenHousePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const openHouse = await prisma.openHouse.findUnique({
    where: { id },
    include: { deal: { select: { propertyAddress: true } } },
  });

  if (!openHouse) notFound();

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo size="md" />
          <h1 className="text-lg font-semibold text-foreground">Welcome — sign in below</h1>
          <p className="text-sm text-muted">{openHouse.deal.propertyAddress}</p>
        </div>
        <VisitorForm openHouseId={openHouse.id} />
      </div>
    </div>
  );
}
