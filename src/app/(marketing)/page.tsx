import Link from "next/link";
import { auth } from "@/auth";
import {
  CalendarClock,
  ClipboardSignature,
  DoorOpen,
  FileSearch,
  House,
  Wallet,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { FREE_FEATURES, PRO_FEATURES, PRO_PRICE } from "@/lib/plan";

const features = [
  {
    icon: CalendarClock,
    title: "Transactions and deadlines",
    description:
      "Every buyer and seller file in one list: status, closing date, and the contingencies on that contract. Dates follow the rule you set, and a one-tap extension moves only the deadlines that should move.",
  },
  {
    icon: FileSearch,
    title: "Contract reader",
    description:
      "Upload the purchase agreement. Realty Labz reads the deadlines, deposits, and extension options, then shows you what it found — and what it may have missed — before anything is saved.",
  },
  {
    icon: ClipboardSignature,
    title: "E-sign",
    description:
      "Place fields on the PDFs you already use and send them for signature, in order. Consent, IP address, and the time are kept with the finished document.",
  },
  {
    icon: DoorOpen,
    title: "Open houses",
    description:
      "A sign-in page for the door. Guests don't need an account. Their names come back to the file, and one tap turns a visitor into a client.",
  },
  {
    icon: Wallet,
    title: "Income, mileage, and taxes",
    description:
      "Business and personal income and expenses, a mileage log at the Michigan rate, and an estimate that includes federal tax, Michigan tax, and city tax where your home or office has one.",
  },
  {
    icon: House,
    title: "Home office",
    description:
      "The simplified method and the regular method, side by side, with a plain-English recommendation and a report you can hand your accountant.",
  },
];

const yearlyPerMonth = (PRO_PRICE.annual / 12).toFixed(2);
const yearlySavings = PRO_PRICE.monthly * 12 - PRO_PRICE.annual;

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Realty Labz",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Transactions, contract deadlines, e-sign, open houses, and Michigan income, mileage, tax, and home-office records for real estate agents.",
  url: "https://www.realtylabz.com",
  offers: [
    {
      "@type": "Offer",
      name: "Free",
      price: "0",
      priceCurrency: "USD",
      description: "Everything you do by hand.",
    },
    {
      "@type": "Offer",
      name: "Pro monthly",
      price: String(PRO_PRICE.monthly),
      priceCurrency: "USD",
      description: "AI contract reading and unlimited document storage.",
    },
    {
      "@type": "Offer",
      name: "Pro yearly",
      price: String(PRO_PRICE.annual),
      priceCurrency: "USD",
      description: "AI contract reading and unlimited document storage, billed yearly.",
    },
  ],
};

export default async function HomePage() {
  const session = await auth();
  const primaryHref = session ? "/dashboard" : "/signup";
  const primaryLabel = session ? "Go to dashboard" : "Create your free account";

  return (
    <div className="flex flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <section className="px-4 py-16 sm:px-6 sm:py-28">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <Logo size="lg" />
          <p className="text-sm font-medium tracking-wide text-accent">For Michigan real estate agents</p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
            The transaction file, the contract, and the books. One calm place.
          </h1>
          <p className="max-w-xl text-pretty text-base text-muted sm:text-lg">
            Deadlines that follow the contract. A reader that pulls the dates out of the PDF. E-sign, open-house
            sign-in, and the income, mileage, tax, and home-office numbers your accountant asks for.
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href={primaryHref} className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto">{primaryLabel}</Button>
            </Link>
            <Link href="#pricing" className="w-full sm:w-auto">
              <Button variant="secondary" className="w-full sm:w-auto">
                See pricing
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted">
            Free for the work you do by hand. Pro is ${PRO_PRICE.monthly}/month or ${PRO_PRICE.annual}/year.
          </p>
        </div>
      </section>

      <section className="border-t border-border bg-background px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto flex max-w-5xl flex-col gap-10">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">What you actually open it for</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Built around a Michigan agent&apos;s day: the file, the dates in the contract, and the records that make
              April less painful.
            </p>
          </div>
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="flex min-w-0 flex-col gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <Icon size={20} />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-muted">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-6 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto flex max-w-5xl flex-col gap-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Simple pricing</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Start free. Upgrade when you want the contract reader and unlimited storage. Yearly is $
              {yearlyPerMonth}/month, ${yearlySavings} less than paying monthly. Cancel anytime. Prices are in US
              dollars, before any sales tax added at checkout.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex min-w-0 flex-col rounded-2xl border border-border bg-background">
              <div className="flex flex-col items-center gap-1 border-b border-border px-6 pb-6 pt-8 text-center">
                <h3 className="text-xl font-semibold tracking-wide text-foreground">FREE</h3>
                <p className="text-3xl font-semibold text-foreground">
                  $0<span className="text-base font-normal text-muted">/forever</span>
                </p>
                <p className="text-sm text-muted">Everything you do by hand.</p>
                <div className="mt-4 w-full">
                  <Link href={primaryHref}>
                    <Button variant="secondary" className="w-full">
                      {session ? "Go to dashboard" : "Start free"}
                    </Button>
                  </Link>
                </div>
              </div>
              <ul className="flex flex-col gap-2.5 px-6 py-6">
                {FREE_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                    <Check size={16} className="mt-0.5 shrink-0 text-accent" />
                    <span className="min-w-0">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative flex min-w-0 flex-col overflow-hidden rounded-2xl border-2 border-accent bg-background shadow-sm">
              <p className="bg-accent py-1.5 text-center text-xs font-semibold uppercase tracking-wider text-accent-foreground">
                Recommended
              </p>
              <div className="flex flex-col items-center gap-1 border-b border-border px-6 pb-6 pt-6 text-center">
                <h3 className="text-xl font-semibold tracking-wide text-accent">PRO</h3>
                <p className="text-3xl font-semibold text-foreground">
                  ${PRO_PRICE.monthly}
                  <span className="text-base font-normal text-muted">/month</span>
                </p>
                <p className="text-sm text-muted">or ${PRO_PRICE.annual}/year. Cancel anytime.</p>
                <div className="mt-4 w-full">
                  <Link href={session ? "/account#plan" : "/signup"}>
                    <Button className="w-full">{session ? "Upgrade in Settings" : "Go Pro"}</Button>
                  </Link>
                </div>
              </div>
              <ul className="flex flex-col gap-2.5 px-6 py-6">
                {PRO_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                    <Check size={16} className="mt-0.5 shrink-0 text-accent" />
                    <span className="min-w-0">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground">
            Built by a working Michigan Realtor
          </h2>
          <p className="text-pretty text-base text-muted">
            For their own files first, and for the brokerage they&apos;d want to run it in. Your clients, your income,
            and your personal finances stay yours.
          </p>
          <Link href={primaryHref} className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">{primaryLabel}</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
