"use client";

import { useEffect, useState } from "react";
import { Activity, Brain, CalendarDays, Download, FileText, Newspaper, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { PerformanceTable } from "@/components/dashboard/performance-table";
import { api } from "@/lib/api";
import { REGIME_LABELS } from "@/lib/constants";
import type { EdgeCondition, ResearchSummary } from "@/lib/types";
import { exportAnalysisCsv, exportAnalysisMarkdown, type AnalysisExport } from "@/lib/research-export";
import { formatPct, formatR } from "@/lib/utils";

function EdgeTable({ rows }: { rows: EdgeCondition[] }) {
  if (!rows.length) return <div className="py-8 text-center text-sm text-muted">No edge data</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="text-xs uppercase tracking-normal text-muted">
          <tr className="border-b border-stroke">
            <th className="py-3 font-medium">Condition</th>
            <th className="py-3 font-medium">Sample</th>
            <th className="py-3 font-medium">TP1</th>
            <th className="py-3 font-medium">SL</th>
            <th className="py-3 font-medium">Avg R</th>
            <th className="py-3 font-medium">PF</th>
            <th className="py-3 font-medium">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.condition} className="border-b border-stroke last:border-0">
              <td className="py-3 font-medium text-ink">{row.condition}</td>
              <td className="py-3 text-muted">{row.sample_size}</td>
              <td className="py-3 text-muted">{formatPct(row.tp1_rate)}</td>
              <td className="py-3 text-muted">{formatPct(row.sl_rate)}</td>
              <td className="py-3 text-muted">{formatR(row.average_rr)}</td>
              <td className="py-3 text-muted">{row.profit_factor.toFixed(2)}</td>
              <td className="py-3 text-muted">{row.confidence}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ResearchLab() {
  const [review, setReview] = useState<ResearchSummary["review"] | null>(null);
  const [scores, setScores] = useState<ResearchSummary["scores"] | null>(null);
  const [marketContext, setMarketContext] = useState<ResearchSummary["marketContext"] | null>(null);
  const [news, setNews] = useState<Record<string, unknown> | null>(null);
  const [strategies, setStrategies] = useState<ResearchSummary["strategies"] | null>(null);
  const [sessions, setSessions] = useState<ResearchSummary["sessions"] | null>(null);
  const [edge, setEdge] = useState<ResearchSummary["edge"] | null>(null);
  const [bestManagementRule, setBestManagementRule] = useState<string | null>(null);
  const [conclusionNotes, setConclusionNotes] = useState("");
  const [regimeLabel, setRegimeLabel] = useState("All");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const filter = { regime_label: regimeLabel === "All" ? null : regimeLabel };
    Promise.all([
      api.review(filter),
      api.dailyScore(filter),
      api.marketContext(filter),
      api.news(filter),
      api.strategyVersions(filter),
      api.sessions(filter),
      api.edgeDiscovery(filter),
      api.managementLab({ partial_exit_percent: 50, be_after_tp1: true, tp2_enabled: true, tp2_price: null, ...filter })
    ])
      .then(([reviewData, scoreData, contextData, newsData, strategyData, sessionData, edgeData, managementData]) => {
        setReview(reviewData);
        setScores(scoreData);
        setMarketContext(contextData);
        setNews(newsData);
        setStrategies(strategyData);
        setSessions(sessionData);
        setEdge(edgeData);
        setBestManagementRule(managementData.best_management_style);
        setError(null);
      })
      .catch(() => setError("API offline"));
  }, [regimeLabel]);

  const latestDaily = scores?.daily.at(-1);
  const topEdge = edge?.top_best_conditions[0] ?? null;

  function exportData(): AnalysisExport {
    return {
      title: "Research Lab Export",
      setupFilters: {
        source: "Research Lab",
        top_condition: topEdge?.condition,
        confidence: topEdge?.confidence
      },
      sampleSize: topEdge?.sample_size,
      tp1Probability: topEdge?.tp1_rate,
      beProbability: null,
      slProbability: topEdge?.sl_rate,
      averageR: topEdge?.average_rr,
      maxLosingStreak: null,
      bestManagementRule,
      pocRiskWarning: "Review POC setups, VAH setups, VAL setups, and Other setups in Dashboard performance cards.",
      conclusionNotes
    };
  }

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-accent">Improvement</div>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Research Lab</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Field label="Regime">
            <Select value={regimeLabel} options={["All", ...REGIME_LABELS]} onChange={(event) => setRegimeLabel(event.target.value)} />
          </Field>
          {latestDaily ? <Badge>Overall {latestDaily.overall_score}</Badge> : null}
          <Button type="button" variant="secondary" onClick={() => exportAnalysisCsv(exportData(), "research-lab-export.csv")}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button type="button" variant="secondary" onClick={() => exportAnalysisMarkdown(exportData(), "research-lab-export.md")}>
            <FileText className="h-4 w-4" />
            Markdown
          </Button>
        </div>
      </section>

      {error ? <div className="rounded-lg border border-stroke bg-panel px-4 py-3 text-sm text-muted">{error}</div> : null}

      <div className="grid gap-3 md:grid-cols-5">
        {[
          ["Discipline", latestDaily?.discipline],
          ["Execution", latestDaily?.execution],
          ["Risk Control", latestDaily?.risk_control],
          ["Consistency", latestDaily?.consistency],
          ["Emotion", latestDaily?.emotional_control]
        ].map(([label, value]) => (
          <Card key={label as string} className="p-4">
            <div className="text-sm text-muted">{label}</div>
            <div className="mt-3 text-2xl font-semibold text-ink">{typeof value === "number" ? value.toFixed(0) : "--"}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-danger" />
              <CardTitle>Top Mistakes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {(review?.top_mistakes ?? []).map((row) => (
                <div key={row.mistake_type} className="flex items-center justify-between rounded-lg border border-stroke bg-canvas p-3">
                  <div>
                    <div className="font-medium text-ink">{row.mistake_type}</div>
                    <div className="text-sm text-muted">{formatPct(row.win_rate)} win rate</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-ink">{row.count}</div>
                    <div className="text-sm text-muted">{formatR(row.loss_r)}</div>
                  </div>
                </div>
              ))}
              {!review?.top_mistakes.length ? <div className="py-8 text-center text-sm text-muted">No review data</div> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent" />
              <CardTitle>Daily Trading Score</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="text-xs uppercase tracking-normal text-muted">
                  <tr className="border-b border-stroke">
                    <th className="py-3 font-medium">Day</th>
                    <th className="py-3 font-medium">Trades</th>
                    <th className="py-3 font-medium">Discipline</th>
                    <th className="py-3 font-medium">Execution</th>
                    <th className="py-3 font-medium">Emotion</th>
                    <th className="py-3 font-medium">Overall</th>
                  </tr>
                </thead>
                <tbody>
                  {(scores?.daily ?? []).slice(-8).map((row) => (
                    <tr key={String(row.period)} className="border-b border-stroke last:border-0">
                      <td className="py-3 font-medium text-ink">{String(row.period)}</td>
                      <td className="py-3 text-muted">{String(row.trades)}</td>
                      <td className="py-3 text-muted">{String(row.discipline)}</td>
                      <td className="py-3 text-muted">{String(row.execution)}</td>
                      <td className="py-3 text-muted">{String(row.emotional_control)}</td>
                      <td className="py-3 font-medium text-ink">{String(row.overall_score)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-positive" />
              <CardTitle>Market Context</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <PerformanceTable rows={marketContext?.daily_bias ?? []} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Newspaper className="h-4 w-4 text-caution" />
              <CardTitle>News Filter</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <div className="rounded-lg border border-stroke bg-canvas p-3">
                <div className="text-sm text-muted">TP1 During News</div>
                <div className="mt-2 text-xl font-semibold text-ink">{formatPct(Number(news?.tp1_rate_during_news ?? 0))}</div>
              </div>
              <div className="rounded-lg border border-stroke bg-canvas p-3">
                <div className="text-sm text-muted">SL During News</div>
                <div className="mt-2 text-xl font-semibold text-ink">{formatPct(Number(news?.sl_rate_during_news ?? 0))}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-accent" />
              <CardTitle>Session Refinement</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 text-sm">
              <div className="flex justify-between"><span className="text-muted">Best</span><span className="font-medium text-ink">{sessions?.best_session?.name ?? "--"}</span></div>
              <div className="flex justify-between"><span className="text-muted">Worst</span><span className="font-medium text-ink">{sessions?.worst_session?.name ?? "--"}</span></div>
              <div className="flex justify-between"><span className="text-muted">Consistent</span><span className="font-medium text-ink">{sessions?.most_consistent_session?.name ?? "--"}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-positive" />
            <CardTitle>Strategy Versions</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <PerformanceTable rows={strategies?.versions ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Edge Discovery</CardTitle>
        </CardHeader>
        <CardContent>
          <EdgeTable rows={edge?.top_best_conditions ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conclusion Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            className="focus-ring min-h-24 w-full resize-y rounded-lg border border-stroke bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted"
            value={conclusionNotes}
            onChange={(event) => setConclusionNotes(event.target.value)}
            placeholder="Research conclusion, strongest condition, or follow-up review notes."
          />
        </CardContent>
      </Card>
    </div>
  );
}
