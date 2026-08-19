"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

// Standard next-themes pattern: theme/resolvedTheme are undefined during SSR
// and the first client render (before next-themes reads localStorage), so
// rendering based on them before mount would cause a hydration mismatch --
// render a stable placeholder until mounted instead.
export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-5 w-24" aria-hidden="true" />;
  }

  const isDark = resolvedTheme === "dark";

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
