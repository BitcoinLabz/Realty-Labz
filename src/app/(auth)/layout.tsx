import { Logo } from "@/components/ui/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-surface px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo size="md" href="/" />
        </div>
        <main className="rounded-2xl border border-border bg-background p-8 shadow-sm">
          {children}
        </main>
      </div>
    </div>
  );
}
