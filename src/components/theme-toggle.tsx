"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

// Standard next-themes pattern: theme/resolvedTheme are undefined during SSR
// and the first client render (before next-themes reads localStorage), so
// rendering based on them before mount would cause a hydration mismatch --
// render a stable placeholder until mounted instead.
// `compact`: icon only, for the phone icon rail (see sidebar.tsx).
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className={compact ? "h-10 w-10" : "h-5 w-24"} aria-hidden="true" />;
  }

  const isDark = resolvedTheme === "dark";

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface hover:text-foreground"
      >
        {isDark ? <Moon size={18} /> : <Sun size={18} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground"
    >
      {isDark ? <Moon size={16} /> : <Sun size={16} />}
      {isDark ? "Dark mode" : "Light mode"}
    </button>
  );
}
