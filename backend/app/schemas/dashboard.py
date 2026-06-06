from pydantic import BaseModel


class MetricCard(BaseModel):
    label: str
    value: str
    detail: str | None = None


class PerformancePoint(BaseModel):
    date: str
    equity: float


class GroupPerformance(BaseModel):
    name: str
    trades: int
    win_rate: float
    expectancy: float
    result_r: float
    tp1_rate: float = 0
    sl_rate: float = 0


class DashboardResponse(BaseModel):
    total_trades: int
    win_rate: float
    tp1_rate: float
    be_rate: float
    sl_rate: float
    average_rr: float
    profit_factor: float
    expectancy: float
    max_winning_streak: int
    max_losing_streak: int
    average_mfe: float
    average_mae: float
    taken_count: int
    skipped_count: int
    watched_count: int
    invalidated_count: int
    skipped_tp1_rate: float
    skipped_sl_rate: float
    best_skipped_opportunities: list[GroupPerformance]
    worst_taken_trades: list[GroupPerformance]
    top_mistakes: list[dict]
    losses_by_mistake_type: list[dict]
    performance_curve: list[PerformancePoint]
    monthly_performance: list[GroupPerformance]
    session_performance: list[GroupPerformance]
    location_performance: list[GroupPerformance]
    poc_performance: list[GroupPerformance]
    strategy_performance: list[GroupPerformance]
    news_timing_performance: list[GroupPerformance]
    detailed_session_performance: list[GroupPerformance]
    data_quality: dict | None = None
