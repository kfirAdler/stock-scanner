"use client";

import { ThemeProvider } from "next-themes";
import { type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      enableColorScheme
      themes={["light", "dark", "system"]}
      storageKey="theme"
    >
      {children}
    </ThemeProvider>
  );
}
