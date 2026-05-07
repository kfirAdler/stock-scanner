"use client";

import { ThemeProvider } from "next-themes";
import { type ReactNode, useEffect } from "react";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    const storedTheme = window.localStorage.getItem("theme");
    if (storedTheme !== "light" && storedTheme !== "dark") {
      window.localStorage.setItem("theme", "light");
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "light";
    }
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      enableColorScheme
      themes={["light", "dark"]}
      storageKey="theme"
    >
      {children}
    </ThemeProvider>
  );
}
