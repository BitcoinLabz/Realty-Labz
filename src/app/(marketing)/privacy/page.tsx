import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Realty Labz",
  description: "How Realty Labz collects, stores, and protects your data and your clients' data.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Privacy Policy</h1>
        <p className="text-sm text-muted">Last updated August 2026.</p>
        <p className="rounded-xl border border-border bg-background p-4 text-sm text-muted">
          This is a good-faith, plain-language summary of how Realty Labz handles data — it is not
          attorney-drafted legal advice. If you have specific legal questions about data handling
          or compliance, please consult a lawyer.
        </p>
      </div>

      <Section title="Who this covers">
        <p>
          This policy covers real estate agents, teams, and brokerages who use Realty Labz (&ldquo;you&rdquo;
          or &ldquo;agents&rdquo;), and the clients those agents work with, who may receive a document to sign
          or a portal link but never create an account of their own.
        </p>
      </Section>

      <Section title="What we collect">
        <p>
          <strong className="text-foreground">Account info.</strong> Your name, email address, and
          either a securely hashed password (we never store or can see your plaintext password) or,
          if you sign in with Google, the basic profile info Google shares (name and email) after you
          approve it.
        </p>
        <p>
          <strong className="text-foreground">Client information you enter.</strong> Contact details,
          notes, lead source, and pipeline stage for the clients you work with. This data belongs to
          you and your team, never to us, and we never share it with anyone outside your account.
        </p>
        <p>
          <strong className="text-foreground">Financial data.</strong> Business income/expenses,
          mileage logs, deal and commission details, budgets, and — if you choose to enter it — your
          own personal finances (assets, loans, net worth). Personal financial data (your own
          investments and personal transactions) is never visible to anyone else on your team, even a
          broker or admin — this is a deliberate design choice, not an oversight. Business data on a
          team account is visible to your team&apos;s managers, the same way a real brokerage works.
        </p>
        <p>
          <strong className="text-foreground">Documents and signed contracts.</strong> Files you
          upload are stored in a private location only your account can reach. When a document is
          sent for e-signature, we record the signer&apos;s name, email, IP address, and the exact
          timestamp consent was given — this is standard practice for legally-binding electronic
          signatures under the U.S. ESIGN Act and UETA, and forms the audit trail behind every signed
          document.
        </p>
        <p>
          <strong className="text-foreground">Client portal access.</strong> If you share a portal
          link with a client, their browser holds a private access token in a cookie. That token
          expires automatically after 30 days and only ever reveals that one client&apos;s own deal
          status and documents — never anyone else&apos;s.
        </p>
      </Section>

      <Section title="Third parties we work with">
        <p>
          We use a small number of well-established providers to run Realty Labz, and none of them
          receive more than what they need to do their specific job:
        </p>
        <ul className="list-disc pl-5">
          <li>
            <strong className="text-foreground">Supabase</strong> — our database and private file
            storage.
          </li>
          <li>
            <strong className="text-foreground">Resend</strong> — sends transactional email (signing
            requests, portal access links) on our behalf.
          </li>
          <li>
            <strong className="text-foreground">Vercel</strong> — hosts the application.
          </li>
          <li>
            <strong className="text-foreground">Google</strong> — only if you choose &ldquo;Sign in
            with Google.&rdquo;
          </li>
          <li>
            A small set of free, public price-lookup services (for crypto wallet balances and stock
            prices, only if you choose to link one) — these only ever receive a wallet address or
            ticker symbol you provide, never any client or account information.
          </li>
        </ul>
      </Section>

      <Section title="Your control over your data">
        <p>
          You can edit or delete your clients, transactions, documents, and other records directly
          in the app at any time. If you&apos;d like your account and all associated data permanently
          deleted, contact us on the{" "}
          <a href="/support" className="text-accent hover:opacity-80">
            Support
          </a>{" "}
          page and we&apos;ll take care of it.
        </p>
      </Section>

      <Section title="Questions">
        <p>
          If you have questions about this policy or how your data is handled, reach out through the{" "}
          <a href="/support" className="text-accent hover:opacity-80">
            Support
          </a>{" "}
          page.
        </p>
      </Section>
    </div>
  );
}
