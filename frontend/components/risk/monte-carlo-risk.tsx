"use client";

import { useEffect, useState } from "react";
import { RotateCcw, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { api } from "@/lib/api";
import { REGIME_LABELS } from "@/lib/constants";
import type { MonteCarloResponse } from "@/lib/types";
import { formatPct } from "@/lib/utils";

const ACCOUNT_PRESETS = [25000, 50000, 100000, 150000];
const DEFAULT_ACCOUNT_SIZE = 50000;
const DEFAULT_SIMULATIONS = 5000;
const DEFAULT_RISK_MODE = "percent";
const DEFAULT_RISK_PER_TRADE = 0.5;
const DEFAULT_DAILY_LOSS_LIMIT = 1000;
const DEFAULT_ACCOUNT_DRAWDOWN_LIMIT = 5;
const DEFAULT_TRADES_PER_DAY = 3;
const DEFAULT_REGIME_LABEL = "All";

function money(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function riskTone(level?: string) {
  if (level === "safe") return "text-positive";
  if (level === "caution") return "text-caution";
  return "text-danger";
}

function monteCarloRequest(
  simulations: number,
  accountSize: number,
  riskPerTrade: number,
  riskMode: string,
  dailyLossLimit: number | null,
  accountDrawdownLimit: number,
  tradesPerDay: number,
  regimeLabel: string
) {
  return {
    simulations,
    account_size: accountSize,
    risk_per_trade: riskPerTrade,
    risk_mode: riskMode,
    daily_loss_limit: dailyLossLimit,
    account_drawdown_limit_percent: accountDrawdownLimit,
    trades_per_day: tradesPerDay,
    regime_label: regimeLabel === "All" ? null : regimeLabel
  };
}

export function MonteCarloRisk() {
  const [accountSize, setAccountSize] = useState(DEFAULT_ACCOUNT_SIZE);
  const [simulations, setSimulations] = useState(DEFAULT_SIMULATIONS);
  const [riskMode, setRiskMode] = useState(DEFAULT_RISK_MODE);
  const [riskPerTrade, setRiskPerTrade] = useState(DEFAULT_RISK_PER_TRADE);
  const [dailyLossLimit, setDailyLossLimit] = useState<number | null>(DEFAULT_DAILY_LOSS_LIMIT);
  const [accountDrawdownLimit, setAccountDrawdownLimit] = useState(DEFAULT_ACCOUNT_DRAWDOWN_LIMIT);
  const [tradesPerDay, setTradesPerDay] = useState(DEFAULT_TRADES_PER_DAY);
  const [regimeLabel, setRegimeLabel] = useState(DEFAULT_REGIME_LABEL);
  const [result, setResult] = useState<MonteCarloResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    try {
      setResult(await api.monteCarloRisk(monteCarloRequest(simulations, accountSize, riskPerTrade, riskMode, dailyLossLimit, accountDrawdownLimit, tradesPerDay, regimeLabel)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run Monte Carlo");
    }
  }

  useEffect(() => {
    let active = true;

    api
      .monteCarloRisk(
        monteCarloRequest(
          DEFAULT_SIMULATIONS,
          DEFAULT_ACCOUNT_SIZE,
          DEFAULT_RISK_PER_TRADE,
          DEFAULT_RISK_MODE,
          DEFAULT_DAILY_LOSS_LIMIT,
          DEFAULT_ACCOUNT_DRAWDOWN_LIMIT,
          DEFAULT_TRADES_PER_DAY,
          DEFAULT_REGIME_LABEL
        )
      )
      .then((data) => {
        if (!active) return;
        setResult(data);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to run Monte Carlo");
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-accent">Risk Research</div>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Monte Carlo Risk</h1>
        </div>
        {result ? <Badge>{result.sample_size} valid trades</Badge> : null}
      </section>

      {error ? <div className="rounded-lg border border-stroke bg-panel px-4 py-3 text-sm text-muted">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
            <Button type="button" variant="primary" onClick={run}>
              <RotateCcw className="h-4 w-4" />
              Run
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Account Preset">
              <div className="grid grid-cols-2 gap-2">
                {ACCOUNT_PRESETS.map((preset) => (
                  <Button key={preset} type="button" variant={accountSize === preset ? "primary" : "secondary"} onClick={() => setAccountSize(preset)}>
                    {preset / 1000}k
                  </Button>
                ))}
              </div>
            </Field>
            <Field label="Account Size">
              <Input type="number" step="1000" value={accountSize} onChange={(event) => setAccountSize(Number(event.target.value))} />
            </Field>
            <Field label="Simulations">
              <Input type="number" min="1000" max="10000" step="1000" value={simulations} onChange={(event) => setSimulations(Number(event.target.value))} />
            </Field>
            <Field label="Risk Mode">
              <SegmentedControl value={riskMode} options={["percent", "dollars"]} onChange={setRiskMode} />
            </Field>
            <Field label={riskMode === "percent" ? "Risk Per Trade %" : "Risk Per Trade $"}>
              <Input type="number" step={riskMode === "percent" ? "0.1" : "25"} value={riskPerTrade} onChange={(event) => setRiskPerTrade(Number(event.target.value))} />
            </Field>
            <Field label="Daily Loss Limit $">
              <Input type="number" step="100" value={dailyLossLimit ?? ""} onChange={(event) => setDailyLossLimit(event.target.value === "" ? null : Number(event.target.value))} />
            </Field>
            <Field label="Account DD Limit %">
              <Input type="number" step="0.5" value={accountDrawdownLimit} onChange={(event) => setAccountDrawdownLimit(Number(event.target.value))} />
            </Field>
            <Field label="Trades Per Day">
              <Input type="number" min="1" step="1" value={tradesPerDay} onChange={(event) => setTradesPerDay(Number(event.target.value))} />
            </Field>
            <Field label="Regime">
              <Select value={regimeLabel} options={["All", ...REGIME_LABELS]} onChange={(event) => setRegimeLabel(event.target.value)} />
            </Field>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-caution" />
                <CardTitle>Risk Level</CardTitle>
              </div>
              {result ? <Badge>{result.message}</Badge> : null}
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-stroke bg-canvas">
                  <div className={`text-4xl font-semibold capitalize ${riskTone(result?.risk_level)}`}>
                    {result?.risk_level ?? "--"}
                  </div>
                  <div className="mt-3 text-sm text-muted">{result ? `${result.risk_percent}% risk` : "Risk per trade"}</div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-stroke bg-canvas p-4">
                    <div className="text-sm text-muted">Risk Amount</div>
                    <div className="mt-2 text-2xl font-semibold text-ink">{money(result?.risk_amount ?? 0)}</div>
                  </div>
                  <div className="rounded-lg border border-stroke bg-canvas p-4">
                    <div className="text-sm text-muted">Avg Drawdown</div>
                    <div className="mt-2 text-2xl font-semibold text-ink">{money(result?.average_drawdown ?? 0)}</div>
                  </div>
                  <div className="rounded-lg border border-stroke bg-canvas p-4">
                    <div className="text-sm text-muted">Worst Drawdown</div>
                    <div className="mt-2 text-2xl font-semibold text-ink">{money(result?.worst_drawdown ?? 0)}</div>
                  </div>
                  <div className="rounded-lg border border-stroke bg-canvas p-4">
                    <div className="text-sm text-muted">P95 Drawdown</div>
                    <div className="mt-2 text-2xl font-semibold text-ink">{money(result?.drawdown_p95 ?? 0)}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Limit Probabilities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-stroke bg-canvas p-4">
                  <div className="text-sm text-muted">Daily Loss Hit</div>
                  <div className="mt-2 text-2xl font-semibold text-ink">{formatPct(result?.probability_daily_loss_limit ?? 0)}</div>
                </div>
                <div className="rounded-lg border border-stroke bg-canvas p-4">
                  <div className="text-sm text-muted">Account DD Hit</div>
                  <div className="mt-2 text-2xl font-semibold text-ink">{formatPct(result?.probability_account_drawdown_limit ?? 0)}</div>
                </div>
                <div className="rounded-lg border border-stroke bg-canvas p-4">
                  <div className="text-sm text-muted">Longest Loss Streak</div>
                  <div className="mt-2 text-2xl font-semibold text-ink">{result?.longest_losing_streak ?? 0}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
