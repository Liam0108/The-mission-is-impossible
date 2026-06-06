import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Fabio Edge Research Lab",
  description: "Trading research and decision-support platform."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
