"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, Download, FileText, Gauge, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import {
  BIASES,
  DIRECTIONS,
  FVG_REACTIONS,
  LOCATIONS,
  MARKET_STATES,
  NEWS_TIMINGS,
  POC_RISK_LEVELS,
  REGIME_LABELS,
  SESSIONS,
  TRADE_DECISIONS,
  VOLUME_STATES,
  YES_NO
} from "@/lib/constants";
import type { AnalyzerRequest, AnalyzerResponse } from "@/lib/types";
import { cn, formatPct, formatR } from "@/lib/utils";
import { exportAnalysisCsv, exportAnalysisMarkdown, type AnalysisExport } from "@/lib/research-export";

const initialSetup: AnalyzerRequest = {
  session: "NY_AM",
  direction: "Long",
  bias_15m: "Long",
  market_state: "Imbalanced",
  regime_label: null,
  location: "VAH",
  liquidity_sweep: "Yes",
  choch: "Yes",
  lh_hl: "Yes",
  fvg_reaction: "Strong",
  volume_state: "Normal",
  trade_decision: "Taken",
  distance_to_poc: null,
  distance_to_vah: null,
  distance_to_val: null,
  poc_risk_level: "Unknown",
  high_impact_news: "No",
  news_timing: "No News",
  planned_rr: 2
};

function gradeTone(grade?: string) {
  if (!grade) return "text-muted";
  if (grade === "A+" || grade === "A") return "text-positive";
  if (grade === "B" || grade === "C") return "text-caution";
  return "text-danger";
}

export function SetupAnalyzer() {
  const [setup, setSetup] = useState<AnalyzerRequest>(initialSetup);
  const [result, setResult] = useState<AnalyzerResponse | null>(null);
  const [bestManagementRule, setBestManagementRule] = useState<string | null>(null);
  const [conclusionNotes, setConclusionNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof AnalyzerRequest>(key: K, value: AnalyzerRequest[K]) {
    setSetup((current) => ({ ...current, [key]: value }));
  }

  async function evaluate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const [analysis, management] = await Promise.all([
        api.evaluateSetup(setup),
        api.managementLab({ partial_exit_percent: 50, be_after_tp1: true, tp2_enabled: true, tp2_price: null, regime_label: setup.regime_label })
      ]);
      setResult(analysis);
      setBestManagementRule(analysis.best_management_rule ?? management.best_management_style);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to evaluate setup");
    } finally {
      setBusy(false);
    }
  }

  function exportData(): AnalysisExport {
    return {
      title: "Setup Analyzer Export",
      setupFilters: { ...setup },
      sampleSize: result?.sample_size,
      tp1Probability: result?.tp1_probability,
      beProbability: result?.be_probability,
      slProbability: result?.sl_probability,
      averageR: result?.historical.average_rr,
      maxLosingStreak: result?.historical.max_losing_streak,
      bestManagementRule: result?.best_management_rule ?? bestManagementRule,
      pocRiskWarning: result?.poc_risk_message,
      conclusionNotes
    };
  }

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-accent">Decision Support</div>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Setup Analyzer</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {result ? <Badge>{result.confidence_level} confidence</Badge> : null}
          {result ? (
            <>
              <Button type="button" variant="secondary" onClick={() => exportAnalysisCsv(exportData(), "setup-analysis.csv")}>
                <Download className="h-4 w-4" />
                CSV
              </Button>
              <Button type="button" variant="secondary" onClick={() => exportAnalysisMarkdown(exportData(), "setup-analysis.md")}>
                <FileText className="h-4 w-4" />
                Markdown
              </Button>
            </>
          ) : null}
        </div>
      </section>

      {error ? <div className="rounded-lg border border-stroke bg-panel px-4 py-3 text-sm text-muted">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <form onSubmit={evaluate}>
          <Card>
            <CardHeader>
              <CardTitle>Setup Inputs</CardTitle>
              <Button type="submit" variant="primary" disabled={busy}>
                <Search className="h-4 w-4" />
                Evaluate
              </Button>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Session">
                  <Select value={setup.session} options={SESSIONS} onChange={(event) => setField("session", event.target.value)} />
                </Field>
                <Field label="Location">
                  <Select value={setup.location} options={LOCATIONS} onChange={(event) => setField("location", event.target.value)} />
                </Field>
              </div>

              <Field label="Trade Decision">
                <SegmentedControl value={setup.trade_decision} options={TRADE_DECISIONS} onChange={(value) => setField("trade_decision", value)} />
              </Field>
              <Field label="Direction">
                <SegmentedControl value={setup.direction} options={DIRECTIONS} onChange={(value) => setField("direction", value)} />
              </Field>
              <Field label="15m Bias">
                <SegmentedControl value={setup.bias_15m} options={BIASES} onChange={(value) => setField("bias_15m", value)} />
              </Field>
              <Field label="Market State">
                <SegmentedControl value={setup.market_state} options={MARKET_STATES} onChange={(value) => setField("market_state", value)} />
              </Field>
              <Field label="Regime Label">
                <Select value={setup.regime_label ?? ""} options={["", ...REGIME_LABELS]} onChange={(event) => setField("regime_label", event.target.value || null)} />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Liquidity Sweep">
                  <SegmentedControl compact value={setup.liquidity_sweep} options={YES_NO} onChange={(value) => setField("liquidity_sweep", value)} />
                </Field>
                <Field label="CHOCH">
                  <SegmentedControl compact value={setup.choch} options={YES_NO} onChange={(value) => setField("choch", value)} />
                </Field>
                <Field label="LH/HL">
                  <SegmentedControl compact value={setup.lh_hl} options={YES_NO} onChange={(value) => setField("lh_hl", value)} />
                </Field>
                <Field label="FVG Strength">
                  <Select value={setup.fvg_reaction} options={FVG_REACTIONS} onChange={(event) => setField("fvg_reaction", event.target.value)} />
                </Field>
                <Field label="Volume State">
                  <Select value={setup.volume_state} options={VOLUME_STATES} onChange={(event) => setField("volume_state", event.target.value)} />
                </Field>
                <Field label="Planned RR">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={setup.planned_rr ?? ""}
                    onChange={(event) => setField("planned_rr", event.target.value === "" ? null : Number(event.target.value))}
                  />
                </Field>
                <Field label="Distance to POC">
                  <Input
                    type="number"
                    step="0.25"
                    value={setup.distance_to_poc ?? ""}
                    onChange={(event) => setField("distance_to_poc", event.target.value === "" ? null : Number(event.target.value))}
                  />
                </Field>
                <Field label="Distance to VAH">
                  <Input
                    type="number"
                    step="0.25"
                    value={setup.distance_to_vah ?? ""}
                    onChange={(event) => setField("distance_to_vah", event.target.value === "" ? null : Number(event.target.value))}
                  />
                </Field>
                <Field label="Distance to VAL">
                  <Input
                    type="number"
                    step="0.25"
                    value={setup.distance_to_val ?? ""}
                    onChange={(event) => setField("distance_to_val", event.target.value === "" ? null : Number(event.target.value))}
                  />
                </Field>
                <Field label="POC Risk">
                  <Select value={setup.poc_risk_level} options={POC_RISK_LEVELS} onChange={(event) => setField("poc_risk_level", event.target.value)} />
                </Field>
                <Field label="High Impact News">
                  <SegmentedControl compact value={setup.high_impact_news} options={YES_NO} onChange={(value) => setField("high_impact_news", value)} />
                </Field>
                <Field label="News Timing">
                  <Select value={setup.news_timing} options={NEWS_TIMINGS} onChange={(event) => setField("news_timing", event.target.value)} />
                </Field>
              </div>
            </CardContent>
          </Card>
        </form>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-accent" />
                <CardTitle>Setup Score</CardTitle>
              </div>
              {result ? <Badge>{result.sample_size} matches</Badge> : null}
            </CardHeader>
            <CardContent>
              <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
                <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-stroke bg-canvas">
                  <div className="text-6xl font-semibold text-ink">{result?.setup_score ?? "--"}</div>
                  <div className={cn("mt-3 text-2xl font-semibold", gradeTone(result?.trade_grade))}>
                    {result?.trade_grade ?? "Grade"}
                  </div>
                </div>
                <div className="grid gap-3">
                  {[
                    ["TP1 Probability", result?.tp1_probability],
                    ["SL Probability", result?.sl_probability],
                    ["Average R", result?.average_r]
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-lg border border-stroke bg-canvas p-4">
                      <div className="text-sm text-muted">{label}</div>
                      <div className="mt-2 text-2xl font-semibold text-ink">
                        {typeof value === "number" ? (label === "Average R" ? formatR(value) : formatPct(value)) : "--"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {result ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-stroke bg-canvas p-4">
                    <div className="text-sm text-muted">Best Management Rule</div>
                    <div className="mt-2 text-lg font-semibold text-ink">{result.best_management_rule ?? bestManagementRule ?? "--"}</div>
                  </div>
                  <div className="rounded-lg border border-stroke bg-canvas p-4">
                    <div className="text-sm text-muted">Recommended Risk</div>
                    <div className="mt-2 text-lg font-semibold capitalize text-ink">{result.recommended_risk_level}</div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-caution" />
                <CardTitle>POC Risk</CardTitle>
              </div>
              {result ? <Badge>{result.poc_risk_level}</Badge> : null}
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-stroke bg-canvas p-4">
                <div className="text-lg font-semibold text-ink">{result?.poc_risk_message ?? "POC Risk: --"}</div>
                <div className="mt-2 text-sm text-muted">
                  Historical SL rate near POC is {formatPct(result?.historical_poc_sl_rate ?? 0)}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-positive" />
                <CardTitle>Historical Comparison</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-stroke bg-canvas p-4">
                  <div className="text-sm text-muted">Win Rate</div>
                  <div className="mt-2 text-xl font-semibold text-ink">{formatPct(result?.historical.historical_win_rate ?? 0)}</div>
                </div>
                <div className="rounded-lg border border-stroke bg-canvas p-4">
                  <div className="text-sm text-muted">Average RR</div>
                  <div className="mt-2 text-xl font-semibold text-ink">{formatR(result?.historical.average_rr ?? 0)}</div>
                </div>
                <div className="rounded-lg border border-stroke bg-canvas p-4">
                  <div className="text-sm text-muted">Avg MFE</div>
                  <div className="mt-2 text-xl font-semibold text-ink">{formatR(result?.historical.average_mfe ?? 0)}</div>
                </div>
                <div className="rounded-lg border border-stroke bg-canvas p-4">
                  <div className="text-sm text-muted">Max Loss Streak</div>
                  <div className="mt-2 text-xl font-semibold text-ink">{result?.historical.max_losing_streak ?? 0}</div>
                </div>
                <div className="rounded-lg border border-stroke bg-canvas p-4">
                  <div className="text-sm text-muted">BE Rate</div>
                  <div className="mt-2 text-xl font-semibold text-ink">{formatPct(result?.historical.historical_be_rate ?? 0)}</div>
                </div>
                <div className="rounded-lg border border-stroke bg-canvas p-4">
                  <div className="text-sm text-muted">SL Rate</div>
                  <div className="mt-2 text-xl font-semibold text-ink">{formatPct(result?.historical.historical_sl_rate ?? 0)}</div>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[840px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-normal text-muted">
                    <tr className="border-b border-stroke">
                      <th className="py-3 font-medium">Date</th>
                      <th className="py-3 font-medium">Session</th>
                      <th className="py-3 font-medium">Direction</th>
                      <th className="py-3 font-medium">Location</th>
                      <th className="py-3 font-medium">Decision</th>
                      <th className="py-3 font-medium">Result</th>
                      <th className="py-3 font-medium">Similarity</th>
                      <th className="py-3 text-right font-medium">MFE</th>
                      <th className="py-3 text-right font-medium">MAE</th>
                      <th className="py-3 text-right font-medium">R</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result?.most_similar_trades.map((trade) => (
                      <tr key={trade.id} className="border-b border-stroke last:border-0">
                        <td className="py-3 text-ink">{trade.date}</td>
                        <td className="py-3 text-muted">{trade.session}</td>
                        <td className="py-3 text-muted">{trade.direction}</td>
                        <td className="py-3 text-muted">{trade.location}</td>
                        <td className="py-3 text-muted">{trade.trade_decision}</td>
                        <td className="py-3 font-medium text-ink">{trade.result}</td>
                        <td className="py-3 text-muted">{trade.similarity_score}%</td>
                        <td className="py-3 text-right text-muted">{formatR(trade.mfe)}</td>
                        <td className="py-3 text-right text-muted">{formatR(trade.mae)}</td>
                        <td className="py-3 text-right font-medium text-ink">{formatR(trade.result_r)}</td>
                      </tr>
                    ))}
                    {!result?.most_similar_trades.length ? (
                      <tr>
                        <td colSpan={10} className="py-10 text-center text-muted">
                          No similar trades
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {result ? (
            <Card>
              <CardHeader>
                <CardTitle>Conclusion Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  className="focus-ring min-h-24 w-full resize-y rounded-lg border border-stroke bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted"
                  value={conclusionNotes}
                  onChange={(event) => setConclusionNotes(event.target.value)}
                  placeholder="Decision notes, invalidation concerns, or why this setup matters."
                />
              </CardContent>
            </Card>
          ) : null}

          {result ? (
            <Card>
              <CardHeader>
                <CardTitle>Score v2 Components</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-stroke bg-canvas p-3">
                    <div className="text-sm text-muted">Base</div>
                    <div className="mt-1 text-xl font-semibold text-ink">{result.base_score}</div>
                  </div>
                  <div className="rounded-lg border border-stroke bg-canvas p-3">
                    <div className="text-sm text-muted">Historical Edge</div>
                    <div className="mt-1 text-xl font-semibold text-ink">{result.historical_edge_score}</div>
                  </div>
                  <div className="rounded-lg border border-stroke bg-canvas p-3">
                    <div className="text-sm text-muted">Confidence</div>
                    <div className="mt-1 text-xl font-semibold text-ink">{result.data_confidence_adjustment}</div>
                  </div>
                </div>
                <div className="grid gap-2">
                  {result.score_components.map((component) => (
                    <div key={`${component.label}-${component.reason}`} className="flex items-start justify-between gap-4 rounded-lg border border-stroke bg-canvas p-3">
                      <div>
                        <div className="font-medium text-ink">{component.label}</div>
                        <div className="mt-1 text-sm text-muted">{component.reason}</div>
                      </div>
                      <div className={cn("text-sm font-semibold", component.points >= 0 ? "text-positive" : "text-danger")}>
                        {component.points >= 0 ? "+" : ""}
                        {component.points}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-2">
                  {result.explanation_notes.map((note) => (
                    <div key={note} className="rounded-lg border border-stroke bg-canvas p-3 text-sm text-muted">
                      {note}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
