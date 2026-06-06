"use client";

import { useEffect, useState } from "react";
import { RotateCcw, TestTube2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { REGIME_LABELS } from "@/lib/constants";
import type { ManagementResponse, MlStatus } from "@/lib/types";
import { formatPct, formatR } from "@/lib/utils";

const DEFAULT_PARTIAL_EXIT = 50;
const DEFAULT_BE_AFTER_TP1 = "true";
const DEFAULT_TP2_ENABLED = "true";
const DEFAULT_TP2_PRICE = null;
const DEFAULT_REGIME_LABEL = "All";

function managementRequest(
  partialExit: number,
  beAfterTp1: string,
  tp2Enabled: string,
  tp2Price: number | null,
  regimeLabel: string
) {
  return {
    partial_exit_percent: partialExit,
    be_after_tp1: beAfterTp1 === "true",
    tp2_enabled: tp2Enabled === "true",
    tp2_price: tp2Price,
    regime_label: regimeLabel === "All" ? null : regimeLabel
  };
}

export function ManagementLab() {
  const [partialExit, setPartialExit] = useState(DEFAULT_PARTIAL_EXIT);
  const [beAfterTp1, setBeAfterTp1] = useState(DEFAULT_BE_AFTER_TP1);
  const [tp2Enabled, setTp2Enabled] = useState(DEFAULT_TP2_ENABLED);
  const [tp2Price, setTp2Price] = useState<number | null>(DEFAULT_TP2_PRICE);
  const [regimeLabel, setRegimeLabel] = useState(DEFAULT_REGIME_LABEL);
  const [result, setResult] = useState<ManagementResponse | null>(null);
  const [mlStatus, setMlStatus] = useState<MlStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runLab() {
    try {
      setResult(await api.managementLab(managementRequest(partialExit, beAfterTp1, tp2Enabled, tp2Price, regimeLabel)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run management lab");
    }
  }

  useEffect(() => {
    let active = true;

    api
      .managementLab(managementRequest(DEFAULT_PARTIAL_EXIT, DEFAULT_BE_AFTER_TP1, DEFAULT_TP2_ENABLED, DEFAULT_TP2_PRICE, DEFAULT_REGIME_LABEL))
      .then((data) => {
        if (!active) return;
        setResult(data);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to run management lab");
      });
    api
      .mlStatus()
      .then((data) => {
        if (active) setMlStatus(data);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-accent">Trade Improvement</div>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Management Lab</h1>
        </div>
        {result?.best_management_style ? <Badge>{result.best_management_style}</Badge> : null}
      </section>

      {error ? <div className="rounded-lg border border-stroke bg-panel px-4 py-3 text-sm text-muted">{error}</div> : null}
      {mlStatus ? <div className="rounded-lg border border-stroke bg-panel px-4 py-3 text-sm text-muted">{mlStatus.message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Assumptions</CardTitle>
            <Button type="button" variant="primary" onClick={runLab}>
              <RotateCcw className="h-4 w-4" />
              Run
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Partial Exit %">
              <Input type="number" min="0" max="100" step="5" value={partialExit} onChange={(event) => setPartialExit(Number(event.target.value))} />
            </Field>
            <Field label="BE After TP1">
              <SegmentedControl value={beAfterTp1} options={["true", "false"]} onChange={setBeAfterTp1} />
            </Field>
            <Field label="TP2 Enabled">
              <SegmentedControl value={tp2Enabled} options={["true", "false"]} onChange={setTp2Enabled} />
            </Field>
            <Field label="Optional TP2 Price">
              <Input type="number" step="0.25" value={tp2Price ?? ""} onChange={(event) => setTp2Price(event.target.value === "" ? null : Number(event.target.value))} />
            </Field>
            <Field label="Regime">
              <Select value={regimeLabel} options={["All", ...REGIME_LABELS]} onChange={(event) => setRegimeLabel(event.target.value)} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TestTube2 className="h-4 w-4 text-accent" />
              <CardTitle>Rule Comparison</CardTitle>
            </div>
            {result ? <div className="text-sm text-muted">{result.baseline.eligible_trades} eligible trades</div> : null}
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="text-xs uppercase tracking-normal text-muted">
                  <tr className="border-b border-stroke">
                    <th className="py-3 font-medium">Rule</th>
                    <th className="py-3 font-medium">Sample</th>
                    <th className="py-3 font-medium">Win Rate</th>
                    <th className="py-3 font-medium">Avg R</th>
                    <th className="py-3 font-medium">Total R</th>
                    <th className="py-3 font-medium">Max DD</th>
                    <th className="py-3 font-medium">Loss Streak</th>
                    <th className="py-3 font-medium">PF</th>
                    <th className="py-3 font-medium">Warning</th>
                  </tr>
                </thead>
                <tbody>
                  {result?.strategies.map((row) => (
                    <tr key={row.name} className="border-b border-stroke last:border-0">
                      <td className="py-3 font-medium text-ink">{row.name}</td>
                      <td className="py-3 text-muted">{row.sample_size}</td>
                      <td className="py-3 text-muted">{formatPct(row.win_rate)}</td>
                      <td className="py-3 text-muted">{formatR(row.average_r)}</td>
                      <td className="py-3 font-medium text-ink">{formatR(row.total_r)}</td>
                      <td className="py-3 text-muted">{formatR(row.max_drawdown)}</td>
                      <td className="py-3 text-muted">{row.max_losing_streak}</td>
                      <td className="py-3 text-muted">{row.profit_factor.toFixed(2)}</td>
                      <td className="py-3 text-muted">{row.warning ?? ""}</td>
                    </tr>
                  ))}
                  {!result?.strategies.length ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-muted">
                        No management data
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Regime-Based Management</CardTitle>
          {result?.regime_comparison ? <div className="text-sm text-muted">{result.regime_comparison.length} condition groups</div> : null}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="text-xs uppercase tracking-normal text-muted">
                <tr className="border-b border-stroke">
                  <th className="py-3 font-medium">Group</th>
                  <th className="py-3 font-medium">Condition</th>
                  <th className="py-3 font-medium">Sample</th>
                  <th className="py-3 font-medium">Best Rule</th>
                  <th className="py-3 font-medium">Avg R</th>
                  <th className="py-3 font-medium">Total R</th>
                  <th className="py-3 font-medium">PF</th>
                </tr>
              </thead>
              <tbody>
                {(result?.regime_comparison ?? []).slice(0, 36).map((row) => (
                  <tr key={`${row.group_field}-${row.group_value}`} className="border-b border-stroke last:border-0">
                    <td className="py-3 text-muted">{row.group_field}</td>
                    <td className="py-3 font-medium text-ink">{row.group_value}</td>
                    <td className="py-3 text-muted">{row.sample_size}</td>
                    <td className="py-3 text-muted">{row.best_rule ?? "--"}</td>
                    <td className="py-3 text-muted">{formatR(row.best_average_r)}</td>
                    <td className="py-3 font-medium text-ink">{formatR(row.best_total_r)}</td>
                    <td className="py-3 text-muted">{row.best_profit_factor.toFixed(2)}</td>
                  </tr>
                ))}
                {!result?.regime_comparison?.length ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-muted">
                      No regime data
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
