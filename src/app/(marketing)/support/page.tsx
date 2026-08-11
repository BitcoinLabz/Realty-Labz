import type { Metadata } from "next";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Support — Realty Labz",
  description: "Get help with Realty Labz — send us a message and we'll get back to you.",
};

export default function SupportPage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Support</h1>
        <p className="text-sm text-muted">
          Question, bug report, or feedback — send it over and we&apos;ll get back to you.
        </p>
      </div>

      <ContactForm />
    </div>
  );
}
