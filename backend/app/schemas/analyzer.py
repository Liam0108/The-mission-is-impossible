from pydantic import BaseModel, Field

from decimal import Decimal

from app.schemas.common import (
    Direction,
    FvgReaction,
    Location,
    MarketState,
    NewsTiming,
    PocRiskLevel,
    RegimeLabel,
    SessionName,
    TradeDecision,
    VolumeState,
    YesNo,
)


class AnalyzerRequest(BaseModel):
    session: SessionName
    direction: Direction
    bias_15m: str = Field(min_length=1, max_length=32)
    market_state: MarketState
    regime_label: RegimeLabel | None = None
    location: Location
    liquidity_sweep: YesNo
    choch: YesNo
    lh_hl: YesNo
    fvg_reaction: FvgReaction
    volume_state: VolumeState
    trade_decision: TradeDecision = TradeDecision.taken
    distance_to_poc: Decimal | None = Field(default=None, ge=0)
    distance_to_vah: Decimal | None = Field(default=None, ge=0)
    distance_to_val: Decimal | None = Field(default=None, ge=0)
    poc_risk_level: PocRiskLevel = PocRiskLevel.unknown
    high_impact_news: YesNo = YesNo.no
    news_timing: NewsTiming = NewsTiming.no_news
    planned_rr: float | None = Field(default=None, ge=0)


class ScoreComponent(BaseModel):
    label: str
    points: int
    reason: str


class HistoricalStats(BaseModel):
    historical_win_rate: float
    historical_tp1_rate: float
    historical_be_rate: float
    historical_sl_rate: float
    average_rr: float
    average_mfe: float
    average_mae: float
    max_losing_streak: int
    sample_size: int


class SimilarTrade(BaseModel):
    id: str
    date: str
    session: str
    direction: str
    location: str
    trade_decision: str
    result: str
    result_r: float
    mfe: float
    mae: float
    similarity_score: int


class AnalyzerResponse(BaseModel):
    setup_score: int
    trade_grade: str
    base_score: int
    historical_edge_score: int
    market_regime_score: int
    poc_risk_penalty: int
    news_risk_penalty: int
    data_confidence_adjustment: int
    score_components: list[ScoreComponent]
    historical: HistoricalStats
    tp1_probability: float
    be_probability: float
    sl_probability: float
    confidence_level: str
    sample_size: int
    most_similar_trades: list[SimilarTrade]
    poc_risk_level: str
    poc_risk_message: str
    historical_poc_sl_rate: float
    average_r: float
    best_management_rule: str | None = None
    recommended_risk_level: str
    explanation_notes: list[str]
