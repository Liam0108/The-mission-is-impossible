from __future__ import annotations

from datetime import date as Date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import (
    BiasValue,
    ChochTimeframe,
    DataType,
    DataQuality,
    Direction,
    EntryPullbackStructure,
    FollowedPlan,
    FvgReaction,
    Instrument,
    Location,
    ManualQuality,
    MarketState,
    MistakeType,
    NewsTiming,
    NewsType,
    PocRiskLevel,
    RegimeLabel,
    Result,
    ReviewStatus,
    SessionName,
    SkipReason,
    SetupType,
    SweepTimeframe,
    TradeDecision,
    VolumeState,
    YesNo,
)


class TradeBase(BaseModel):
    user_id: str | None = Field(default=None, max_length=64)
    workspace_id: str | None = Field(default=None, max_length=64)
    date: Date
    instrument: Instrument = Instrument.nq
    data_type: DataType
    session: SessionName
    direction: Direction
    bias_15m: str = Field(min_length=1, max_length=32)
    market_state: MarketState
    regime_label: RegimeLabel | None = None
    location: Location
    liquidity_sweep: SweepTimeframe
    choch: ChochTimeframe
    lh_hl: EntryPullbackStructure
    fvg_reaction: FvgReaction
    volume_state: VolumeState
    strategy_version: str | None = Field(default=None, max_length=32)
    setup_type: SetupType | None = None
    setup_score: int | None = Field(default=None, ge=0, le=100)
    manual_quality: ManualQuality | None = None
    trade_decision: TradeDecision = TradeDecision.taken
    skip_reason: SkipReason | None = None
    entry_price: Decimal | None = Field(default=None, ge=0)
    stop_loss: Decimal | None = Field(default=None, ge=0)
    tp1_price: Decimal | None = Field(default=None, ge=0)
    tp2_price: Decimal | None = Field(default=None, ge=0)
    risk_amount: Decimal | None = Field(default=None, ge=0)
    result: Result = Result.no_trade
    result_r: Decimal | None = Decimal("0")
    mfe: Decimal = Decimal("0")
    mae: Decimal = Decimal("0")
    distance_to_poc: Decimal | None = Field(default=None, ge=0)
    distance_to_vah: Decimal | None = Field(default=None, ge=0)
    distance_to_val: Decimal | None = Field(default=None, ge=0)
    poc_risk_level: PocRiskLevel = PocRiskLevel.unknown
    similarity_group_id: str | None = Field(default=None, max_length=64)
    management_rule_notes: str | None = None
    screenshot_tags: str | None = None
    screenshot_favorite: bool = False
    screenshot_bookmarked: bool = False
    screenshot_notes: str | None = None
    lessons_learned: str | None = None
    followed_plan: FollowedPlan = FollowedPlan.yes
    mistake_type: MistakeType = MistakeType.none
    discipline_score: int | None = Field(default=None, ge=1, le=10)
    execution_score: int | None = Field(default=None, ge=1, le=10)
    emotion_score: int | None = Field(default=None, ge=1, le=10)
    review_notes: str | None = None
    daily_bias: BiasValue = BiasValue.neutral
    weekly_bias: BiasValue = BiasValue.neutral
    monthly_bias: BiasValue = BiasValue.neutral
    high_impact_news: YesNo = YesNo.no
    news_type: NewsType | None = None
    news_timing: NewsTiming = NewsTiming.no_news
    notes: str | None = None
    screenshot_path: str | None = None
    data_quality: DataQuality = DataQuality.incomplete
    account: str | None = Field(default=None, max_length=64)
    broker_symbol: str | None = Field(default=None, max_length=32)
    buy_price: Decimal | None = Field(default=None, ge=0)
    sell_price: Decimal | None = Field(default=None, ge=0)
    bought_time: datetime | None = None
    sold_time: datetime | None = None
    quantity: Decimal | None = Field(default=None, ge=0)
    entry_time: datetime | None = None
    exit_time: datetime | None = None
    exit_price: Decimal | None = Field(default=None, ge=0)
    gross_pnl: Decimal | None = None
    commission: Decimal | None = None
    net_pnl: Decimal | None = None
    broker_trade_id: str | None = Field(default=None, max_length=64)
    import_source: str | None = Field(default=None, max_length=32)
    holding_time_minutes: Decimal | None = Field(default=None, ge=0)
    holding_time_text: str | None = Field(default=None, max_length=64)
    imported: bool = False
    review_status: ReviewStatus = ReviewStatus.reviewed


class TradeCreate(TradeBase):
    pass


class TradeUpdate(BaseModel):
    user_id: str | None = Field(default=None, max_length=64)
    workspace_id: str | None = Field(default=None, max_length=64)
    date: Date | None = None
    instrument: Instrument | None = None
    data_type: DataType | None = None
    session: SessionName | None = None
    direction: Direction | None = None
    bias_15m: str | None = Field(default=None, min_length=1, max_length=32)
    market_state: MarketState | None = None
    regime_label: RegimeLabel | None = None
    location: Location | None = None
    liquidity_sweep: SweepTimeframe | None = None
    choch: ChochTimeframe | None = None
    lh_hl: EntryPullbackStructure | None = None
    fvg_reaction: FvgReaction | None = None
    volume_state: VolumeState | None = None
    strategy_version: str | None = Field(default=None, max_length=32)
    setup_type: SetupType | None = None
    setup_score: int | None = Field(default=None, ge=0, le=100)
    manual_quality: ManualQuality | None = None
    trade_decision: TradeDecision | None = None
    skip_reason: SkipReason | None = None
    entry_price: Decimal | None = Field(default=None, ge=0)
    stop_loss: Decimal | None = Field(default=None, ge=0)
    tp1_price: Decimal | None = Field(default=None, ge=0)
    tp2_price: Decimal | None = Field(default=None, ge=0)
    risk_amount: Decimal | None = Field(default=None, ge=0)
    result: Result | None = None
    result_r: Decimal | None = None
    mfe: Decimal | None = None
    mae: Decimal | None = None
    distance_to_poc: Decimal | None = Field(default=None, ge=0)
    distance_to_vah: Decimal | None = Field(default=None, ge=0)
    distance_to_val: Decimal | None = Field(default=None, ge=0)
    poc_risk_level: PocRiskLevel | None = None
    similarity_group_id: str | None = Field(default=None, max_length=64)
    management_rule_notes: str | None = None
    screenshot_tags: str | None = None
    screenshot_favorite: bool | None = None
    screenshot_bookmarked: bool | None = None
    screenshot_notes: str | None = None
    lessons_learned: str | None = None
    followed_plan: FollowedPlan | None = None
    mistake_type: MistakeType | None = None
    discipline_score: int | None = Field(default=None, ge=1, le=10)
    execution_score: int | None = Field(default=None, ge=1, le=10)
    emotion_score: int | None = Field(default=None, ge=1, le=10)
    review_notes: str | None = None
    daily_bias: BiasValue | None = None
    weekly_bias: BiasValue | None = None
    monthly_bias: BiasValue | None = None
    high_impact_news: YesNo | None = None
    news_type: NewsType | None = None
    news_timing: NewsTiming | None = None
    notes: str | None = None
    screenshot_path: str | None = None
    data_quality: DataQuality | None = None
    account: str | None = Field(default=None, max_length=64)
    broker_symbol: str | None = Field(default=None, max_length=32)
    buy_price: Decimal | None = Field(default=None, ge=0)
    sell_price: Decimal | None = Field(default=None, ge=0)
    bought_time: datetime | None = None
    sold_time: datetime | None = None
    quantity: Decimal | None = Field(default=None, ge=0)
    entry_time: datetime | None = None
    exit_time: datetime | None = None
    exit_price: Decimal | None = Field(default=None, ge=0)
    gross_pnl: Decimal | None = None
    commission: Decimal | None = None
    net_pnl: Decimal | None = None
    broker_trade_id: str | None = Field(default=None, max_length=64)
    import_source: str | None = Field(default=None, max_length=32)
    holding_time_minutes: Decimal | None = Field(default=None, ge=0)
    holding_time_text: str | None = Field(default=None, max_length=64)
    imported: bool | None = None
    review_status: ReviewStatus | None = None


class TradeRead(TradeBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TradeFilters(BaseModel):
    session: SessionName | None = None
    location: Location | None = None
    direction: Direction | None = None
    market_state: MarketState | None = None
    regime_label: RegimeLabel | None = None
    data_type: DataType | None = None
    result: Result | None = None
    trade_decision: TradeDecision | None = None
    strategy_version: str | None = None
    setup_type: SetupType | None = None
    start_date: Date | None = None
    end_date: Date | None = None
