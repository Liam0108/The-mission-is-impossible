"use client";

import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, FileSpreadsheet, ImageUp, Pencil, Plus, Save, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE, api } from "@/lib/api";
import { parseBrokerCsv, type BrokerImportPreview } from "@/lib/broker-import";
import {
  BIASES,
  CHOCH_TIMEFRAMES,
  DATA_TYPES,
  DIRECTIONS,
  ENTRY_PULLBACK_STRUCTURES,
  BIAS_VALUES,
  FOLLOWED_PLAN_VALUES,
  FVG_REACTIONS,
  INSTRUMENTS,
  LOCATIONS,
  MANUAL_QUALITIES,
  MARKET_STATES,
  MISTAKE_TYPES,
  NEWS_TIMINGS,
  NEWS_TYPES,
  POC_RISK_LEVELS,
  REGIME_LABELS,
  RESULTS,
  SESSIONS,
  SETUP_TYPES,
  SKIP_REASONS,
  SWEEP_TIMEFRAMES,
  TRADE_DECISIONS,
  VOLUME_STATES,
  YES_NO
} from "@/lib/constants";
import { getStoredLanguage, optionLabel, tradeCopy, type Language } from "@/lib/i18n";
import type { Trade, TradePayload } from "@/lib/types";
import { cn, formatR } from "@/lib/utils";

const DRAFT_KEY = "fabio-trade-draft";
const LAST_VALUES_KEY = "fabio-last-fast-fields";

const COPY_FIELDS: Array<keyof TradePayload> = [
  "session",
  "instrument",
  "data_type",
  "direction",
  "bias_15m",
  "market_state",
  "regime_label",
  "location",
  "liquidity_sweep",
  "choch",
  "lh_hl",
  "fvg_reaction",
  "volume_state",
  "setup_type",
  "trade_decision",
  "distance_to_poc",
  "distance_to_vah",
  "distance_to_val",
  "poc_risk_level",
  "high_impact_news",
  "news_timing",
  "user_id",
  "workspace_id"
];

const QUICK_TEMPLATES: Array<{ nameKey: keyof ReturnType<typeof tradeCopy>["templates"]; values: Partial<TradePayload> }> = [
  { nameKey: "nyAmShort", values: { session: "NY_AM", direction: "Short", bias_15m: "Short", market_state: "Imbalanced", regime_label: "Trend Down", lh_hl: "LH for Short", setup_type: "Fabio Short" } },
  { nameKey: "nyAmLong", values: { session: "NY_AM", direction: "Long", bias_15m: "Long", market_state: "Imbalanced", regime_label: "Trend Up", lh_hl: "HL for Long", setup_type: "Fabio Long" } },
  { nameKey: "asiaRangeWatch", values: { session: "Asian", trade_decision: "Watched", market_state: "Balanced", regime_label: "Balanced", location: "POC", liquidity_sweep: "None", choch: "None" } },
  { nameKey: "pocAvoid", values: { trade_decision: "Skipped", skip_reason: "Near POC", location: "POC", poc_risk_level: "High", regime_label: "POC Chop", setup_type: "POC Rejection" } },
  { nameKey: "newsAvoid", values: { trade_decision: "Skipped", skip_reason: "News Risk", high_impact_news: "Yes", news_timing: "Before News", regime_label: "News Driven", setup_type: "News Trade" } },
  { nameKey: "sweepChochFvg", values: { liquidity_sweep: "5m", choch: "1m", lh_hl: "HL for Long", fvg_reaction: "Strong", setup_type: "Sweep Reversal Long" } }
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function baseTrade(): TradePayload {
  return {
    user_id: null,
    workspace_id: null,
    date: today(),
    instrument: "NQ",
    data_type: "Backtest",
    session: "NY_AM",
    direction: "Long",
    bias_15m: "Long",
    market_state: "Imbalanced",
    regime_label: null,
    location: "VAH",
    liquidity_sweep: "None",
    choch: "None",
    lh_hl: "None",
    fvg_reaction: "Strong",
    volume_state: "Normal",
    strategy_version: "Fabio_V1",
    setup_type: null,
    setup_score: null,
    manual_quality: null,
    trade_decision: "Taken",
    skip_reason: null,
    entry_price: null,
    stop_loss: null,
    tp1_price: null,
    tp2_price: null,
    risk_amount: null,
    result: "NoTrade",
    result_r: 0,
    mfe: 0,
    mae: 0,
    distance_to_poc: null,
    distance_to_vah: null,
    distance_to_val: null,
    poc_risk_level: "Medium",
    similarity_group_id: null,
    management_rule_notes: null,
    screenshot_tags: "",
    screenshot_favorite: false,
    screenshot_bookmarked: false,
    screenshot_notes: "",
    lessons_learned: "",
    followed_plan: "Yes",
    mistake_type: "None",
    discipline_score: null,
    execution_score: null,
    emotion_score: null,
    review_notes: "",
    daily_bias: "Neutral",
    weekly_bias: "Neutral",
    monthly_bias: "Neutral",
    high_impact_news: "No",
    news_type: null,
    news_timing: "No News",
    notes: "",
    screenshot_path: null,
    data_quality: "incomplete",
    account: null,
    broker_symbol: null,
    quantity: null,
    entry_time: null,
    exit_time: null,
    exit_price: null,
    gross_pnl: null,
    commission: null,
    net_pnl: null,
    broker_trade_id: null,
    import_source: null,
    holding_time_minutes: null,
    imported: false,
    review_status: "reviewed"
  };
}

function numberOrNull(value: string) {
  return value === "" ? null : Number(value);
}

function toPayload(trade: Trade): TradePayload {
  const payload = { ...trade };
  delete (payload as Partial<Trade>).id;
  delete (payload as Partial<Trade>).created_at;
  delete (payload as Partial<Trade>).updated_at;
  return payload as TradePayload;
}

function readStoredPayload(key: string): Partial<TradePayload> {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "{}") as Partial<TradePayload>;
  } catch {
    return {};
  }
}

function duplicatePayload(source: Trade | TradePayload): TradePayload {
  const next = baseTrade();
  for (const field of COPY_FIELDS) {
    next[field] = source[field] as never;
  }
  return { ...next, date: today() };
}

function calculateDistances(form: TradePayload) {
  if (form.entry_price === null || form.stop_loss === null) {
    return { riskDistance: null, rewardDistance: null, rr: null };
  }
  const riskDistance = Math.abs(form.entry_price - form.stop_loss);
  const rewardDistance = form.tp1_price === null ? null : Math.abs(form.tp1_price - form.entry_price);
  const rr = rewardDistance !== null && riskDistance > 0 ? rewardDistance / riskDistance : null;
  return {
    riskDistance,
    rewardDistance,
    rr
  };
}

function resultRFor(result: string, rr: number | null) {
  if (result === "TP1") return Number((rr ?? 1).toFixed(2));
  if (result === "BE") return 0;
  if (result === "SL") return -1;
  return 0;
}

function resultRFromImportedTrade(trade: Trade, stopLoss: number | null | undefined) {
  if (trade.entry_price === null || trade.exit_price === null || stopLoss === null || stopLoss === undefined) return trade.result_r;
  const risk = Math.abs(trade.entry_price - stopLoss);
  if (!risk) return trade.result_r;
  const reward = trade.direction === "Long" ? trade.exit_price - trade.entry_price : trade.entry_price - trade.exit_price;
  return Number((reward / risk).toFixed(2));
}

function screenshotHref(path: string) {
  if (path.startsWith("data:") || path.startsWith("blob:")) return path;
  return `${API_BASE}/${path.replace(/\\/g, "/")}`;
}

export function TradeLogger() {
  const [language, setLanguage] = useState<Language>("en");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [form, setForm] = useState<TradePayload>(baseTrade());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingScreenshot, setPendingScreenshot] = useState<File | null>(null);
  const [quickDuplicateMode, setQuickDuplicateMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brokerPreview, setBrokerPreview] = useState<BrokerImportPreview | null>(null);
  const [brokerSummary, setBrokerSummary] = useState<{ imported: number; duplicates: number; errors: number; missingFields: string } | null>(null);
  const [reviewTradeId, setReviewTradeId] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState<Partial<TradePayload>>({});
  const [reviewScreenshot, setReviewScreenshot] = useState<File | null>(null);
  const csvInput = useRef<HTMLInputElement | null>(null);
  const brokerCsvInput = useRef<HTMLInputElement | null>(null);
  const screenshotInput = useRef<HTMLInputElement | null>(null);
  const reviewScreenshotInput = useRef<HTMLInputElement | null>(null);

  const sortedTrades = useMemo(() => [...trades].sort((a, b) => b.date.localeCompare(a.date)), [trades]);
  const lastTrade = sortedTrades[0];
  const unreviewedTrades = useMemo(() => sortedTrades.filter((trade) => trade.imported && trade.review_status === "unreviewed"), [sortedTrades]);
  const currentReviewTrade = useMemo(
    () => unreviewedTrades.find((trade) => trade.id === reviewTradeId) ?? unreviewedTrades[0] ?? null,
    [reviewTradeId, unreviewedTrades]
  );
  const distances = useMemo(() => calculateDistances(form), [form]);
  const copy = tradeCopy(language);
  const englishCopy = tradeCopy("en");
  const label = (field: keyof typeof copy.fields) => (copy.fields[field] ?? englishCopy.fields[field])[0];
  const helper = (field: keyof typeof copy.fields) => (copy.fields[field] ?? englishCopy.fields[field])[1];
  const display = (value: string) => optionLabel(language, value);
  const displayNullable = (value: string | null | undefined) => (value ? optionLabel(language, value) : copy.notAvailable);
  const selectLabel = (option: string) => optionLabel(language, option);

  async function loadTrades() {
    try {
      setTrades(await api.trades());
      setError(null);
    } catch {
      setError(copy.apiOffline);
    }
  }

  useEffect(() => {
    setLanguage(getStoredLanguage());
    const draft = readStoredPayload(DRAFT_KEY);
    const lastValues = readStoredPayload(LAST_VALUES_KEY);
    setForm({ ...baseTrade(), ...lastValues, ...draft, date: draft.date ?? today() });
    loadTrades();
    function handleLanguageChange(event: Event) {
      setLanguage((event as CustomEvent<Language>).detail ?? getStoredLanguage());
    }
    window.addEventListener("fabio-language-change", handleLanguageChange);
    return () => window.removeEventListener("fabio-language-change", handleLanguageChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    const remembered = COPY_FIELDS.reduce<Partial<TradePayload>>((acc, field) => {
      acc[field] = form[field] as never;
      return acc;
    }, {});
    window.localStorage.setItem(LAST_VALUES_KEY, JSON.stringify(remembered));
  }, [form]);

  useEffect(() => {
    if (!currentReviewTrade) {
      setReviewDraft({});
      setReviewScreenshot(null);
      return;
    }
    setReviewDraft({
      setup_type: currentReviewTrade.setup_type,
      session: currentReviewTrade.session,
      regime_label: currentReviewTrade.regime_label,
      manual_quality: currentReviewTrade.manual_quality,
      mistake_type: currentReviewTrade.mistake_type,
      stop_loss: currentReviewTrade.stop_loss,
      notes: currentReviewTrade.notes ?? ""
    });
    setReviewScreenshot(null);
  }, [currentReviewTrade]);

  useEffect(() => {
    const nextResultR = resultRFor(form.result, distances.rr);
    if (form.result_r !== nextResultR && ["TP1", "BE", "SL", "NoTrade", "Unknown"].includes(form.result)) {
      setForm((current) => ({ ...current, result_r: nextResultR }));
    }
  }, [distances.rr, form.result, form.result_r]);

  function setField<K extends keyof TradePayload>(key: K, value: TradePayload[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function newTrade() {
    setEditingId(null);
    setQuickDuplicateMode(false);
    setPendingScreenshot(null);
    setForm({ ...baseTrade(), ...readStoredPayload(LAST_VALUES_KEY), date: today() });
  }

  function duplicateLastTrade() {
    setQuickDuplicateMode(true);
    if (lastTrade) {
      setEditingId(null);
      setPendingScreenshot(null);
      setForm(duplicatePayload(lastTrade));
      return;
    }
    setForm(duplicatePayload(form));
  }

  function applyTemplate(values: Partial<TradePayload>) {
    setQuickDuplicateMode(false);
    setForm((current) => ({ ...current, ...values, date: current.date || today() }));
  }

  async function saveTrade(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...form,
        skip_reason: ["Skipped", "Watched"].includes(form.trade_decision) ? form.skip_reason : null
      };
      const saved = editingId ? await api.updateTrade(editingId, payload) : await api.createTrade(payload);
      if (pendingScreenshot) {
        await api.uploadScreenshot(saved.id, pendingScreenshot);
      }
      window.localStorage.removeItem(DRAFT_KEY);
      setPendingScreenshot(null);
      setEditingId(null);
      setQuickDuplicateMode(false);
      setForm({ ...baseTrade(), ...readStoredPayload(LAST_VALUES_KEY), date: today() });
      await loadTrades();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableToSave);
    } finally {
      setBusy(false);
    }
  }

  async function deleteTrade(id: string) {
    setBusy(true);
    try {
      await api.deleteTrade(id);
      if (editingId === id) newTrade();
      await loadTrades();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableToDelete);
    } finally {
      setBusy(false);
    }
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await api.importCsv(file);
      await loadTrades();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableToImport);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  async function previewBrokerCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const preview = parseBrokerCsv(await file.text(), trades, file.name);
      setBrokerPreview(preview);
      setBrokerSummary(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to parse broker CSV");
    } finally {
      event.target.value = "";
    }
  }

  async function importBrokerPreview() {
    if (!brokerPreview) return;
    const importable = brokerPreview.candidates.filter((candidate) => !candidate.duplicate && candidate.errors.length === 0);
    setBusy(true);
    let imported = 0;
    let errors = 0;
    try {
      for (const candidate of importable) {
        try {
          await api.createTrade(candidate.payload);
          imported += 1;
        } catch {
          errors += 1;
        }
      }
      await loadTrades();
      setBrokerSummary({
        imported,
        duplicates: brokerPreview.summary.duplicateRows,
        errors: brokerPreview.summary.errorRows + errors,
        missingFields: brokerPreview.summary.missingFieldCounts.map((item) => `${item.field}: ${item.count}`).join(", ") || "None"
      });
      if (errors === 0) setBrokerPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to import broker CSV");
    } finally {
      setBusy(false);
    }
  }

  function setReviewField<K extends keyof TradePayload>(key: K, value: TradePayload[K]) {
    setReviewDraft((current) => ({ ...current, [key]: value }));
  }

  async function saveReviewAndNext() {
    if (!currentReviewTrade) return;
    setBusy(true);
    try {
      const stopLoss = reviewDraft.stop_loss === undefined ? currentReviewTrade.stop_loss : reviewDraft.stop_loss;
      const payload: Partial<TradePayload> = {
        ...reviewDraft,
        result_r: resultRFromImportedTrade(currentReviewTrade, stopLoss),
        review_status: "reviewed"
      };
      const saved = await api.updateTrade(currentReviewTrade.id, payload);
      if (reviewScreenshot) {
        await api.uploadScreenshot(saved.id, reviewScreenshot);
      }
      setReviewTradeId(null);
      setReviewScreenshot(null);
      await loadTrades();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save imported trade review");
    } finally {
      setBusy(false);
    }
  }

  function captureScreenshot(file?: File) {
    if (!file) return;
    setPendingScreenshot(file);
  }

  async function uploadScreenshot(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!editingId) {
      captureScreenshot(file);
      event.target.value = "";
      return;
    }
    setBusy(true);
    try {
      await api.uploadScreenshot(editingId, file);
      await loadTrades();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableToUpload);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    captureScreenshot(event.dataTransfer.files?.[0]);
  }

  const skippedMode = ["Skipped", "Watched"].includes(form.trade_decision);

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-accent">{copy.eyebrow}</div>
          <h1 className="mt-2 text-3xl font-semibold text-ink">{copy.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={csvInput} type="file" accept=".csv" className="hidden" onChange={importCsv} />
          <input ref={screenshotInput} type="file" accept="image/*" className="hidden" onChange={uploadScreenshot} />
          <Button variant="secondary" onClick={duplicateLastTrade} disabled={busy}>
            <Copy className="h-4 w-4" />
            {copy.duplicateLastTrade}
          </Button>
          <Button variant="secondary" onClick={() => csvInput.current?.click()} disabled={busy}>
            <Upload className="h-4 w-4" />
            {copy.importCsv}
          </Button>
          <Button variant="secondary" onClick={() => api.exportCsv()}>
            <Download className="h-4 w-4" />
            {copy.exportCsv}
          </Button>
        </div>
      </section>

      {error ? <div className="rounded-lg border border-stroke bg-panel px-4 py-3 text-sm text-muted">{error}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle>Broker Trade Import V1</CardTitle>
          <Button type="button" variant="secondary" onClick={() => brokerCsvInput.current?.click()} disabled={busy}>
            <FileSpreadsheet className="h-4 w-4" />
            Upload Broker CSV
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4">
          <input ref={brokerCsvInput} type="file" accept=".csv" className="hidden" onChange={previewBrokerCsv} />
          <div className="rounded-lg border border-stroke bg-canvas px-4 py-3 text-sm leading-6 text-muted">
            Supports Tradovate, NinjaTrader, and generic broker CSV exports. Unknown indicator or platform columns are ignored. Imported trades are saved as completed trades with <span className="font-medium text-ink">review_status = unreviewed</span>.
          </div>

          {brokerSummary ? (
            <div className="grid gap-3 md:grid-cols-4">
              <ImportMetric label="Imported Trades" value={brokerSummary.imported} />
              <ImportMetric label="Duplicates Skipped" value={brokerSummary.duplicates} />
              <ImportMetric label="Errors" value={brokerSummary.errors} />
              <div className="rounded-lg border border-stroke bg-canvas px-3 py-2">
                <div className="text-xs text-muted">Missing Fields</div>
                <div className="mt-1 text-sm font-medium text-ink">{brokerSummary.missingFields}</div>
              </div>
            </div>
          ) : null}

          {brokerPreview ? (
            <div className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-5">
                <ImportMetric label="Detected Source" value={brokerPreview.source} />
                <ImportMetric label="CSV Rows" value={brokerPreview.summary.totalRows} />
                <ImportMetric label="Importable" value={brokerPreview.summary.importableRows} />
                <ImportMetric label="Duplicates" value={brokerPreview.summary.duplicateRows} />
                <ImportMetric label="Error Rows" value={brokerPreview.summary.errorRows} />
              </div>
              <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-lg border border-stroke bg-canvas p-3">
                  <div className="mb-2 text-sm font-medium text-ink">Column Mapping Preview</div>
                  <div className="grid gap-1 text-sm">
                    {brokerPreview.columnMapping.map((item) => (
                      <div key={`${item.source}-${item.target}`} className="flex items-center justify-between gap-3 rounded-md px-2 py-1 text-muted">
                        <span>{item.source}</span>
                        <span className="font-medium text-ink">{item.target}</span>
                      </div>
                    ))}
                    {!brokerPreview.columnMapping.length ? <div className="text-muted">No supported broker columns detected.</div> : null}
                  </div>
                </div>
                <div className="rounded-lg border border-stroke bg-canvas p-3">
                  <div className="mb-2 text-sm font-medium text-ink">Import Summary</div>
                  <div className="grid gap-2 text-sm text-muted">
                    <div>Missing required columns: {brokerPreview.missingColumns.length ? brokerPreview.missingColumns.join(", ") : "None"}</div>
                    <div>Missing fields: {brokerPreview.summary.missingFieldCounts.map((item) => `${item.field}: ${item.count}`).join(", ") || "None"}</div>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-stroke">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-canvas text-xs uppercase text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">Row</th>
                      <th className="px-3 py-2 font-medium">Account</th>
                      <th className="px-3 py-2 font-medium">Symbol</th>
                      <th className="px-3 py-2 font-medium">Direction</th>
                      <th className="px-3 py-2 font-medium">Entry</th>
                      <th className="px-3 py-2 font-medium">Exit</th>
                      <th className="px-3 py-2 text-right font-medium">Net PnL</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brokerPreview.candidates.slice(0, 8).map((candidate) => (
                      <tr key={candidate.rowNumber} className="border-t border-stroke">
                        <td className="px-3 py-2 text-muted">{candidate.rowNumber}</td>
                        <td className="px-3 py-2 text-muted">{candidate.payload.account ?? copy.notAvailable}</td>
                        <td className="px-3 py-2 text-muted">{candidate.payload.broker_symbol ?? candidate.payload.instrument}</td>
                        <td className="px-3 py-2 text-muted">{candidate.payload.direction}</td>
                        <td className="px-3 py-2 text-muted">{candidate.payload.entry_price ?? copy.notAvailable}</td>
                        <td className="px-3 py-2 text-muted">{candidate.payload.exit_price ?? copy.notAvailable}</td>
                        <td className="px-3 py-2 text-right text-muted">{candidate.payload.net_pnl ?? copy.notAvailable}</td>
                        <td className="px-3 py-2 text-muted">
                          {candidate.duplicate ? candidate.duplicateReason : candidate.errors.length ? candidate.errors.join(", ") : "Ready"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setBrokerPreview(null)} disabled={busy}>Clear Preview</Button>
                <Button type="button" variant="primary" onClick={importBrokerPreview} disabled={busy || brokerPreview.summary.importableRows === 0}>
                  <Upload className="h-4 w-4" />
                  Import {brokerPreview.summary.importableRows} Trades
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {currentReviewTrade ? (
        <Card>
          <CardHeader>
            <CardTitle>Unreviewed Imported Trade</CardTitle>
            <div className="text-sm text-muted">{unreviewedTrades.length} waiting for review</div>
          </CardHeader>
          <CardContent className="grid gap-5">
            <input ref={reviewScreenshotInput} type="file" accept="image/*" className="hidden" onChange={(event) => setReviewScreenshot(event.target.files?.[0] ?? null)} />
            <div className="grid gap-3 md:grid-cols-5">
              <ImportMetric label="Symbol" value={currentReviewTrade.broker_symbol ?? currentReviewTrade.instrument} />
              <ImportMetric label="Direction" value={currentReviewTrade.direction} />
              <ImportMetric label="Net PnL" value={currentReviewTrade.net_pnl ?? copy.notAvailable} />
              <ImportMetric label="Holding Time" value={currentReviewTrade.holding_time_minutes === null ? copy.notAvailable : `${currentReviewTrade.holding_time_minutes} min`} />
              <ImportMetric label="Result R" value={formatR(Number(currentReviewTrade.result_r))} />
            </div>

            <div className="grid gap-4">
              <QuickButtonRow
                label="Setup Type"
                value={reviewDraft.setup_type ?? ""}
                options={SETUP_TYPES.filter(Boolean)}
                onChange={(value) => setReviewField("setup_type", value)}
              />
              <QuickButtonRow
                label="Session"
                value={reviewDraft.session ?? currentReviewTrade.session}
                options={["NY_AM", "NY_PM", "London", "Asian"]}
                onChange={(value) => setReviewField("session", value)}
              />
              <QuickButtonRow
                label="Manual Quality"
                value={reviewDraft.manual_quality ?? ""}
                options={MANUAL_QUALITIES.filter(Boolean)}
                onChange={(value) => setReviewField("manual_quality", value)}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Regime Label">
                <Select value={reviewDraft.regime_label ?? ""} options={["", ...REGIME_LABELS]} onChange={(event) => setReviewField("regime_label", event.target.value || null)} />
              </Field>
              <Field label="Stop Loss">
                <Input type="number" step="0.25" value={reviewDraft.stop_loss ?? ""} onChange={(event) => setReviewField("stop_loss", numberOrNull(event.target.value))} />
              </Field>
              <Field label="Mistake Tag">
                <Select value={reviewDraft.mistake_type ?? "None"} options={MISTAKE_TYPES} onChange={(event) => setReviewField("mistake_type", event.target.value)} />
              </Field>
              <Field label="Screenshot">
                <Button type="button" variant="secondary" onClick={() => reviewScreenshotInput.current?.click()}>
                  <ImageUp className="h-4 w-4" />
                  {reviewScreenshot ? reviewScreenshot.name : "Attach Optional"}
                </Button>
              </Field>
            </div>

            <Field label="Notes">
              <Textarea value={reviewDraft.notes ?? ""} onChange={(event) => setReviewField("notes", event.target.value)} placeholder="Add setup notes, execution context, or lesson learned." />
            </Field>

            <div className="flex flex-wrap justify-between gap-2">
              <Button type="button" variant="ghost" onClick={() => setReviewTradeId(unreviewedTrades[1]?.id ?? null)} disabled={unreviewedTrades.length <= 1}>
                Skip For Now
              </Button>
              <Button type="button" variant="primary" onClick={saveReviewAndNext} disabled={busy}>
                <Save className="h-4 w-4" />
                Save & Next
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <form onSubmit={saveTrade} className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        {quickDuplicateMode ? (
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>{copy.duplicateQuickEdit}</CardTitle>
              <Button type="submit" variant="primary" disabled={busy}>
                <Save className="h-4 w-4" />
                {copy.saveDuplicate}
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-5">
              <Field label={label("direction")} helper={helper("direction")}>
                <SegmentedControl value={form.direction} options={DIRECTIONS} getOptionLabel={selectLabel} onChange={(value) => setField("direction", value)} />
              </Field>
              <Field label={label("entry")} helper={helper("entry")}>
                <Input type="number" step="0.25" value={form.entry_price ?? ""} onChange={(event) => setField("entry_price", numberOrNull(event.target.value))} />
              </Field>
              <Field label={label("stop")} helper={helper("stop")}>
                <Input type="number" step="0.25" value={form.stop_loss ?? ""} onChange={(event) => setField("stop_loss", numberOrNull(event.target.value))} />
              </Field>
              <Field label={label("result")} helper={helper("result")}>
                <Select value={form.result} options={RESULTS} getOptionLabel={selectLabel} onChange={(event) => setField("result", event.target.value)} />
              </Field>
              <Field label={label("notes")} helper={helper("notes")}>
                <Textarea value={form.notes ?? ""} placeholder={copy.placeholders.notes} onChange={(event) => setField("notes", event.target.value)} />
              </Field>
            </CardContent>
          </Card>
        ) : null}

        <Card className={quickDuplicateMode ? "hidden" : undefined}>
          <CardHeader>
            <CardTitle>{editingId ? copy.editSetup : copy.fastSetupEntry}</CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={newTrade}>
              <Plus className="h-4 w-4" />
              {copy.new}
            </Button>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="flex flex-wrap gap-2">
              {QUICK_TEMPLATES.map((template) => (
                <Button key={template.nameKey} type="button" variant="secondary" size="sm" onClick={() => applyTemplate(template.values)}>
                  {copy.templates[template.nameKey]}
                </Button>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label={label("date")} helper={helper("date")}>
                <Input tabIndex={1} type="date" value={form.date} onChange={(event) => setField("date", event.target.value)} />
              </Field>
              <Field label={label("symbol")} helper={helper("symbol")}>
                <Select tabIndex={2} value={form.instrument} options={INSTRUMENTS} getOptionLabel={selectLabel} onChange={(event) => setField("instrument", event.target.value)} />
              </Field>
              <Field label={label("dataType")} helper={helper("dataType")}>
                <Select tabIndex={3} value={form.data_type} options={DATA_TYPES} getOptionLabel={selectLabel} onChange={(event) => setField("data_type", event.target.value)} />
              </Field>
              <Field label={label("session")} helper={helper("session")}>
                <Select tabIndex={4} value={form.session} options={SESSIONS} getOptionLabel={selectLabel} onChange={(event) => setField("session", event.target.value)} />
              </Field>
            </div>

            <div className="grid gap-3">
              <Field label={label("tradeDecision")} helper={helper("tradeDecision")}>
                <SegmentedControl value={form.trade_decision} options={TRADE_DECISIONS} getOptionLabel={selectLabel} onChange={(value) => setField("trade_decision", value)} />
              </Field>
              {skippedMode ? (
                <Field label={label("skipReason")} helper={helper("skipReason")}>
                  <Select value={form.skip_reason ?? "Near POC"} options={SKIP_REASONS} getOptionLabel={selectLabel} onChange={(event) => setField("skip_reason", event.target.value)} />
                </Field>
              ) : null}
            </div>

            <div className="grid gap-3">
              <Field label={label("direction")} helper={helper("direction")}>
                <SegmentedControl value={form.direction} options={DIRECTIONS} getOptionLabel={selectLabel} onChange={(value) => setField("direction", value)} />
              </Field>
              <Field label={label("bias15m")} helper={helper("bias15m")}>
                <SegmentedControl value={form.bias_15m} options={BIASES} getOptionLabel={selectLabel} onChange={(value) => setField("bias_15m", value)} />
              </Field>
              <Field label={label("marketState")} helper={helper("marketState")}>
                <SegmentedControl value={form.market_state} options={MARKET_STATES} getOptionLabel={selectLabel} onChange={(value) => setField("market_state", value)} />
              </Field>
              <Field label={label("regimeLabel")} helper={helper("regimeLabel")}>
                <Select value={form.regime_label ?? ""} options={["", ...REGIME_LABELS]} getOptionLabel={selectLabel} onChange={(event) => setField("regime_label", event.target.value || null)} />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Field label={label("location")} helper={helper("location")}>
                <Select tabIndex={5} value={form.location} options={LOCATIONS} getOptionLabel={selectLabel} onChange={(event) => setField("location", event.target.value)} />
              </Field>
              <Field label={label("fvg")} helper={helper("fvg")}>
                <Select tabIndex={6} value={form.fvg_reaction} options={FVG_REACTIONS} getOptionLabel={selectLabel} onChange={(event) => setField("fvg_reaction", event.target.value)} />
              </Field>
              <Field label={label("volume")} helper={helper("volume")}>
                <Select tabIndex={7} value={form.volume_state} options={VOLUME_STATES} getOptionLabel={selectLabel} onChange={(event) => setField("volume_state", event.target.value)} />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Field label={label("sweepTimeframe")} helper={helper("sweepTimeframe")}>
                <Select value={form.liquidity_sweep} options={SWEEP_TIMEFRAMES} getOptionLabel={selectLabel} onChange={(event) => setField("liquidity_sweep", event.target.value)} />
              </Field>
              <Field label={label("chochTimeframe")} helper={helper("chochTimeframe")}>
                <SegmentedControl compact value={form.choch} options={CHOCH_TIMEFRAMES} getOptionLabel={selectLabel} onChange={(value) => setField("choch", value)} />
              </Field>
              <Field label={label("entryPullbackStructure")} helper={helper("entryPullbackStructure")}>
                <Select value={form.lh_hl} options={ENTRY_PULLBACK_STRUCTURES} getOptionLabel={selectLabel} onChange={(event) => setField("lh_hl", event.target.value)} />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <Field label={label("distanceToPoc")} helper={helper("distanceToPoc")}>
                <Input type="number" step="0.25" value={form.distance_to_poc ?? ""} onChange={(event) => setField("distance_to_poc", numberOrNull(event.target.value))} />
              </Field>
              <Field label={label("distanceToVah")} helper={helper("distanceToVah")}>
                <Input type="number" step="0.25" value={form.distance_to_vah ?? ""} onChange={(event) => setField("distance_to_vah", numberOrNull(event.target.value))} />
              </Field>
              <Field label={label("distanceToVal")} helper={helper("distanceToVal")}>
                <Input type="number" step="0.25" value={form.distance_to_val ?? ""} onChange={(event) => setField("distance_to_val", numberOrNull(event.target.value))} />
              </Field>
              <Field label={label("pocChopRisk")} helper={helper("pocChopRisk")}>
                <Select value={form.poc_risk_level} options={POC_RISK_LEVELS.filter((item) => item !== "Unknown")} getOptionLabel={selectLabel} onChange={(event) => setField("poc_risk_level", event.target.value)} />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <Field label={label("strategyVersion")} helper={helper("strategyVersion")}>
                <Input value={form.strategy_version ?? ""} onChange={(event) => setField("strategy_version", event.target.value)} placeholder={copy.placeholders.strategyVersion} />
              </Field>
              <Field label={label("setupType")} helper={helper("setupType")}>
                <Select value={form.setup_type ?? ""} options={SETUP_TYPES} getOptionLabel={selectLabel} onChange={(event) => setField("setup_type", event.target.value || null)} />
              </Field>
              <Field label={label("setupScore")} helper={helper("setupScore")}>
                <Input readOnly value={form.setup_score ?? copy.autoCalculated} />
              </Field>
              <Field label={label("manualQuality")} helper={helper("manualQuality")}>
                <Select value={form.manual_quality ?? ""} options={MANUAL_QUALITIES} getOptionLabel={selectLabel} onChange={(event) => setField("manual_quality", event.target.value || null)} />
              </Field>
              <Field label={label("dailyBias")} helper={helper("dailyBias")}>
                <Select value={form.daily_bias} options={BIAS_VALUES} getOptionLabel={selectLabel} onChange={(event) => setField("daily_bias", event.target.value)} />
              </Field>
              <Field label={label("weeklyBias")} helper={helper("weeklyBias")}>
                <Select value={form.weekly_bias} options={BIAS_VALUES} getOptionLabel={selectLabel} onChange={(event) => setField("weekly_bias", event.target.value)} />
              </Field>
              <Field label={label("monthlyBias")} helper={helper("monthlyBias")}>
                <Select value={form.monthly_bias} options={BIAS_VALUES} getOptionLabel={selectLabel} onChange={(event) => setField("monthly_bias", event.target.value)} />
              </Field>
              <Field label={label("highImpactNews")} helper={helper("highImpactNews")}>
                <SegmentedControl compact value={form.high_impact_news} options={YES_NO} getOptionLabel={selectLabel} onChange={(value) => setField("high_impact_news", value)} />
              </Field>
              <Field label={label("newsType")} helper={helper("newsType")}>
                <Select value={form.news_type ?? "CPI"} options={NEWS_TYPES} getOptionLabel={selectLabel} onChange={(event) => setField("news_type", event.target.value)} />
              </Field>
              <Field label={label("newsTiming")} helper={helper("newsTiming")}>
                <Select value={form.news_timing} options={NEWS_TIMINGS} getOptionLabel={selectLabel} onChange={(event) => setField("news_timing", event.target.value)} />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card className={quickDuplicateMode ? "hidden" : undefined}>
          <CardHeader>
            <CardTitle>{copy.execution}</CardTitle>
            <Button type="submit" variant="primary" disabled={busy}>
              <Save className="h-4 w-4" />
              {copy.saveSetup}
            </Button>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-stroke bg-canvas p-3">
                <div className="text-xs text-muted" title={helper("riskDistance")}>{label("riskDistance")}</div>
                <div className="mt-2 text-lg font-semibold text-ink">{distances.riskDistance?.toFixed(2) ?? copy.notAvailable}</div>
              </div>
              <div className="rounded-lg border border-stroke bg-canvas p-3">
                <div className="text-xs text-muted" title={helper("rewardDistance")}>{label("rewardDistance")}</div>
                <div className="mt-2 text-lg font-semibold text-ink">{distances.rewardDistance?.toFixed(2) ?? copy.notAvailable}</div>
              </div>
              <div className="rounded-lg border border-stroke bg-canvas p-3">
                <div className="text-xs text-muted" title={helper("rr")}>{label("rr")}</div>
                <div className="mt-2 text-lg font-semibold text-ink">{distances.rr?.toFixed(2) ?? copy.notAvailable}</div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={label("entry")} helper={helper("entry")}>
                <Input tabIndex={8} type="number" step="0.25" value={form.entry_price ?? ""} onChange={(event) => setField("entry_price", numberOrNull(event.target.value))} />
              </Field>
              <Field label={label("stop")} helper={helper("stop")}>
                <Input tabIndex={9} type="number" step="0.25" value={form.stop_loss ?? ""} onChange={(event) => setField("stop_loss", numberOrNull(event.target.value))} />
              </Field>
              <Field label={label("tp1")} helper={helper("tp1")}>
                <Input tabIndex={10} type="number" step="0.25" value={form.tp1_price ?? ""} onChange={(event) => setField("tp1_price", numberOrNull(event.target.value))} />
              </Field>
              <Field label={label("tp2")} helper={helper("tp2")}>
                <Input tabIndex={11} type="number" step="0.25" value={form.tp2_price ?? ""} onChange={(event) => setField("tp2_price", numberOrNull(event.target.value))} />
              </Field>
              <Field label={label("riskAmount")} helper={helper("riskAmount")}>
                <Input tabIndex={12} type="number" step="0.01" value={form.risk_amount ?? ""} onChange={(event) => setField("risk_amount", numberOrNull(event.target.value))} />
              </Field>
              <Field label={label("result")} helper={helper("result")}>
                <Select tabIndex={13} value={form.result} options={RESULTS} getOptionLabel={selectLabel} onChange={(event) => setField("result", event.target.value)} />
              </Field>
              <Field label={label("resultR")} helper={helper("resultR")}>
                <Input type="number" step="0.01" value={form.result_r} onChange={(event) => setField("result_r", Number(event.target.value))} />
              </Field>
              <Field label={label("mfe")} helper={helper("mfe")}>
                <Input type="number" step="0.01" value={form.mfe} onChange={(event) => setField("mfe", Number(event.target.value))} />
              </Field>
              <Field label={label("mae")} helper={helper("mae")}>
                <Input type="number" step="0.01" value={form.mae} onChange={(event) => setField("mae", Number(event.target.value))} />
              </Field>
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={(event) => event.preventDefault()}
              onClick={() => screenshotInput.current?.click()}
              className={cn(
                "focus-ring flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-stroke bg-canvas p-4 text-center text-sm text-muted",
                pendingScreenshot && "border-accent text-ink"
              )}
              role="button"
              tabIndex={14}
            >
              <ImageUp className="mb-2 h-5 w-5" />
              {pendingScreenshot ? pendingScreenshot.name : copy.dropScreenshot}
            </div>

            <Field label={label("managementNotes")} helper={helper("managementNotes")}>
              <Textarea value={form.management_rule_notes ?? ""} onChange={(event) => setField("management_rule_notes", event.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={label("followedPlan")} helper={helper("followedPlan")}>
                <Select value={form.followed_plan} options={FOLLOWED_PLAN_VALUES} getOptionLabel={selectLabel} onChange={(event) => setField("followed_plan", event.target.value)} />
              </Field>
              <Field label={label("mistakeType")} helper={helper("mistakeType")}>
                <Select value={form.mistake_type} options={MISTAKE_TYPES} getOptionLabel={selectLabel} onChange={(event) => setField("mistake_type", event.target.value)} />
              </Field>
              <Field label={label("screenshotTags")} helper={helper("screenshotTags")}>
                <Input value={form.screenshot_tags ?? ""} onChange={(event) => setField("screenshot_tags", event.target.value)} placeholder={copy.placeholders.screenshotTags} />
              </Field>
              <Field label={label("discipline")} helper={helper("discipline")}>
                <Input type="number" min="1" max="10" value={form.discipline_score ?? ""} onChange={(event) => setField("discipline_score", numberOrNull(event.target.value))} />
              </Field>
              <Field label={label("executionScore")} helper={helper("executionScore")}>
                <Input type="number" min="1" max="10" value={form.execution_score ?? ""} onChange={(event) => setField("execution_score", numberOrNull(event.target.value))} />
              </Field>
              <Field label={label("emotion")} helper={helper("emotion")}>
                <Input type="number" min="1" max="10" value={form.emotion_score ?? ""} onChange={(event) => setField("emotion_score", numberOrNull(event.target.value))} />
              </Field>
            </div>
            <Field label={label("reviewNotes")} helper={helper("reviewNotes")}>
              <Textarea value={form.review_notes ?? ""} placeholder={copy.placeholders.validationNotes} onChange={(event) => setField("review_notes", event.target.value)} />
            </Field>
            <Field label={label("lessonsLearned")} helper={helper("lessonsLearned")}>
              <Textarea value={form.lessons_learned ?? ""} onChange={(event) => setField("lessons_learned", event.target.value)} />
            </Field>
            <Field label={label("notes")} helper={helper("notes")}>
              <Textarea tabIndex={15} value={form.notes ?? ""} placeholder={copy.placeholders.notes} onChange={(event) => setField("notes", event.target.value)} />
            </Field>
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>{copy.recentSetups}</CardTitle>
          <div className="text-sm text-muted">{sortedTrades.length} {copy.records}</div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="text-xs uppercase tracking-normal text-muted">
                <tr className="border-b border-stroke">
                  <th className="py-3 font-medium">{label("date")}</th>
                  <th className="py-3 font-medium">{label("decision")}</th>
                  <th className="py-3 font-medium">{label("symbol")}</th>
                  <th className="py-3 font-medium">{label("session")}</th>
                  <th className="py-3 font-medium">{label("direction")}</th>
                  <th className="py-3 font-medium">{label("regime")}</th>
                  <th className="py-3 font-medium">{label("location")}</th>
                  <th className="py-3 font-medium">{label("pocChopRisk")}</th>
                  <th className="py-3 font-medium">{label("quality")}</th>
                  <th className="py-3 font-medium">{label("result")}</th>
                  <th className="py-3 font-medium">{label("shot")}</th>
                  <th className="py-3 text-right font-medium">R</th>
                  <th className="py-3 text-right font-medium">{label("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {sortedTrades.map((trade) => (
                  <tr key={trade.id} className="border-b border-stroke last:border-0">
                    <td className="py-3 text-ink">{trade.date}</td>
                    <td className="py-3 text-muted">{display(trade.trade_decision)}</td>
                    <td className="py-3 text-muted">{trade.instrument}</td>
                    <td className="py-3 text-muted">{display(trade.session)}</td>
                    <td className="py-3 text-muted">{display(trade.direction)}</td>
                    <td className="py-3 text-muted">{displayNullable(trade.regime_label)}</td>
                    <td className="py-3 text-muted">{display(trade.location)}</td>
                    <td className="py-3 text-muted">{display(trade.poc_risk_level)}</td>
                    <td className="py-3 text-muted">{display(trade.data_quality)}</td>
                    <td className="py-3 font-medium text-ink">{display(trade.result)}</td>
                    <td className="py-3 text-muted">
                      {trade.screenshot_path ? (
                        <a className="text-accent" href={screenshotHref(trade.screenshot_path)} target="_blank">
                          {copy.open}
                        </a>
                      ) : (
                        copy.notAvailable
                      )}
                    </td>
                    <td className="py-3 text-right font-medium text-ink">{formatR(Number(trade.result_r))}</td>
                    <td className="py-3">
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" size="icon" aria-label={copy.editSetup} onClick={() => { setEditingId(trade.id); setQuickDuplicateMode(false); setPendingScreenshot(null); setForm(toPayload(trade)); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" aria-label={copy.unableToDelete} onClick={() => deleteTrade(trade.id)}>
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!sortedTrades.length ? (
                  <tr>
                    <td colSpan={13} className="py-10 text-center text-muted">
                      {copy.noSetupsLogged}
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

function ImportMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-stroke bg-canvas px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

function QuickButtonRow({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-2">
      <div className="text-xs font-medium uppercase tracking-normal text-muted">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button key={option} type="button" variant={value === option ? "primary" : "secondary"} size="sm" onClick={() => onChange(option)}>
            {option}
          </Button>
        ))}
      </div>
    </div>
  );
}
