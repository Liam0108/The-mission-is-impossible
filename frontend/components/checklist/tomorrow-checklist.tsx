"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SESSIONS } from "@/lib/constants";

const CHECKLIST_KEY = "fabio-tomorrow-checklist-v1";

const preMarketItems = [
  ["htf_bias_checked", "Higher timeframe bias checked"],
  ["value_area_marked", "Yesterday VAH/VAL/POC marked"],
  ["pdh_pdl_marked", "PDH/PDL marked"],
  ["news_checked", "News checked"],
  ["session_selected", "Main session selected"],
  ["risk_selected", "Risk per trade selected"],
  ["max_loss_selected", "Max daily loss selected"],
  ["no_trade_reviewed", "No-trade conditions reviewed"]
] as const;

const postTradeItems = [
  ["screenshot_attached", "Screenshot attached"],
  ["setup_completed", "Setup fields completed"],
  ["result_r_confirmed", "Result R confirmed"],
  ["mistake_tag_added", "Mistake tag added"],
  ["lesson_written", "Lesson learned written"],
  ["quality_good", "Data quality is good"]
] as const;

type ChecklistState = Record<(typeof preMarketItems)[number][0] | (typeof postTradeItems)[number][0], boolean> & {
  main_session: string;
  risk_per_trade: string;
  max_daily_loss: string;
  notes: string;
};

function emptyState(): ChecklistState {
  return {
    htf_bias_checked: false,
    value_area_marked: false,
    pdh_pdl_marked: false,
    news_checked: false,
    session_selected: false,
    risk_selected: false,
    max_loss_selected: false,
    no_trade_reviewed: false,
    screenshot_attached: false,
    setup_completed: false,
    result_r_confirmed: false,
    mistake_tag_added: false,
    lesson_written: false,
    quality_good: false,
    main_session: "NY_AM",
    risk_per_trade: "",
    max_daily_loss: "",
    notes: ""
  };
}

function ChecklistGroup({
  title,
  items,
  state,
  setChecked
}: {
  title: string;
  items: readonly (readonly [keyof ChecklistState, string])[];
  state: ChecklistState;
  setChecked: (key: keyof ChecklistState, value: boolean) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {items.map(([key, label]) => (
          <label key={String(key)} className="flex items-center justify-between gap-3 rounded-lg border border-stroke bg-canvas px-3 py-3 text-sm">
            <span className="font-medium text-ink">{label}</span>
            <input
              className="h-4 w-4 accent-[rgb(var(--accent))]"
              type="checkbox"
              checked={Boolean(state[key])}
              onChange={(event) => setChecked(key, event.target.checked)}
            />
          </label>
        ))}
      </CardContent>
    </Card>
  );
}

export function TomorrowChecklist() {
  const [state, setState] = useState<ChecklistState>(emptyState);

  useEffect(() => {
    try {
      setState({ ...emptyState(), ...JSON.parse(window.localStorage.getItem(CHECKLIST_KEY) ?? "{}") });
    } catch {
      setState(emptyState());
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(CHECKLIST_KEY, JSON.stringify(state));
  }, [state]);

  const completed = useMemo(() => {
    const keys = [...preMarketItems, ...postTradeItems].map(([key]) => key);
    return keys.filter((key) => state[key]).length;
  }, [state]);

  function setChecked(key: keyof ChecklistState, value: boolean) {
    setState((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-accent">Preparation</div>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Tomorrow Trading Checklist</h1>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-stroke bg-panel px-3 py-2 text-sm text-muted">
          <CheckCircle2 className="h-4 w-4 text-positive" />
          {completed} / {preMarketItems.length + postTradeItems.length} complete
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Plan Inputs</CardTitle>
            <Button type="button" variant="secondary" onClick={() => setState(emptyState())}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Main Session">
              <Select value={state.main_session} options={SESSIONS} onChange={(event) => setState((current) => ({ ...current, main_session: event.target.value, session_selected: true }))} />
            </Field>
            <Field label="Risk Per Trade">
              <Input value={state.risk_per_trade} onChange={(event) => setState((current) => ({ ...current, risk_per_trade: event.target.value, risk_selected: Boolean(event.target.value) }))} placeholder="0.5% or $250" />
            </Field>
            <Field label="Max Daily Loss">
              <Input value={state.max_daily_loss} onChange={(event) => setState((current) => ({ ...current, max_daily_loss: event.target.value, max_loss_selected: Boolean(event.target.value) }))} placeholder="$1000" />
            </Field>
            <Field label="Notes">
              <Textarea value={state.notes} onChange={(event) => setState((current) => ({ ...current, notes: event.target.value }))} placeholder="Bias, no-trade conditions, or review focus." />
            </Field>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <ChecklistGroup title="Pre-Market Checklist" items={preMarketItems} state={state} setChecked={setChecked} />
          <ChecklistGroup title="Post-Trade Checklist" items={postTradeItems} state={state} setChecked={setChecked} />
        </div>
      </div>
    </div>
  );
}
