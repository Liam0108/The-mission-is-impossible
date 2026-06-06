"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, CalendarDays, MapPin, Split, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricGrid } from "@/components/dashboard/metric-grid";
import { PerformanceCurve } from "@/components/charts/performance-curve";
import { PerformanceTable } from "@/components/dashboard/performance-table";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import { REGIME_LABELS } from "@/lib/constants";
import { emptyDashboard } from "@/lib/demo-data";
import type { Dashboard } from "@/lib/types";
import { formatPct, formatR } from "@/lib/utils";

export function DashboardClient() {
  const [dashboard, setDashboard] = useState<Dashboard>(emptyDashboard);
  const [regimeLabel, setRegimeLabel] = useState("All");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .dashboard({ regime_label: regimeLabel === "All" ? null : regimeLabel })
      .then((data) => {
        setDashboard(data);
        setError(null);
      })
      .catch(() => setError("API offline"));
  }, [regimeLabel]);

  const metrics = useMemo(
    () => [
      { label: "Total Trades", value: dashboard.total_trades.toString(), detail: "All logged records" },
      { label: "Win Rate", value: formatPct(dashboard.win_rate), detail: "TP1 outcomes" },
      { label: "TP1 Rate", value: formatPct(dashboard.tp1_rate) },
      { label: "BE Rate", value: formatPct(dashboard.be_rate) },
      { label: "SL Rate", value: formatPct(dashboard.sl_rate) },
      { label: "Average RR", value: formatR(dashboard.average_rr) },
      { label: "Profit Factor", value: dashboard.profit_factor.toFixed(2) },
      { label: "Expectancy", value: formatR(dashboard.expectancy) },
      { label: "Max Winning Streak", value: dashboard.max_winning_streak.toString() },
      { label: "Max Losing Streak", value: dashboard.max_losing_streak.toString() },
      { label: "Average MFE", value: formatR(dashboard.average_mfe) },
      { label: "Average MAE", value: formatR(dashboard.average_mae) },
      { label: "Taken", value: dashboard.taken_count.toString(), detail: "Executed setups" },
      { label: "Skipped", value: dashboard.skipped_count.toString(), detail: "Observed but not taken" },
      { label: "Skipped TP1 Rate", value: formatPct(dashboard.skipped_tp1_rate) },
      { label: "Skipped SL Rate", value: formatPct(dashboard.skipped_sl_rate) }
    ],
    [dashboard]
  );

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-accent">Decision Support</div>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Dashboard</h1>
        </div>
        <div className="flex min-w-52 flex-wrap items-end gap-3">
          <Field label="Regime">
            <Select value={regimeLabel} options={["All", ...REGIME_LABELS]} onChange={(event) => setRegimeLabel(event.target.value)} />
          </Field>
          {error ? <div className="rounded-lg border border-stroke bg-panel px-3 py-2 text-sm text-muted">{error}</div> : null}
        </div>
      </section>

      <MetricGrid metrics={metrics} />

      <Card>
        <CardHeader>
          <CardTitle>Data Quality</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["Good", dashboard.data_quality?.good ?? 0],
              ["Incomplete", dashboard.data_quality?.incomplete ?? 0],
              ["Bad", dashboard.data_quality?.bad ?? 0],
              ["Valid Taken", dashboard.data_quality?.valid_taken_trades ?? 0]
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-lg border border-stroke bg-canvas p-4">
                <div className="text-sm text-muted">{label}</div>
                <div className="mt-2 text-2xl font-semibold text-ink">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2">
            {(dashboard.data_quality?.missing_field_warnings ?? []).slice(0, 6).map((row) => (
              <div key={row.field} className="flex items-center justify-between rounded-lg border border-stroke bg-canvas px-3 py-2 text-sm">
                <span className="text-muted">Missing {row.field}</span>
                <span className="font-medium text-ink">{row.count}</span>
              </div>
            ))}
            {!dashboard.data_quality?.missing_field_warnings.length ? (
              <div className="py-3 text-sm text-muted">No missing-field warnings</div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-accent" />
              <CardTitle>Performance Curve</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <PerformanceCurve data={dashboard.performance_curve} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-caution" />
              <CardTitle>Monthly Performance</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <PerformanceTable rows={dashboard.monthly_performance.slice(0, 8)} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-positive" />
              <CardTitle>Session Performance</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <PerformanceTable rows={dashboard.session_performance} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-danger" />
              <CardTitle>Location Performance</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <PerformanceTable rows={dashboard.location_performance} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 text-caution" />
              <CardTitle>POC Risk</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <PerformanceTable rows={dashboard.poc_performance} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Split className="h-4 w-4 text-accent" />
              <CardTitle>Best Skipped Opportunities</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <PerformanceTable rows={dashboard.best_skipped_opportunities} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 text-danger" />
              <CardTitle>Worst Taken Trades</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <PerformanceTable rows={dashboard.worst_taken_trades} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Top Mistakes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {dashboard.top_mistakes.map((row) => (
                <div key={row.mistake_type} className="flex items-center justify-between rounded-lg border border-stroke bg-canvas p-3 text-sm">
                  <span className="font-medium text-ink">{row.mistake_type}</span>
                  <span className="text-muted">{row.count}</span>
                </div>
              ))}
              {!dashboard.top_mistakes.length ? <div className="py-8 text-center text-sm text-muted">No review data</div> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Strategy Versions</CardTitle>
          </CardHeader>
          <CardContent>
            <PerformanceTable rows={dashboard.strategy_performance.slice(0, 5)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>News Timing</CardTitle>
          </CardHeader>
          <CardContent>
            <PerformanceTable rows={dashboard.news_timing_performance} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
