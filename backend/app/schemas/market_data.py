from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class MarketCandleRead(BaseModel):
    id: UUID
    symbol: str
    timeframe: str
    timestamp: datetime
    raw_timestamp: str | None = None
    source_row_index: int | None = None
    source_symbol: str | None = None
    source_filename: str | None = None
    open: float
    high: float
    low: float
    close: float
    volume: float

    model_config = ConfigDict(from_attributes=True)


class MissingRow(BaseModel):
    symbol: str
    timeframe: str
    timestamp: str


class MarketSwing(BaseModel):
    detected_id: str
    timestamp: str
    symbol: str
    timeframe: str
    kind: str
    label: str
    price: float
    price_level: float
    reason: str
    candles_used: list[str]
    confidence_score: int | None = None
    structure_importance_score: int | None = None
    structure_importance_reason: str | None = None
    original_csv_row_index: int | None = None
    original_timestamp: str | None = None
    parsed_timestamp: str | None = None
    candle_open: float | None = None
    candle_high: float | None = None
    candle_low: float | None = None
    candle_close: float | None = None
    swing_source_row_index: int | None = None
    swing_source_timestamp: str | None = None
    swing_source_open: float | None = None
    swing_source_high: float | None = None
    swing_source_low: float | None = None
    swing_source_close: float | None = None
    displayed_level: float | None = None
    level_source: str | None = None


class MarketSwingConfig(BaseModel):
    mode: str
    left_candles: int
    right_candles: int
    min_swing_distance: float


class MarketStructureNode(BaseModel):
    detected_id: str
    source_swing_id: str
    timestamp: str
    symbol: str
    timeframe: str
    side: str
    structure_type: str
    price: float
    structure_state: str
    leg_type: str
    protected_level_role: str | None = None
    near_reference_levels: list[str]
    later_swept: bool
    swept_by_event_id: str | None = None
    importance_score: int
    reason: str
    caused_bos: bool | None = None
    caused_choch: bool | None = None
    created_displacement: bool | None = None
    displacement_score: int | None = None
    original_csv_row_index: int | None = None
    original_timestamp: str | None = None
    parsed_timestamp: str | None = None
    candle_open: float | None = None
    candle_high: float | None = None
    candle_low: float | None = None
    candle_close: float | None = None
    displayed_level: float | None = None
    level_source: str | None = None


class MarketStructureSweep(BaseModel):
    detected_id: str
    timestamp: str
    symbol: str
    timeframe: str
    direction: str
    event_type: str
    swept_node_id: str
    swept_node_time: str
    swept_node_type: str
    swept_structure_type: str
    swept_node_price: float
    swept_node_state: str
    pierce_distance: float
    close_back_distance: float
    importance_score: int
    reason: str
    candles_used: list[str]
    original_csv_row_index: int | None = None
    original_timestamp: str | None = None
    parsed_timestamp: str | None = None
    candle_open: float | None = None
    candle_high: float | None = None
    candle_low: float | None = None
    candle_close: float | None = None
    displayed_level: float | None = None
    level_source: str | None = None


class ReferenceLabelColumn(BaseModel):
    source: str
    label_type: str


class TradingViewReferenceLabel(BaseModel):
    detected_id: str
    timestamp: str
    symbol: str
    timeframe: str
    label_type: str
    label_value: str
    price_level: float | None = None
    source_column: str
    raw_value: str
    original_csv_row_index: int | None = None
    original_timestamp: str | None = None


class LabelComparisonMatch(BaseModel):
    reference_label_id: str
    market_detection_id: str
    label_type: str
    reference_timestamp: str
    market_timestamp: str
    reference_value: str
    market_value: str
    reference_price_level: float | None = None
    market_price_level: float | None = None
    source_column: str
    market_source: str
    timestamp_difference_seconds: float
    price_difference: float | None = None
    status: str


class LabelComparisonMissed(BaseModel):
    reference_label_id: str
    timestamp: str
    label_type: str
    label_value: str
    price_level: float | None = None
    source_column: str
    status: str


class LabelComparisonExtra(BaseModel):
    market_detection_id: str
    timestamp: str
    label_type: str
    label_value: str
    price_level: float | None = None
    market_source: str
    status: str


class LabelComparisonMetrics(BaseModel):
    structure_match_rate: float
    sweep_liquidity_grab_match_rate: float
    bos_choch_match_rate: float


class LabelComparison(BaseModel):
    matches: list[LabelComparisonMatch]
    missed_tradingview_labels: list[LabelComparisonMissed]
    extra_market_lab_detections: list[LabelComparisonExtra]
    metrics: LabelComparisonMetrics


class MismatchExample(BaseModel):
    status: str
    label_type: str
    reference_timestamp: str | None = None
    market_timestamp: str | None = None
    reference_price_level: float | None = None
    market_price_level: float | None = None
    timestamp_difference_seconds: float | None = None
    price_difference: float | None = None
    source_column: str | None = None
    market_source: str | None = None
    reference_row: int | None = None
    market_row: int | None = None
    likely_cause: str
    evidence: str
    recommended_change: str
    severity_score: int


class MismatchCause(BaseModel):
    cause: str
    count: int
    evidence: str


class MismatchAnalysis(BaseModel):
    top_examples: list[MismatchExample]
    likely_causes: list[MismatchCause]
    recommended_detector_changes: list[str]


class StructureSweepConfig(BaseModel):
    min_node_importance: int
    max_age_minutes: float | None = None
    min_pierce_size: float


class LiquidityEvent(BaseModel):
    detected_id: str
    timestamp: str
    symbol: str
    timeframe: str
    session: str
    event_type: str
    source: str
    level: float
    price: float
    price_level: float
    reason: str
    candles_used: list[str]
    confidence_score: int | None = None
    original_csv_row_index: int | None = None
    original_timestamp: str | None = None
    parsed_timestamp: str | None = None
    candle_open: float | None = None
    candle_high: float | None = None
    candle_low: float | None = None
    candle_close: float | None = None
    displayed_level: float | None = None
    level_source: str | None = None
    swept_level_type: str | None = None
    swept_structure_node_id: str | None = None
    swept_structure_node: str | None = None
    swept_timeframe: str | None = None
    sweep_importance_score: int | None = None
    sweep_importance_reason: str | None = None


class FvgEvent(BaseModel):
    detected_id: str
    timestamp: str
    symbol: str
    timeframe: str
    fvg_type: str
    lower_bound: float
    upper_bound: float
    gap_size: float
    returned: bool
    price_level: float
    reason: str
    candles_used: list[str]
    confidence_score: int | None = None
    original_csv_row_index: int | None = None
    original_timestamp: str | None = None
    parsed_timestamp: str | None = None
    candle_open: float | None = None
    candle_high: float | None = None
    candle_low: float | None = None
    candle_close: float | None = None
    displayed_level: float | None = None
    level_source: str | None = None


class SetupCandidateRead(BaseModel):
    detected_id: str
    timestamp: str | datetime
    symbol: str
    timeframe: str
    direction: str
    setup_type: str
    confidence_score: int = Field(ge=0, le=100)
    reasons: list[str] | str
    price_level: float
    reason: str
    candles_used: list[str]
    original_csv_row_index: int | None = None
    original_timestamp: str | None = None
    parsed_timestamp: str | None = None
    candle_open: float | None = None
    candle_high: float | None = None
    candle_low: float | None = None
    candle_close: float | None = None
    displayed_level: float | None = None
    level_source: str | None = None


class MarketImportSummary(BaseModel):
    raw_rows: int
    valid_rows: int
    inserted_rows: int
    duplicate_rows: int
    missing_rows: int
    missing_timestamps: list[MissingRow]
    first_candle: str | None = None
    last_candle: str | None = None
    first_raw_timestamp: str | None = None
    last_raw_timestamp: str | None = None
    source_filename: str | None = None
    detected_symbol: str | None = None
    timeframe_consistent: bool
    expected_timeframe_minutes: int | None = None
    column_mapping: list[dict[str, str]] = Field(default_factory=list)
    reference_label_columns: list[ReferenceLabelColumn] = Field(default_factory=list)
    reference_labels: list[TradingViewReferenceLabel] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    ignored_columns: list[str] = Field(default_factory=list)


class FreeDataMetadata(BaseModel):
    provider: str
    requested_symbol: str
    source_symbol: str
    timeframe: str
    yahoo_interval: str
    range: str
    cached: bool
    cache_path: str
    downloaded_at: str
    last_candle: str | None = None
    delay_warning: str


class MarketLabSummary(BaseModel):
    candle_count: int
    duplicate_rows: int
    missing_rows: int
    missing_timestamps: list[MissingRow]
    first_candle: str | None = None
    last_candle: str | None = None
    first_raw_timestamp: str | None = None
    last_raw_timestamp: str | None = None
    source_filename: str | None = None
    detected_symbol: str | None = None
    timeframe_consistent: bool
    expected_timeframe_minutes: int | None = None
    session_counts: dict[str, int]
    swings: list[MarketSwing]
    swings_v2: list[MarketSwing]
    swings_v1_count: int
    swings_v2_count: int
    structure_sequence: list[MarketStructureNode]
    protected_structure: list[MarketStructureNode]
    protected_structure_count: int
    structure_sweeps: list[MarketStructureSweep]
    reference_labels: list[TradingViewReferenceLabel]
    label_comparison: LabelComparison
    mismatch_analysis: MismatchAnalysis
    structure_sweep_config: StructureSweepConfig
    swing_config: MarketSwingConfig
    liquidity_events: list[LiquidityEvent]
    fvgs: list[FvgEvent]
    setup_candidates: list[SetupCandidateRead]
    import_summary: MarketImportSummary | None = None
    free_data: FreeDataMetadata | None = None
