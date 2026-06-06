"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Archive, BriefcaseBusiness, Calculator, Save, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DashboardCard,
  DataTableWrapper,
  EmptyState,
  MetricCard,
  SectionHeader,
  StatusBadge
} from "@/components/ui/dashboard";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { StockAnalysis } from "@/lib/investment-engine";
import {
  PORTFOLIO_BUILDER_SETTINGS_KEY,
  PORTFOLIO_MODES,
  PORTFOLIO_PLANS_KEY,
  buildResearchPortfolio,
  defaultPortfolioBuilderSettings,
  normalizePortfolioBuilderSettings,
  portfolioModeSettings,
  type PortfolioBuilderSettings,
  type PortfolioMode,
  type SavedPortfolioPlan
} from "@/lib/portfolio-builder";

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeStored<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function currency(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function percent(value: number) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

function planId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `portfolio-plan-${Date.now()}`;
}

function NumericSetting({
  label,
  value,
  min,
  max,
  step = 1,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </Field>
  );
}

export function PortfolioBuilderV1({ analyses }: { analyses: StockAnalysis[] }) {
  const [settings, setSettings] = useState<PortfolioBuilderSettings>(defaultPortfolioBuilderSettings());
  const [plans, setPlans] = useState<SavedPortfolioPlan[]>([]);
  const [planName, setPlanName] = useState("Balanced Research Plan");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Allocation updates automatically when assumptions change.");
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    setSettings(normalizePortfolioBuilderSettings(
      readStored<PortfolioBuilderSettings>(PORTFOLIO_BUILDER_SETTINGS_KEY, defaultPortfolioBuilderSettings())
    ));
    setPlans(readStored<SavedPortfolioPlan[]>(PORTFOLIO_PLANS_KEY, []));
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    writeStored(PORTFOLIO_BUILDER_SETTINGS_KEY, settings);
  }, [settings, storageReady]);

  const result = useMemo(() => buildResearchPortfolio(analyses, settings), [analyses, settings]);

  function changeMode(mode: PortfolioMode) {
    setSettings(portfolioModeSettings(mode, settings.totalInvestmentAmount));
    setPlanName(`${mode} Research Plan`);
    setStatus(`${mode} assumptions applied. Review the limits before saving.`);
  }

  function updateSetting<K extends keyof PortfolioBuilderSettings>(key: K, value: PortfolioBuilderSettings[K]) {
    setSettings((current) => normalizePortfolioBuilderSettings({ ...current, [key]: value }));
  }

  function savePlan() {
    const name = planName.trim();
    if (!name) {
      setStatus("Enter a plan name before saving.");
      return;
    }
    const plan: SavedPortfolioPlan = {
      id: planId(),
      name,
      createdAt: new Date().toISOString(),
      notes: notes.trim(),
      settings,
      allocations: result.allocations,
      excluded: result.excluded,
      summary: result.summary
    };
    const next = [plan, ...plans];
    setPlans(next);
    writeStored(PORTFOLIO_PLANS_KEY, next);
    setStatus(`Saved "${name}" with ${plan.allocations.length} research holdings.`);
  }

  function loadPlan(plan: SavedPortfolioPlan) {
    setSettings(normalizePortfolioBuilderSettings(plan.settings));
    setPlanName(plan.name);
    setNotes(plan.notes);
    setStatus(`Loaded assumptions from "${plan.name}".`);
  }

  function deletePlan(id: string) {
    const next = plans.filter((plan) => plan.id !== id);
    setPlans(next);
    writeStored(PORTFOLIO_PLANS_KEY, next);
    setStatus("Saved plan deleted.");
  }

  const summary = result.summary;
  return (
    <div className="grid min-w-0 gap-4 sm:gap-6">
      <DashboardCard padding="default">
        <SectionHeader
          eyebrow="Research allocation"
          title="Portfolio Builder V1"
          description="Convert eligible Investment Lab candidates into a constrained research allocation. No orders are created."
          action={<StatusBadge tone="caution">Research only</StatusBadge>}
        />
        <div className="mt-4 rounded-md border border-caution/30 bg-caution/5 px-3 py-2 text-sm leading-6 text-ink">
          This is a research-only allocation model, not financial advice or an order recommendation.
        </div>
      </DashboardCard>

      <DashboardCard padding="default">
        <SectionHeader
          title="Portfolio Mode"
          description="Modes change allocation assumptions only. Existing stock scores and valuation models are not modified."
        />
        <div className="mt-4 flex min-w-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {PORTFOLIO_MODES.map((mode) => (
            <Button
              key={mode}
              type="button"
              variant={settings.mode === mode ? "primary" : "secondary"}
              className="shrink-0"
              onClick={() => changeMode(mode)}
            >
              {mode}
            </Button>
          ))}
        </div>
        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <NumericSetting label="Total Investment Amount $" value={settings.totalInvestmentAmount} min={0} max={1_000_000_000} step={1000} onChange={(value) => updateSetting("totalInvestmentAmount", value)} />
          <NumericSetting label="Cash Reserve Target %" value={settings.cashReservePct} min={0} max={80} onChange={(value) => updateSetting("cashReservePct", value)} />
          <NumericSetting label="Max Single Stock %" value={settings.maxSingleStockPct} min={1} max={50} onChange={(value) => updateSetting("maxSingleStockPct", value)} />
          <NumericSetting label="Max Sector %" value={settings.maxSectorPct} min={5} max={100} onChange={(value) => updateSetting("maxSectorPct", value)} />
          <NumericSetting label="Max High-Risk Exposure %" value={settings.maxHighRiskPct} min={0} max={100} onChange={(value) => updateSetting("maxHighRiskPct", value)} />
          <NumericSetting label="Max Speculative Exposure %" value={settings.maxSpeculativePct} min={0} max={50} onChange={(value) => updateSetting("maxSpeculativePct", value)} />
          <NumericSetting label="Preferred Holdings" value={settings.preferredHoldings} min={1} max={50} onChange={(value) => updateSetting("preferredHoldings", value)} />
          <Field label="High-Risk Candidates">
            <label className="flex h-10 cursor-pointer items-center gap-3 rounded-lg border border-stroke bg-panel px-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={settings.allowHighRiskStocks}
                onChange={(event) => updateSetting("allowHighRiskStocks", event.target.checked)}
              />
              Allow within risk caps
            </label>
          </Field>
        </div>
      </DashboardCard>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Invested" value={currency(summary.totalInvested)} helper={`${percent(100 - summary.cashPct)} of total amount`} icon={<BriefcaseBusiness className="h-4 w-4" />} />
        <MetricCard label="Cash Kept" value={currency(summary.cashKept)} helper={percent(summary.cashPct)} icon={<ShieldCheck className="h-4 w-4" />} tone="positive" />
        <MetricCard label="Holdings" value={summary.holdingsCount} helper={`${result.eligibleCount} eligible candidates`} icon={<Archive className="h-4 w-4" />} />
        <MetricCard label="Largest Position" value={summary.largestPosition?.ticker ?? "--"} helper={summary.largestPosition ? percent(summary.largestPosition.allocationPct) : "No allocation"} icon={<Calculator className="h-4 w-4" />} />
      </div>

      <DashboardCard padding="default">
        <SectionHeader
          title="Portfolio Risk Summary"
          description="All exposure percentages are measured against the total investment amount, including cash."
          action={<StatusBadge tone={summary.warnings.length ? "caution" : "positive"}>{summary.warnings.length ? `${summary.warnings.length} warnings` : "Within limits"}</StatusBadge>}
        />
        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0 rounded-md border border-stroke bg-canvas p-3">
            <div className="text-xs text-muted">Largest sector</div>
            <div className="mt-1 text-base font-semibold text-ink">{summary.largestSector?.sector ?? "--"}</div>
            <div className="mt-1 text-xs text-muted">{summary.largestSector ? percent(summary.largestSector.allocationPct) : "No allocation"}</div>
          </div>
          <div className="min-w-0 rounded-md border border-stroke bg-canvas p-3">
            <div className="text-xs text-muted">High-risk exposure</div>
            <div className="mt-1 text-base font-semibold text-ink">{percent(summary.highRiskExposurePct)}</div>
            <div className="mt-1 text-xs text-muted">Limit {percent(settings.maxHighRiskPct)}</div>
          </div>
          <div className="min-w-0 rounded-md border border-stroke bg-canvas p-3">
            <div className="text-xs text-muted">Speculative exposure</div>
            <div className="mt-1 text-base font-semibold text-ink">{percent(summary.speculativeExposurePct)}</div>
            <div className="mt-1 text-xs text-muted">Limit {percent(settings.maxSpeculativePct)}</div>
          </div>
          <div className="min-w-0 rounded-md border border-stroke bg-canvas p-3">
            <div className="text-xs text-muted">Sector diversification</div>
            <div className="mt-1 text-base font-semibold text-ink">{summary.sectorAllocations.length} sectors</div>
            <div className="mt-1 truncate text-xs text-muted">{summary.sectorAllocations.map((row) => row.sector).join(", ") || "No allocation"}</div>
          </div>
        </div>
        {summary.warnings.length ? (
          <div className="mt-4 grid gap-2">
            {summary.warnings.map((warning) => (
              <div key={warning} className="flex items-start gap-2 rounded-md border border-caution/30 bg-caution/5 px-3 py-2 text-sm text-ink">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-caution" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        ) : null}
      </DashboardCard>

      <DashboardCard padding="default">
        <SectionHeader
          title="Suggested Research Allocation"
          description="Candidates are ranked by quality, valuation, scenario upside, risk/reward, reliability, and diversification constraints."
          action={<StatusBadge tone={result.allocations.length ? "positive" : "neutral"}>{result.allocations.length} selected</StatusBadge>}
        />
        <div className="mt-4 min-w-0">
          {result.allocations.length ? (
            <DataTableWrapper>
              <table className="w-full min-w-[1120px] text-left text-xs">
                <thead className="border-b border-stroke bg-canvas text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Stock</th>
                    <th className="px-3 py-2 font-medium">Sector</th>
                    <th className="px-3 py-2 text-right font-medium">Allocation</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Risk / Scenario</th>
                    <th className="px-3 py-2 font-medium">Reliability</th>
                    <th className="px-3 py-2 font-medium">Why Included</th>
                    <th className="px-3 py-2 font-medium">What Limited It</th>
                  </tr>
                </thead>
                <tbody>
                  {result.allocations.map((allocation) => (
                    <tr key={allocation.ticker} className="border-b border-stroke/70 align-top last:border-0">
                      <td className="px-3 py-3">
                        <div className="font-semibold text-ink">{allocation.ticker}</div>
                        <div className="mt-1 max-w-40 truncate text-muted">{allocation.company || "--"}</div>
                      </td>
                      <td className="px-3 py-3 text-muted">{allocation.sector}</td>
                      <td className="px-3 py-3 text-right font-semibold text-ink">{percent(allocation.allocationPct)}</td>
                      <td className="px-3 py-3 text-right text-ink">{currency(allocation.dollarAmount)}</td>
                      <td className="px-3 py-3 text-muted">
                        <div>{allocation.riskLabel}</div>
                        <div className="mt-1">{allocation.scenarioLabel}</div>
                      </td>
                      <td className="px-3 py-3 text-muted">
                        <div>{allocation.realDataPercent}% real data</div>
                        <div className="mt-1">{allocation.recommendationConfidence} confidence</div>
                      </td>
                      <td className="max-w-64 px-3 py-3 text-muted">
                        <div className="break-words">{allocation.reason}</div>
                        <div className="mt-2 break-words text-ink">Risk: {allocation.biggestRisk}</div>
                        <div className="mt-1 break-words">Valuation: {allocation.valuationConcern}</div>
                      </td>
                      <td className="max-w-48 px-3 py-3 text-muted">
                        {allocation.limitedBy.length ? allocation.limitedBy.join(", ") : "Research-priority weighting"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableWrapper>
          ) : (
            <EmptyState
              title="No eligible allocation yet"
              description="Add reliable stocks with valid scenario data and positive weighted upside. Review exclusions below for the current blockers."
            />
          )}
        </div>
      </DashboardCard>

      <DashboardCard padding="default">
        <SectionHeader
          title="Excluded Candidates"
          description="Stocks remain visible with the first research rule that prevented allocation."
          action={<StatusBadge>{result.excluded.length} excluded</StatusBadge>}
        />
        <div className="mt-4 min-w-0">
          {result.excluded.length ? (
            <DataTableWrapper>
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="border-b border-stroke bg-canvas text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Stock</th>
                    <th className="px-3 py-2 font-medium">Sector</th>
                    <th className="px-3 py-2 font-medium">Why Excluded</th>
                    <th className="px-3 py-2 text-right font-medium">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {result.excluded.slice(0, 100).map((candidate) => (
                    <tr key={candidate.ticker} className="border-b border-stroke/70 last:border-0">
                      <td className="px-3 py-3">
                        <div className="font-semibold text-ink">{candidate.ticker}</div>
                        <div className="mt-1 max-w-52 truncate text-muted">{candidate.company || "--"}</div>
                      </td>
                      <td className="px-3 py-3 text-muted">{candidate.sector}</td>
                      <td className="px-3 py-3 text-muted">{candidate.reasons.join(", ")}</td>
                      <td className="px-3 py-3 text-right text-ink">{candidate.priorityScore ?? "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableWrapper>
          ) : (
            <EmptyState title="No exclusions" description="Every available candidate is currently included." />
          )}
        </div>
      </DashboardCard>

      <DashboardCard padding="default">
        <SectionHeader
          title="Save Research Plan"
          description="Saved plans are local snapshots of assumptions, allocations, exclusions, and notes."
          action={<StatusBadge>{plans.length} saved</StatusBadge>}
        />
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <div className="grid gap-3">
            <Field label="Plan Name">
              <Input value={planName} onChange={(event) => setPlanName(event.target.value)} placeholder="Balanced long-term plan" />
            </Field>
            <Field label="Notes">
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Research assumptions, concerns, or review date" />
            </Field>
            <Button type="button" variant="primary" onClick={savePlan} disabled={!result.allocations.length}>
              <Save className="h-4 w-4" />
              Save Current Plan
            </Button>
            <div className="rounded-md border border-stroke bg-canvas px-3 py-2 text-xs leading-5 text-muted">{status}</div>
          </div>
          <div className="grid content-start gap-2">
            {plans.length ? plans.map((plan) => (
              <div key={plan.id} className="grid min-w-0 gap-3 rounded-md border border-stroke bg-canvas p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{plan.name}</div>
                  <div className="mt-1 text-xs text-muted">
                    {new Date(plan.createdAt).toLocaleString()} | {plan.settings.mode} | {plan.allocations.length} holdings | {currency(plan.summary.totalInvestment)}
                  </div>
                  {plan.notes ? <div className="mt-2 line-clamp-2 text-xs leading-5 text-muted">{plan.notes}</div> : null}
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => loadPlan(plan)}>Load</Button>
                  <Button type="button" size="icon" variant="ghost" aria-label={`Delete ${plan.name}`} onClick={() => deletePlan(plan.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )) : (
              <EmptyState title="No saved plans" description="Save the current allocation to compare assumptions later." />
            )}
          </div>
        </div>
      </DashboardCard>
    </div>
  );
}
