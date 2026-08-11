import Link from "next/link";
import { auth } from "@/auth";
import { Building2, ClipboardSignature, LayoutDashboard, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

const features = [
  {
    icon: LayoutDashboard,
    title: "Client-centric deals & CRM",
    description:
      "Track every buyer and seller deal through your clients — lead source, pipeline stage, deadlines, open-house sign-ins, and referral-partner commissions, all organized the way you actually work.",
  },
  {
    icon: ClipboardSignature,
    title: "Legally-binding e-signature contracts",
    description:
      "Build a reusable form library, place fields on any PDF, and send for sequential signature with a full consent, IP address, and timestamp audit trail — no more buggy text boxes.",
  },
  {
    icon: Building2,
    title: "Team & broker dashboard",
    description:
      "Invite your team, see every agent's active deals and commission at a glance, and catch missing paperwork before it becomes a problem — built for teams and brokerages, not just solo agents.",
  },
  {
    icon: Wallet,
    title: "Full personal + business finances",
    description:
      "Mileage, expenses, budgets, loans, net worth, estimated quarterly taxes, and CSV bank import — your entire financial picture, business and personal, in one place with a real accountant-ready export.",
  },
  {
    icon: Users,
    title: "A private portal for your clients",
    description:
      "Share a secure link so clients can check their own deal status and documents anytime — without ever creating an account or waiting on a phone call.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Realty Labz",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Deals, e-signed contracts, clients, and full personal + business finances for real estate agents and their teams.",
  url: "https://www.realtylabz.com",
};

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="flex flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <Logo size="lg" />
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Run your real estate business from one calm place
          </h1>
          <p className="max-w-xl text-lg text-muted">
            Deals, e-signed contracts, clients, and your full financial picture — business and
            personal — built for Michigan real estate agents and their teams.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={session ? "/dashboard" : "/signup"}>
              <Button>{session ? "Go to dashboard" : "Get started"}</Button>
            </Link>
            {!session ? (
              <Link href="/login">
                <Button variant="secondary">Log in</Button>
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-background px-6 py-20">
        <div className="mx-auto grid max-w-5xl gap-10 sm:grid-cols-2">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="flex flex-col gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Icon size={20} />
                </div>
                <h2 className="text-lg font-semibold text-foreground">{feature.title}</h2>
                <p className="text-sm leading-relaxed text-muted">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <p className="text-lg text-foreground">
            Built by a working Michigan Realtor who wanted a better tool than what was out there —
            and kept building it into the platform their whole team could run on.
          </p>
          <Link href={session ? "/dashboard" : "/signup"}>
            <Button>{session ? "Go to dashboard" : "Get started free"}</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
