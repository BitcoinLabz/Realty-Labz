import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Realty Labz",
  description: "The terms for using Realty Labz.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Terms of Service</h1>
        <p className="text-sm text-muted">Last updated August 2026.</p>
        <p className="rounded-xl border border-border bg-background p-4 text-sm text-muted">
          This is a good-faith, plain-language summary — not attorney-drafted legal advice. If you
          have specific legal questions, please consult a lawyer.
        </p>
      </div>

      <Section title="What Realty Labz is">
        <p>
          Realty Labz is a business-management tool for real estate professionals — client and deal
          tracking, e-signature contracts, financial tracking, and team/broker dashboards. It is built
          for licensed real estate professionals and their teams, not for consumer use.
        </p>
      </Section>

      <Section title="Your account">
        <p>
          You&apos;re responsible for keeping your login credentials secure and for the accuracy of the
          information you enter. You&apos;re responsible for having the right to store any client
          information you enter — Realty Labz is a tool for managing data you already lawfully hold as
          part of your work as an agent.
        </p>
      </Section>

      <Section title="Estimates, not professional advice">
        <p>
          Mileage deduction rates, estimated quarterly tax figures, home-office deduction amounts, and
          loan/equity projections shown in the app are estimates to help you plan — they are not tax,
          legal, or financial advice, and are not a substitute for a licensed accountant or attorney.
          Tax and mileage rules reflected in the app are scoped to Michigan and may not reflect your
          specific situation.
        </p>
      </Section>

      <Section title="Electronic signatures">
        <p>
          Documents signed through Realty Labz&apos;s e-signature feature are captured with a consent
          statement, IP address, and timestamp, consistent with the U.S. ESIGN Act and UETA. You are
          responsible for confirming a signed document meets any additional requirements specific to
          your transaction or jurisdiction.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>
          Don&apos;t use Realty Labz to store or transmit anything unlawful, to attempt to access another
          account or another team&apos;s data, or to interfere with the normal operation of the service.
        </p>
      </Section>

      <Section title="Account termination">
        <p>
          You may stop using Realty Labz and request deletion of your account and data at any time via
          the{" "}
          <a href="/support" className="text-accent hover:opacity-80">
            Support
          </a>{" "}
          page. We may suspend an account that violates these terms or poses a security risk to other
          users.
        </p>
      </Section>

      <Section title="Changes to these terms">
        <p>
          As Realty Labz grows, these terms may be updated. Material changes will be reflected here
          with an updated date at the top of this page.
        </p>
      </Section>

      <Section title="Questions">
        <p>
          Reach out through the{" "}
          <a href="/support" className="text-accent hover:opacity-80">
            Support
          </a>{" "}
          page with any questions about these terms.
        </p>
      </Section>
    </div>
  );
}
