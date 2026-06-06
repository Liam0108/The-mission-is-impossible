"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BriefcaseBusiness, Calculator, ClipboardCheck, ClipboardList, Gauge, Images, LineChart, Microscope, Moon, PiggyBank, ShieldAlert, Sun, TestTube2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANGUAGES, getStoredLanguage, labels, type Language } from "@/lib/i18n";

const nav = [
  { href: "/", labelKey: "dashboard", icon: BarChart3 },
  { href: "/trades", labelKey: "tradeLogger", icon: ClipboardList },
  { href: "/edge-lab", labelKey: "edgeLab", icon: Calculator },
  { href: "/analyzer", labelKey: "setupAnalyzer", icon: Gauge },
  { href: "/management", labelKey: "managementLab", icon: TestTube2 },
  { href: "/risk", labelKey: "risk", icon: ShieldAlert },
  { href: "/investment-lab", labelKey: "investmentLab", icon: BriefcaseBusiness },
  { href: "/freedom-dashboard", labelKey: "freedomDashboard", icon: PiggyBank },
  { href: "/checklist", labelKey: "checklist", icon: ClipboardCheck },
  { href: "/screenshots", labelKey: "screenshots", icon: Images },
  { href: "/research", labelKey: "research", icon: Microscope }
];

const experimentalNav = [
  { href: "/market-lab", labelKey: "marketLab", icon: LineChart }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [dark, setDark] = useState(true);
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem("fabio-theme");
    const enabled = stored ? stored === "dark" : true;
    setDark(enabled);
    setLanguage(getStoredLanguage());
    document.documentElement.classList.toggle("dark", enabled);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("fabio-theme", next ? "dark" : "light");
  }

  function changeLanguage(value: Language) {
    setLanguage(value);
    window.localStorage.setItem("fabio-language", value);
    window.dispatchEvent(new CustomEvent("fabio-language-change", { detail: value }));
  }

  const copy = labels[language];
  const navLabel = (key: string) => {
    if (key === "investmentLab") return language === "zh" ? "投资实验室" : language === "ja" ? "投資ラボ" : "Investment Lab";
    return copy[key] ?? key;
  };

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-stroke bg-panel/95 px-5 py-6 backdrop-blur xl:block">
        <div className="flex h-full flex-col">
          <Link href="/" className="focus-ring rounded-lg">
            <div className="text-lg font-semibold text-ink">Fabio Edge</div>
            <div className="mt-1 text-sm text-muted">Research Lab</div>
          </Link>

          <nav className="mt-10 grid gap-1">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "focus-ring flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted transition hover:bg-canvas hover:text-ink",
                    active && "bg-canvas text-ink"
                  )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                {navLabel(item.labelKey)}
              </Link>
              );
            })}
          </nav>

          <div className="mt-6">
            <div className="px-3 text-[11px] font-medium uppercase tracking-wide text-muted">{copy.experimental ?? "Experimental"}</div>
            <nav className="mt-2 grid gap-1">
              {experimentalNav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "focus-ring flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted transition hover:bg-canvas hover:text-ink",
                      active && "bg-canvas text-ink"
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {navLabel(item.labelKey)}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto rounded-lg border border-stroke bg-canvas p-3 text-xs leading-5 text-muted">
            {copy.decisionSupport}
            <label className="mt-3 block text-[11px] uppercase text-muted">
              {copy.language}
              <select
                className="mt-1 h-8 w-full rounded-md border border-stroke bg-panel px-2 text-xs text-ink"
                value={language}
                onChange={(event) => changeLanguage(event.target.value as Language)}
              >
                {LANGUAGES.map((item) => (
                  <option key={item} value={item}>
                    {item.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-10 border-b border-stroke bg-panel/90 px-3 py-3 backdrop-blur sm:px-4 xl:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="font-semibold text-ink">
            Fabio Edge
          </Link>
          <div className="flex items-center gap-2">
            <select
              aria-label={copy.language}
              className="h-9 rounded-lg border border-stroke bg-panel px-2 text-xs text-ink"
              value={language}
              onChange={(event) => changeLanguage(event.target.value as Language)}
            >
              {LANGUAGES.map((item) => (
                <option key={item} value={item}>
                  {item.toUpperCase()}
                </option>
              ))}
            </select>
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={copy.toggleTheme}>
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <nav className="mt-3 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[...nav, ...experimentalNav].map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted",
                  active && "bg-canvas text-ink"
                )}
                aria-label={navLabel(item.labelKey)}
              >
                <Icon className="h-4 w-4" />
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="min-w-0 xl:pl-72">
        <div className="mx-auto min-h-screen min-w-0 max-w-[1600px] px-3 py-4 sm:px-5 sm:py-6 lg:px-7 xl:px-8">
          <div className="mb-6 hidden justify-end xl:flex">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={copy.toggleTheme}>
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
