from fastapi import APIRouter

from app.api.routes import analytics, analyzer, dashboard, health, investment, market_data, meta, research, screenshots, sync, trades

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router, tags=["health"])
api_router.include_router(meta.router, tags=["metadata"])
api_router.include_router(trades.router, prefix="/trades", tags=["trades"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(analyzer.router, prefix="/analyzer", tags=["setup analyzer"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(screenshots.router, prefix="/screenshots", tags=["screenshots"])
api_router.include_router(research.router, prefix="/research", tags=["research"])
api_router.include_router(investment.router, prefix="/investment", tags=["investment"])
api_router.include_router(sync.router, prefix="/sync", tags=["sync"])
api_router.include_router(market_data.router, prefix="/market-data", tags=["market data"])
