"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, CircleDollarSign, PiggyBank, Plus, Trash2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { Trade } from "@/lib/types";

const GOALS_KEY = "fabio-freedom-goals-v1";

const CATEGORIES = [
  "House",
  "Car",
  "Business",
  "Education",
  "Travel",
  "Fitness",
  "Family",
  "Investing",
  "Emergency Fund",
  "Financial Freedom",
  "Other"
] as const;

const PRIORITIES = ["High", "Medium", "Low"] as const;

type FreedomGoal = {
  id: string;
  name: string;
  category: string;
  target_amount: number;
  current_saved_amount: number;
  deadline: string;
  priority: string;
  notes: string;
  created_at: string;
};

type GoalDraft = Omit<FreedomGoal, "id" | "created_at">;

function emptyDraft(): GoalDraft {
  return {
    name: "",
    category: "Financial Freedom",
    target_amount: 0,
    current_saved_amount: 0,
    deadline: "",
    priority: "Medium",
    notes: ""
  };
}

function money(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function pct(value: number) {
  return `${value.toFixed(1)}%`;
}

function parseNumber(value: string) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function tradePnl(trade: Trade) {
  return (trade.risk_amount ?? 0) * Number(trade.result_r ?? 0);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

function monthKey(dateText: string) {
  return dateText.slice(0, 7);
}

function weekKey(dateText: string) {
  const date = new Date(`${dateText}T00:00:00`);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function averageGroupedPnl(trades: Trade[], keyFn: (dateText: string) => string) {
  const groups = new Map<string, number>();
  for (const trade of trades) {
    groups.set(keyFn(trade.date), (groups.get(keyFn(trade.date)) ?? 0) + tradePnl(trade));
  }
  return groups.size ? [...groups.values()].reduce((sum, value) => sum + value, 0) / groups.size : 0;
}

function monthsUntil(dateText: string) {
  if (!dateText) return null;
  const today = new Date();
  const deadline = new Date(`${dateText}T00:00:00`);
  const diff = deadline.getTime() - today.getTime();
  if (diff <= 0) return 1;
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24 * 30.4375)));
}

function estimatedCompletionDate(remaining: number, averageMonthlyPnl: number) {
  if (remaining <= 0) return "Complete";
  if (averageMonthlyPnl <= 0) return "Unavailable";
  const months = Math.ceil(remaining / averageMonthlyPnl);
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function readGoals() {
  try {
    const rows = JSON.parse(window.localStorage.getItem(GOALS_KEY) ?? "[]") as FreedomGoal[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function writeGoals(goals: FreedomGoal[]) {
  window.localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `goal-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function FreedomDashboard() {
  const [goals, setGoals] = useState<FreedomGoal[]>([]);
  const [draft, setDraft] = useState<GoalDraft>(emptyDraft());
  const [trades, setTrades] = useState<Trade[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setGoals(readGoals());
    api
      .trades()
      .then((rows) => {
        setTrades(rows);
        setError(null);
      })
      .catch(() => setError("Trading data unavailable"));
  }, []);

  function saveGoals(next: FreedomGoal[]) {
    setGoals(next);
    writeGoals(next);
  }

  function addGoal(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim() || draft.target_amount <= 0) return;
    saveGoals([{ ...draft, id: newId(), created_at: new Date().toISOString() }, ...goals]);
    setDraft(emptyDraft());
  }

  function updateSavedAmount(id: string, amount: number) {
    saveGoals(goals.map((goal) => (goal.id === id ? { ...goal, current_saved_amount: Math.max(0, amount) } : goal)));
  }

  function deleteGoal(id: string) {
    saveGoals(goals.filter((goal) => goal.id !== id));
  }

  const tradingStats = useMemo(() => {
    const now = new Date();
    const last7 = daysAgo(7);
    const last30 = daysAgo(30);
    const closedTrades = trades.filter((trade) => trade.trade_decision === "Taken");
    const recent7 = closedTrades.filter((trade) => new Date(`${trade.date}T00:00:00`) >= last7 && new Date(`${trade.date}T00:00:00`) <= now);
    const recent30 = closedTrades.filter((trade) => new Date(`${trade.date}T00:00:00`) >= last30 && new Date(`${trade.date}T00:00:00`) <= now);
    return {
      last7Pnl: recent7.reduce((sum, trade) => sum + tradePnl(trade), 0),
      last30Pnl: recent30.reduce((sum, trade) => sum + tradePnl(trade), 0),
      averageWeeklyPnl: averageGroupedPnl(closedTrades, weekKey),
      averageMonthlyPnl: averageGroupedPnl(closedTrades, monthKey),
      tradesWithRisk: closedTrades.filter((trade) => trade.risk_amount !== null).length,
      totalTaken: closedTrades.length
    };
  }, [trades]);

  const totalTarget = goals.reduce((sum, goal) => sum + goal.target_amount, 0);
  const totalSaved = goals.reduce((sum, goal) => sum + goal.current_saved_amount, 0);
  const totalProgress = totalTarget ? Math.min(100, (totalSaved / totalTarget) * 100) : 0;

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-accent">Personal Progress</div>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Freedom Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Goal tracking uses your inputs and logged trading results only. It is not financial advice.
          </p>
        </div>
        {error ? <div className="rounded-lg border border-stroke bg-panel px-3 py-2 text-sm text-muted">{error}</div> : null}
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Total Saved", money(totalSaved), PiggyBank],
          ["Goal Progress", pct(totalProgress), TrendingUp],
          ["Last 7 Days PnL", money(tradingStats.last7Pnl), CircleDollarSign],
          ["Last 30 Days PnL", money(tradingStats.last30Pnl), CalendarDays]
        ].map(([label, value, Icon]) => (
          <Card key={String(label)} className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-muted">{String(label)}</div>
                <div className="mt-3 text-2xl font-semibold text-ink">{String(value)}</div>
              </div>
              <Icon className="h-5 w-5 text-accent" />
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trading Progress Link</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-stroke bg-canvas p-4">
              <div className="text-sm text-muted">Average Weekly PnL</div>
              <div className="mt-2 text-xl font-semibold text-ink">{money(tradingStats.averageWeeklyPnl)}</div>
            </div>
            <div className="rounded-lg border border-stroke bg-canvas p-4">
              <div className="text-sm text-muted">Average Monthly PnL</div>
              <div className="mt-2 text-xl font-semibold text-ink">{money(tradingStats.averageMonthlyPnl)}</div>
            </div>
            <div className="rounded-lg border border-stroke bg-canvas p-4">
              <div className="text-sm text-muted">Trades With Risk Amount</div>
              <div className="mt-2 text-xl font-semibold text-ink">{tradingStats.tradesWithRisk} / {tradingStats.totalTaken}</div>
            </div>
            <div className="rounded-lg border border-stroke bg-canvas p-4">
              <div className="text-sm text-muted">PnL Formula</div>
              <div className="mt-2 text-sm font-medium text-ink">risk amount x result R</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Add Goal</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addGoal} className="grid gap-4">
              <Field label="Goal Name">
                <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Down payment" />
              </Field>
              <Field label="Category">
                <Select value={draft.category} options={CATEGORIES} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} />
              </Field>
              <Field label="Target Amount">
                <Input type="number" min="0" step="100" value={draft.target_amount || ""} onChange={(event) => setDraft((current) => ({ ...current, target_amount: parseNumber(event.target.value) }))} />
              </Field>
              <Field label="Current Saved Amount">
                <Input type="number" min="0" step="100" value={draft.current_saved_amount || ""} onChange={(event) => setDraft((current) => ({ ...current, current_saved_amount: parseNumber(event.target.value) }))} />
              </Field>
              <Field label="Deadline">
                <Input type="date" value={draft.deadline} onChange={(event) => setDraft((current) => ({ ...current, deadline: event.target.value }))} />
              </Field>
              <Field label="Priority">
                <Select value={draft.priority} options={PRIORITIES} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value }))} />
              </Field>
              <Field label="Notes">
                <Textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Why this goal matters." />
              </Field>
              <Button type="submit" variant="primary">
                <Plus className="h-4 w-4" />
                Add Goal
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {goals.map((goal) => {
            const progress = goal.target_amount ? Math.min(100, Math.max(0, (goal.current_saved_amount / goal.target_amount) * 100)) : 0;
            const remaining = Math.max(0, goal.target_amount - goal.current_saved_amount);
            const months = monthsUntil(goal.deadline);
            const monthlyRequired = months ? remaining / months : null;
            const estimatedDate = estimatedCompletionDate(remaining, tradingStats.averageMonthlyPnl);
            const last30MovementPct = goal.target_amount ? (tradingStats.last30Pnl / goal.target_amount) * 100 : 0;
            return (
              <Card key={goal.id}>
                <CardContent className="grid gap-5 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold text-ink">{goal.name}</h2>
                        <span className="rounded-full border border-stroke bg-canvas px-2 py-1 text-xs text-muted">{goal.category}</span>
                        <span className="rounded-full border border-stroke bg-canvas px-2 py-1 text-xs text-muted">{goal.priority}</span>
                      </div>
                      {goal.notes ? <p className="mt-2 text-sm text-muted">{goal.notes}</p> : null}
                    </div>
                    <Button type="button" variant="ghost" size="icon" aria-label="Delete goal" onClick={() => deleteGoal(goal.id)}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-muted">{money(goal.current_saved_amount)} saved</span>
                      <span className="font-medium text-ink">{pct(progress)}</span>
                    </div>
                    <div className="h-4 overflow-hidden rounded-full bg-canvas">
                      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-lg border border-stroke bg-canvas p-3">
                      <div className="text-xs text-muted">Remaining</div>
                      <div className="mt-2 font-semibold text-ink">{money(remaining)}</div>
                    </div>
                    <div className="rounded-lg border border-stroke bg-canvas p-3">
                      <div className="text-xs text-muted">Monthly Required</div>
                      <div className="mt-2 font-semibold text-ink">{monthlyRequired === null ? "Add deadline" : money(monthlyRequired)}</div>
                    </div>
                    <div className="rounded-lg border border-stroke bg-canvas p-3">
                      <div className="text-xs text-muted">Estimated Completion</div>
                      <div className="mt-2 font-semibold text-ink">{estimatedDate}</div>
                    </div>
                    <div className="rounded-lg border border-stroke bg-canvas p-3">
                      <div className="text-xs text-muted">30d Trading Movement</div>
                      <div className="mt-2 font-semibold text-ink">
                        {money(tradingStats.last30Pnl)} / {last30MovementPct >= 0 ? "+" : ""}{pct(last30MovementPct)}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[240px_1fr]">
                    <Field label="Update Saved Amount">
                      <Input
                        type="number"
                        min="0"
                        step="100"
                        value={goal.current_saved_amount}
                        onChange={(event) => updateSavedAmount(goal.id, parseNumber(event.target.value))}
                      />
                    </Field>
                    <div className="rounded-lg border border-stroke bg-canvas p-3 text-sm text-muted">
                      Last 30 days moved this goal {tradingStats.last30Pnl >= 0 ? "closer" : "further"} by {money(Math.abs(tradingStats.last30Pnl))}.
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!goals.length ? (
            <Card>
              <CardContent className="p-10 text-center text-muted">No goals yet. Add one to start tracking progress.</CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
