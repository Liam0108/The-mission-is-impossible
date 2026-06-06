import type {
  RecommendationConfidence,
  RiskLabel,
  ScenarioDecisionLabel,
  StockAnalysis
} from "@/lib/investment-engine";

export type PortfolioMode = "Conservative" | "Balanced" | "Growth" | "High Conviction";

export type PortfolioBuilderSettings = {
  mode: PortfolioMode;
  totalInvestmentAmount: number;
  cashReservePct: number;
  maxSingleStockPct: number;
  maxSectorPct: number;
  maxHighRiskPct: number;
  maxSpeculativePct: number;
  preferredHoldings: number;
  allowHighRiskStocks: boolean;
};

export type PortfolioAllocation = {
  ticker: string;
  company: string;
  sector: string;
  allocationPct: number;
  dollarAmount: number;
  priorityScore: number;
  reason: string;
  limitedBy: string[];
  biggestRisk: string;
  valuationConcern: string;
  riskLabel: RiskLabel;
  scenarioLabel: ScenarioDecisionLabel;
  recommendationConfidence: RecommendationConfidence;
  realDataPercent: number;
};

export type ExcludedPortfolioCandidate = {
  ticker: string;
  company: string;
  sector: string;
  reasons: string[];
  priorityScore: number | null;
};

export type PortfolioRiskSummary = {
  totalInvestment: number;
  totalInvested: number;
  cashKept: number;
  cashPct: number;
  holdingsCount: number;
  largestPosition: PortfolioAllocation | null;
  largestSector: { sector: string; allocationPct: number } | null;
  highRiskExposurePct: number;
  speculativeExposurePct: number;
  sectorAllocations: Array<{ sector: string; allocationPct: number }>;
  warnings: string[];
};

export type PortfolioBuilderResult = {
  allocations: PortfolioAllocation[];
  excluded: ExcludedPortfolioCandidate[];
  summary: PortfolioRiskSummary;
  eligibleCount: number;
};

export type SavedPortfolioPlan = {
  id: string;
  name: string;
  createdAt: string;
  notes: string;
  settings: PortfolioBuilderSettings;
  allocations: PortfolioAllocation[];
  excluded: ExcludedPortfolioCandidate[];
  summary: PortfolioRiskSummary;
};

export const PORTFOLIO_BUILDER_SETTINGS_KEY = "fabio-investment-portfolio-builder-settings-v1";
export const PORTFOLIO_PLANS_KEY = "fabio-investment-portfolio-plans-v1";
export const PORTFOLIO_MODES: PortfolioMode[] = ["Conservative", "Balanced", "Growth", "High Conviction"];

const MODE_DEFAULTS: Record<PortfolioMode, Omit<PortfolioBuilderSettings, "mode" | "totalInvestmentAmount">> = {
  Conservative: {
    cashReservePct: 20,
    maxSingleStockPct: 10,
    maxSectorPct: 25,
    maxHighRiskPct: 10,
    maxSpeculativePct: 0,
    preferredHoldings: 12,
    allowHighRiskStocks: false
  },
  Balanced: {
    cashReservePct: 15,
    maxSingleStockPct: 15,
    maxSectorPct: 35,
    maxHighRiskPct: 25,
    maxSpeculativePct: 5,
    preferredHoldings: 10,
    allowHighRiskStocks: false
  },
  Growth: {
    cashReservePct: 10,
    maxSingleStockPct: 15,
    maxSectorPct: 40,
    maxHighRiskPct: 30,
    maxSpeculativePct: 5,
    preferredHoldings: 10,
    allowHighRiskStocks: true
  },
  "High Conviction": {
    cashReservePct: 10,
    maxSingleStockPct: 20,
    maxSectorPct: 40,
    maxHighRiskPct: 30,
    maxSpeculativePct: 5,
    preferredHoldings: 6,
    allowHighRiskStocks: true
  }
};

type RankedCandidate = {
  analysis: StockAnalysis;
  priorityScore: number;
};

const EPSILON = 0.001;

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function rounded(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

export function portfolioModeSettings(
  mode: PortfolioMode,
  totalInvestmentAmount = 100_000
): PortfolioBuilderSettings {
  return {
    mode,
    totalInvestmentAmount,
    ...MODE_DEFAULTS[mode]
  };
}

export function defaultPortfolioBuilderSettings(): PortfolioBuilderSettings {
  return portfolioModeSettings("Balanced");
}

export function normalizePortfolioBuilderSettings(
  value: Partial<PortfolioBuilderSettings> | null | undefined
): PortfolioBuilderSettings {
  const mode = PORTFOLIO_MODES.includes(value?.mode as PortfolioMode)
    ? value?.mode as PortfolioMode
    : "Balanced";
  const defaults = portfolioModeSettings(mode);
  return {
    mode,
    totalInvestmentAmount: clamp(Number(value?.totalInvestmentAmount ?? defaults.totalInvestmentAmount), 0, 1_000_000_000),
    cashReservePct: clamp(Number(value?.cashReservePct ?? defaults.cashReservePct), 0, 80),
    maxSingleStockPct: clamp(Number(value?.maxSingleStockPct ?? defaults.maxSingleStockPct), 1, 50),
    maxSectorPct: clamp(Number(value?.maxSectorPct ?? defaults.maxSectorPct), 5, 100),
    maxHighRiskPct: clamp(Number(value?.maxHighRiskPct ?? defaults.maxHighRiskPct), 0, 100),
    maxSpeculativePct: clamp(Number(value?.maxSpeculativePct ?? defaults.maxSpeculativePct), 0, 50),
    preferredHoldings: Math.round(clamp(Number(value?.preferredHoldings ?? defaults.preferredHoldings), 1, 50)),
    allowHighRiskStocks: Boolean(value?.allowHighRiskStocks ?? defaults.allowHighRiskStocks)
  };
}

function metricScore(value: number | null, min: number, max: number) {
  if (value === null || !Number.isFinite(value)) return 0;
  return clamp(((value - min) / (max - min)) * 100, 0, 100);
}

function candidatePriority(analysis: StockAnalysis, mode: PortfolioMode) {
  const scenario = analysis.valuation.scenarioValuation;
  const upside = metricScore(scenario.weightedUpsideDownsidePct, -10, 35);
  const riskReward = metricScore(scenario.riskRewardRatio, 0, 3);
  const reliability = clamp((analysis.realDataPercent + analysis.dataReliabilityScore) / 2, 0, 100);
  const weights = mode === "Conservative"
    ? { quality: 0.35, valuation: 0.15, upside: 0.1, riskReward: 0.05, reliability: 0.15, risk: 0.2 }
    : mode === "Growth"
      ? { quality: 0.25, valuation: 0.15, upside: 0.3, riskReward: 0.15, reliability: 0.1, risk: 0.05 }
      : mode === "High Conviction"
        ? { quality: 0.3, valuation: 0.2, upside: 0.25, riskReward: 0.15, reliability: 0.1, risk: 0 }
        : { quality: 0.3, valuation: 0.2, upside: 0.2, riskReward: 0.15, reliability: 0.1, risk: 0.05 };
  return rounded(
    analysis.breakdown.quality * weights.quality
    + analysis.breakdown.valuation * weights.valuation
    + upside * weights.upside
    + riskReward * weights.riskReward
    + reliability * weights.reliability
    + analysis.breakdown.risk * weights.risk
  );
}

function hardExclusionReasons(analysis: StockAnalysis, settings: PortfolioBuilderSettings) {
  const scenario = analysis.valuation.scenarioValuation;
  const reasons: string[] = [];
  if (scenario.decisionLabel === "Insufficient Scenario Data") reasons.push("insufficient data");
  if (!analysis.scoreReliable || analysis.realDataPercent < 60 || analysis.dataReliabilityScore < 60) {
    reasons.push("insufficient data reliability");
  }
  if (analysis.recommendation === "Insufficient Data") reasons.push("insufficient data");
  if (analysis.recommendation === "Avoid") reasons.push("negative recommendation");
  if (analysis.recommendation === "Wait for Better Price") reasons.push("too expensive");
  if (
    scenario.weightedUpsideDownsidePct === null
    || !Number.isFinite(scenario.weightedUpsideDownsidePct)
    || scenario.weightedUpsideDownsidePct <= 0
  ) {
    reasons.push("no positive weighted scenario upside");
  }
  if (scenario.riskRewardLabel === "Poor Risk/Reward") reasons.push("poor risk/reward");
  if (
    scenario.decisionLabel === "Speculative Premium"
    || scenario.riskRewardLabel === "Speculative Premium"
  ) {
    if (!settings.allowHighRiskStocks) reasons.push("speculative premium");
  }
  if (
    !settings.allowHighRiskStocks
    && (analysis.riskLabel === "High Risk" || analysis.riskLabel === "Speculative")
  ) {
    reasons.push("high-risk stocks are disabled");
  }
  return [...new Set(reasons)];
}

function isHighRisk(riskLabel: RiskLabel) {
  return riskLabel === "High Risk" || riskLabel === "Speculative";
}

function allocateCandidateSet(
  candidates: RankedCandidate[],
  settings: PortfolioBuilderSettings
) {
  const targetPct = 100 - settings.cashReservePct;
  const allocations = new Map<string, number>(candidates.map(({ analysis }) => [analysis.stock.ticker, 0]));
  const sectorAllocations = new Map<string, number>();
  let highRiskPct = 0;
  let speculativePct = 0;
  let remaining = targetPct;
  let active = [...candidates];

  // Repeated weighted passes redistribute capacity released by stock, sector, and risk caps.
  for (let pass = 0; pass < 100 && remaining > EPSILON && active.length; pass += 1) {
    const totalWeight = active.reduce((sum, candidate) => sum + Math.max(1, candidate.priorityScore), 0);
    let addedThisPass = 0;
    const nextActive: RankedCandidate[] = [];
    for (const candidate of active) {
      const analysis = candidate.analysis;
      const ticker = analysis.stock.ticker;
      const current = allocations.get(ticker) ?? 0;
      const sectorCurrent = sectorAllocations.get(analysis.stock.sector) ?? 0;
      const stockCapacity = settings.maxSingleStockPct - current;
      const sectorCapacity = settings.maxSectorPct - sectorCurrent;
      const highRiskCapacity = isHighRisk(analysis.riskLabel)
        ? settings.maxHighRiskPct - highRiskPct
        : Number.POSITIVE_INFINITY;
      const speculativeCapacity = analysis.riskLabel === "Speculative"
        ? settings.maxSpeculativePct - speculativePct
        : Number.POSITIVE_INFINITY;
      const capacity = Math.max(0, Math.min(stockCapacity, sectorCapacity, highRiskCapacity, speculativeCapacity));
      if (capacity <= EPSILON) continue;
      const weightedShare = remaining * (Math.max(1, candidate.priorityScore) / totalWeight);
      const addition = Math.min(capacity, weightedShare);
      if (addition <= EPSILON) continue;
      allocations.set(ticker, current + addition);
      sectorAllocations.set(analysis.stock.sector, sectorCurrent + addition);
      if (isHighRisk(analysis.riskLabel)) highRiskPct += addition;
      if (analysis.riskLabel === "Speculative") speculativePct += addition;
      addedThisPass += addition;
      if (capacity - addition > EPSILON) nextActive.push(candidate);
    }
    remaining -= addedThisPass;
    if (addedThisPass <= EPSILON) break;
    active = nextActive;
  }

  return { allocations, remaining, sectorAllocations, highRiskPct, speculativePct };
}

function inclusionReason(analysis: StockAnalysis) {
  const scenario = analysis.valuation.scenarioValuation;
  const reasons = [
    analysis.breakdown.quality >= 75 ? "strong company quality" : "",
    analysis.breakdown.valuation >= 65 ? "reasonable valuation" : "",
    (scenario.weightedUpsideDownsidePct ?? 0) > 10 ? "positive weighted scenario upside" : "",
    scenario.riskRewardLabel === "Attractive Risk/Reward" ? "attractive scenario risk/reward" : "",
    analysis.realDataPercent >= 80 ? "high real-data coverage" : ""
  ].filter(Boolean);
  return reasons.length ? reasons.slice(0, 3).join(" + ") : "highest eligible research priority";
}

function valuationConcern(analysis: StockAnalysis) {
  const scenario = analysis.valuation.scenarioValuation;
  if (scenario.decisionLabel === "Requires Bull Case") return "Current price requires optimistic assumptions.";
  if (analysis.valuation.valuationAgreement === "Disagree") return "DCF and relative valuation disagree.";
  if (analysis.valuationRisk === "High") return "Current valuation carries elevated downside risk.";
  if (scenario.weightedUpsideDownsidePct !== null && scenario.weightedUpsideDownsidePct < 10) {
    return "Weighted upside is positive but limited.";
  }
  return "No major valuation warning under current assumptions.";
}

export function buildResearchPortfolio(
  analyses: StockAnalysis[],
  rawSettings: PortfolioBuilderSettings
): PortfolioBuilderResult {
  const settings = normalizePortfolioBuilderSettings(rawSettings);
  const hardExcluded: ExcludedPortfolioCandidate[] = [];
  const eligible: RankedCandidate[] = [];

  for (const analysis of analyses) {
    const reasons = hardExclusionReasons(analysis, settings);
    if (reasons.length) {
      hardExcluded.push({
        ticker: analysis.stock.ticker,
        company: analysis.stock.company_name,
        sector: analysis.stock.sector,
        reasons,
        priorityScore: null
      });
      continue;
    }
    eligible.push({ analysis, priorityScore: candidatePriority(analysis, settings.mode) });
  }
  eligible.sort((left, right) =>
    right.priorityScore - left.priorityScore
    || right.analysis.realDataPercent - left.analysis.realDataPercent
    || left.analysis.stock.ticker.localeCompare(right.analysis.stock.ticker)
  );

  let selectedCount = Math.min(settings.preferredHoldings, eligible.length);
  let selected = eligible.slice(0, selectedCount);
  let allocationState = allocateCandidateSet(selected, settings);
  while (allocationState.remaining > EPSILON && selectedCount < eligible.length) {
    selectedCount += 1;
    selected = eligible.slice(0, selectedCount);
    allocationState = allocateCandidateSet(selected, settings);
  }

  const sectorTotals = allocationState.sectorAllocations;
  const totalInvestment = settings.totalInvestmentAmount;
  const allocations = selected
    .map(({ analysis, priorityScore }) => {
      const allocationPct = allocationState.allocations.get(analysis.stock.ticker) ?? 0;
      if (allocationPct <= EPSILON) return null;
      const limitedBy: string[] = [];
      if (settings.maxSingleStockPct - allocationPct <= 0.05) limitedBy.push("single-stock cap");
      if (settings.maxSectorPct - (sectorTotals.get(analysis.stock.sector) ?? 0) <= 0.05) limitedBy.push("sector cap");
      if (isHighRisk(analysis.riskLabel) && settings.maxHighRiskPct - allocationState.highRiskPct <= 0.05) limitedBy.push("high-risk cap");
      if (analysis.riskLabel === "Speculative" && settings.maxSpeculativePct - allocationState.speculativePct <= 0.05) {
        limitedBy.push("speculative cap");
      }
      return {
        ticker: analysis.stock.ticker,
        company: analysis.stock.company_name,
        sector: analysis.stock.sector,
        allocationPct: rounded(allocationPct),
        dollarAmount: rounded(totalInvestment * allocationPct / 100),
        priorityScore,
        reason: inclusionReason(analysis),
        limitedBy,
        biggestRisk: analysis.biggestRisk,
        valuationConcern: valuationConcern(analysis),
        riskLabel: analysis.riskLabel,
        scenarioLabel: analysis.valuation.scenarioValuation.decisionLabel,
        recommendationConfidence: analysis.recommendationConfidence,
        realDataPercent: analysis.realDataPercent
      } satisfies PortfolioAllocation;
    })
    .filter((allocation): allocation is PortfolioAllocation => allocation !== null)
    .sort((left, right) => right.allocationPct - left.allocationPct || right.priorityScore - left.priorityScore);

  const selectedTickers = new Set(allocations.map((allocation) => allocation.ticker));
  const capacityExcluded = eligible
    .filter(({ analysis }) => !selectedTickers.has(analysis.stock.ticker))
    .map(({ analysis, priorityScore }) => {
      const reasons: string[] = [];
      if ((sectorTotals.get(analysis.stock.sector) ?? 0) >= settings.maxSectorPct - EPSILON) reasons.push("sector cap exceeded");
      if (isHighRisk(analysis.riskLabel) && allocationState.highRiskPct >= settings.maxHighRiskPct - EPSILON) reasons.push("high-risk cap exceeded");
      if (analysis.riskLabel === "Speculative" && allocationState.speculativePct >= settings.maxSpeculativePct - EPSILON) {
        reasons.push("speculative cap exceeded");
      }
      if (!reasons.length) reasons.push("preferred holding count filled by higher-priority candidates");
      return {
        ticker: analysis.stock.ticker,
        company: analysis.stock.company_name,
        sector: analysis.stock.sector,
        reasons,
        priorityScore
      } satisfies ExcludedPortfolioCandidate;
    });

  const investedPct = allocations.reduce((sum, allocation) => sum + allocation.allocationPct, 0);
  const cashPct = clamp(100 - investedPct, 0, 100);
  const sectorAllocations = [...sectorTotals.entries()]
    .map(([sector, allocationPct]) => ({ sector, allocationPct: rounded(allocationPct) }))
    .filter((row) => row.allocationPct > EPSILON)
    .sort((left, right) => right.allocationPct - left.allocationPct);
  const largestPosition = allocations[0] ?? null;
  const largestSector = sectorAllocations[0] ?? null;
  const warnings = [
    cashPct > settings.cashReservePct + 0.1
      ? `Constraints left ${rounded(cashPct - settings.cashReservePct)}% more cash than the target.`
      : "",
    allocations.length < Math.min(settings.preferredHoldings, eligible.length)
      ? `Only ${allocations.length} eligible holdings could receive an allocation.`
      : "",
    largestPosition && largestPosition.allocationPct > settings.maxSingleStockPct + 0.05
      ? `${largestPosition.ticker} exceeds the single-stock cap.`
      : "",
    largestSector && largestSector.allocationPct > settings.maxSectorPct + 0.05
      ? `${largestSector.sector} exceeds the sector cap.`
      : "",
    allocationState.highRiskPct > settings.maxHighRiskPct + 0.05 ? "High-risk exposure exceeds its cap." : "",
    allocationState.speculativePct > settings.maxSpeculativePct + 0.05 ? "Speculative exposure exceeds its cap." : ""
  ].filter(Boolean);

  return {
    allocations,
    excluded: [...hardExcluded, ...capacityExcluded],
    eligibleCount: eligible.length,
    summary: {
      totalInvestment,
      totalInvested: rounded(totalInvestment * investedPct / 100),
      cashKept: rounded(totalInvestment * cashPct / 100),
      cashPct: rounded(cashPct),
      holdingsCount: allocations.length,
      largestPosition,
      largestSector,
      highRiskExposurePct: rounded(allocationState.highRiskPct),
      speculativeExposurePct: rounded(allocationState.speculativePct),
      sectorAllocations,
      warnings
    }
  };
}
