"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bookmark, Grid3X3, Heart, List, Rows3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Badge } from "@/components/ui/badge";
import { API_BASE, api } from "@/lib/api";
import {
  DIRECTIONS,
  FVG_REACTIONS,
  LOCATIONS,
  MARKET_STATES,
  REGIME_LABELS,
  RESULTS,
  SCREENSHOT_TAGS,
  SESSIONS,
  TRADE_DECISIONS,
  YES_NO
} from "@/lib/constants";
import type { ScreenshotItem } from "@/lib/types";
import { cn, formatR } from "@/lib/utils";

const ALL = "All";

function withAll(options: readonly string[]) {
  return [ALL, ...options];
}

function shotUrl(path: string) {
  if (path.startsWith("data:") || path.startsWith("blob:")) return path;
  return `${API_BASE}/${path.replace(/\\/g, "/")}`;
}

export function ScreenshotLibrary() {
  const [items, setItems] = useState<ScreenshotItem[]>([]);
  const [view, setView] = useState("Grid");
  const [session, setSession] = useState(ALL);
  const [direction, setDirection] = useState(ALL);
  const [location, setLocation] = useState(ALL);
  const [result, setResult] = useState(ALL);
  const [marketState, setMarketState] = useState(ALL);
  const [regimeLabel, setRegimeLabel] = useState(ALL);
  const [choch, setChoch] = useState(ALL);
  const [sweep, setSweep] = useState(ALL);
  const [fvg, setFvg] = useState(ALL);
  const [decision, setDecision] = useState(ALL);
  const [tag, setTag] = useState(ALL);
  const [strategyVersion, setStrategyVersion] = useState("");
  const [scoreMin, setScoreMin] = useState("");
  const [scoreMax, setScoreMax] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (session !== ALL) params.set("session", session);
    if (direction !== ALL) params.set("direction", direction);
    if (location !== ALL) params.set("location", location);
    if (result !== ALL) params.set("result", result);
    if (marketState !== ALL) params.set("market_state", marketState);
    if (regimeLabel !== ALL) params.set("regime_label", regimeLabel);
    if (choch !== ALL) params.set("choch", choch);
    if (sweep !== ALL) params.set("sweep", sweep);
    if (fvg !== ALL) params.set("fvg_reaction", fvg);
    if (decision !== ALL) params.set("trade_decision", decision);
    if (tag !== ALL) params.set("tag", tag);
    if (strategyVersion) params.set("strategy_version", strategyVersion);
    if (scoreMin) params.set("score_min", scoreMin);
    if (scoreMax) params.set("score_max", scoreMax);
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    const value = params.toString();
    return value ? `?${value}` : "";
  }, [choch, decision, direction, endDate, fvg, location, marketState, regimeLabel, result, scoreMax, scoreMin, session, startDate, strategyVersion, sweep, tag]);

  useEffect(() => {
    api
      .screenshots(query)
      .then((data) => {
        setItems(data);
        setError(null);
      })
      .catch(() => setError("API offline"));
  }, [query]);

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-accent">Research Assets</div>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Screenshot Library</h1>
        </div>
        <SegmentedControl value={view} options={["Grid", "Timeline", "List"]} onChange={setView} />
      </section>

      {error ? <div className="rounded-lg border border-stroke bg-panel px-4 py-3 text-sm text-muted">{error}</div> : null}

      <Card>
        <CardContent className="grid gap-3 pt-5 md:grid-cols-4 xl:grid-cols-6">
          <Field label="Session">
            <Select value={session} options={withAll(SESSIONS)} onChange={(event) => setSession(event.target.value)} />
          </Field>
          <Field label="Direction">
            <Select value={direction} options={withAll(DIRECTIONS)} onChange={(event) => setDirection(event.target.value)} />
          </Field>
          <Field label="Location">
            <Select value={location} options={withAll(LOCATIONS)} onChange={(event) => setLocation(event.target.value)} />
          </Field>
          <Field label="Result">
            <Select value={result} options={withAll(RESULTS)} onChange={(event) => setResult(event.target.value)} />
          </Field>
          <Field label="Market">
            <Select value={marketState} options={withAll(MARKET_STATES)} onChange={(event) => setMarketState(event.target.value)} />
          </Field>
          <Field label="Regime">
            <Select value={regimeLabel} options={withAll(REGIME_LABELS)} onChange={(event) => setRegimeLabel(event.target.value)} />
          </Field>
          <Field label="Decision">
            <Select value={decision} options={withAll(TRADE_DECISIONS)} onChange={(event) => setDecision(event.target.value)} />
          </Field>
          <Field label="CHOCH">
            <Select value={choch} options={withAll(YES_NO)} onChange={(event) => setChoch(event.target.value)} />
          </Field>
          <Field label="Sweep">
            <Select value={sweep} options={withAll(YES_NO)} onChange={(event) => setSweep(event.target.value)} />
          </Field>
          <Field label="FVG">
            <Select value={fvg} options={withAll(FVG_REACTIONS)} onChange={(event) => setFvg(event.target.value)} />
          </Field>
          <Field label="Tag">
            <Select value={tag} options={withAll(SCREENSHOT_TAGS)} onChange={(event) => setTag(event.target.value)} />
          </Field>
          <Field label="Version">
            <Input value={strategyVersion} onChange={(event) => setStrategyVersion(event.target.value)} placeholder="Fabio_V2" />
          </Field>
          <Field label="Score">
            <div className="grid grid-cols-2 gap-2">
              <Input value={scoreMin} onChange={(event) => setScoreMin(event.target.value)} placeholder="Min" />
              <Input value={scoreMax} onChange={(event) => setScoreMax(event.target.value)} placeholder="Max" />
            </div>
          </Field>
          <Field label="Start">
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </Field>
          <Field label="End">
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-sm text-muted">
        {view === "Grid" ? <Grid3X3 className="h-4 w-4" /> : view === "Timeline" ? <Rows3 className="h-4 w-4" /> : <List className="h-4 w-4" />}
        {items.length} screenshots
      </div>

      <div className={cn(view === "Grid" && "grid gap-4 md:grid-cols-2 xl:grid-cols-3", view !== "Grid" && "grid gap-3")}>
        {items.map((item) => (
          <Card key={item.id} className={cn(view === "Timeline" && "border-l-4 border-l-accent")}>
            <a href={shotUrl(item.screenshot_path)} target="_blank" className={cn("block overflow-hidden rounded-t-lg bg-canvas", view === "List" && "hidden")}>
              <Image
                src={shotUrl(item.screenshot_path)}
                alt={`${item.date} ${item.session}`}
                width={960}
                height={540}
                unoptimized
                className="h-56 w-full object-cover"
              />
            </a>
            <CardContent className="grid gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-ink">{item.session} / {item.location}</div>
                  <div className="mt-1 text-sm text-muted">{item.date} / {item.direction} / {item.result}</div>
                </div>
                <div className="flex gap-2 text-muted">
                  {item.screenshot_favorite ? <Heart className="h-4 w-4 fill-current text-danger" /> : null}
                  {item.screenshot_bookmarked ? <Bookmark className="h-4 w-4 fill-current text-accent" /> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>{item.strategy_version || "No version"}</Badge>
                <Badge>{item.regime_label || "No regime"}</Badge>
                <Badge>{item.setup_score || "--"} score</Badge>
                <Badge>{formatR(item.result_r)}</Badge>
              </div>
              {item.screenshot_tags ? <div className="text-sm text-muted">{item.screenshot_tags}</div> : null}
              {item.lessons_learned ? <div className="text-sm text-muted">{item.lessons_learned}</div> : null}
              <div className="flex gap-3 text-sm">
                <Link className="text-accent" href={`/trades?trade=${item.trade_id}`}>Open Trade Record</Link>
                <a className="text-accent" href={shotUrl(item.screenshot_path)} target="_blank">Open Screenshot</a>
              </div>
            </CardContent>
          </Card>
        ))}
        {!items.length ? <div className="rounded-lg border border-stroke bg-panel p-10 text-center text-muted">No screenshots found</div> : null}
      </div>
    </div>
  );
}
