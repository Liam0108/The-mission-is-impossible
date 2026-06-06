"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BriefcaseBusiness, Calculator, ClipboardList, LineChart, Moon, PiggyBank, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANGUAGES, getStoredLanguage, labels, type Language } from "@/lib/i18n";

const nav = [
  { href: "/", labelKey: "dashboard", icon: BarChart3 },
  { href: "/trades", labelKey: "tradeLogger", icon: ClipboardList },
  { href: "/edge-lab", labelKey: "edgeLab", icon: Calculator },
  { href: "/investment-lab", labelKey: "investmentLab", icon: BriefcaseBusiness },
  { href: "/freedom-dashboard", labelKey: "freedomDashboard", icon: PiggyBank }
];

const experimentalNav = [
  { href: "/market-lab", labelKey: "marketLab", icon: LineChart }
];

const navCopy: Record<Language, Record<string, string>> = {
  en: {
    dashboard: "Dashboard",
    tradeLogger: "Trade Logger",
    edgeLab: "Edge Lab",
    investmentLab: "Investment Lab",
    freedomDashboard: "Freedom Dashboard",
    marketLab: "Market Lab",
    workspace: "Workspace",
    experimental: "Experimental",
    researchMode: "Research mode"
  },
  zh: {
    dashboard: "仪表盘",
    tradeLogger: "交易记录",
    edgeLab: "数学优势",
    investmentLab: "投资实验室",
    freedomDashboard: "自由目标",
    marketLab: "市场实验室",
    workspace: "工作区",
    experimental: "实验功能",
    researchMode: "研究模式"
  },
  ja: {
    dashboard: "ダッシュボード",
    tradeLogger: "トレード記録",
    edgeLab: "エッジ分析",
    investmentLab: "投資ラボ",
    freedomDashboard: "目標管理",
    marketLab: "市場ラボ",
    workspace: "ワークスペース",
    experimental: "実験機能",
    researchMode: "研究モード"
  }
};

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
  const navigation = navCopy[language];

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-stroke bg-panel/95 px-4 py-5 backdrop-blur xl:block">
        <div className="flex h-full flex-col">
          <Link href="/" className="focus-ring flex items-center gap-3 rounded-lg px-2 py-1">
            <div className="grid h-9 w-9 place-items-center rounded-lg border border-accent/30 bg-accent/10 text-sm font-semibold text-accent">
              FE
            </div>
            <div>
              <div className="text-sm font-semibold text-ink">Fabio Edge</div>
              <div className="mt-0.5 text-xs text-muted">Research Lab</div>
            </div>
          </Link>

          <div className="mt-8 px-3 text-[11px] font-medium uppercase tracking-wide text-muted">{navigation.workspace}</div>
          <nav className="mt-2 grid gap-1">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "focus-ring flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted transition hover:bg-canvas hover:text-ink",
                    active && "bg-accent/10 text-ink"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {navigation[item.labelKey]}
                </Link>
              );
            })}
          </nav>

          <div className="mt-7">
            <div className="px-3 text-[11px] font-medium uppercase tracking-wide text-muted">{navigation.experimental}</div>
            <nav className="mt-2 grid gap-1">
              {experimentalNav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "focus-ring flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted transition hover:bg-canvas hover:text-ink",
                      active && "bg-accent/10 text-ink"
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {navigation[item.labelKey]}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto rounded-lg border border-stroke bg-canvas p-3 text-xs leading-5 text-muted">
            <div className="flex items-center gap-2 font-medium text-ink">
              <span className="h-2 w-2 rounded-full bg-positive" />
              {navigation.researchMode}
            </div>
            <div className="mt-1">{copy.decisionSupport}</div>
            <label className="mt-3 block text-[11px] uppercase text-muted">
              {copy.language}
              <select
                className="mt-1 h-8 w-full rounded-md border border-stroke bg-panel px-2 text-xs text-ink"
                value={language}
                onChange={(event) => changeLanguage(event.target.value as Language)}
              >
                {LANGUAGES.map((item) => (
                  <option key={item} value={item}>{item.toUpperCase()}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-10 border-b border-stroke bg-panel/95 px-3 py-3 backdrop-blur sm:px-4 xl:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 font-semibold text-ink">
            <span className="grid h-8 w-8 place-items-center rounded-md border border-accent/30 bg-accent/10 text-xs text-accent">FE</span>
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
                <option key={item} value={item}>{item.toUpperCase()}</option>
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
                  "focus-ring flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-xs font-medium text-muted",
                  active && "bg-accent/10 text-ink"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{navigation[item.labelKey]}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="min-w-0 xl:pl-64">
        <div className="mx-auto min-h-screen min-w-0 max-w-[1680px] px-3 py-4 sm:px-5 sm:py-6 lg:px-7 xl:px-8">
          <div className="mb-4 hidden justify-end xl:flex">
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
