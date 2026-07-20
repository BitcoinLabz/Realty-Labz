export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-surface px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-lg font-semibold tracking-tight text-foreground">
            Realty Labz
          </span>
        </div>
        <div className="rounded-2xl border border-border bg-background p-8 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
