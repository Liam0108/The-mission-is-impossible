from fastapi import APIRouter

from app import constants

router = APIRouter()


@router.get("/meta/options")
def options() -> dict[str, tuple[str, ...]]:
    return {
        "data_type": constants.DATA_TYPES,
        "session": constants.SESSIONS,
        "direction": constants.DIRECTIONS,
        "market_state": constants.MARKET_STATES,
        "location": constants.LOCATIONS,
        "yes_no": constants.YES_NO,
        "fvg_reaction": constants.FVG_REACTIONS,
        "volume_state": constants.VOLUME_STATES,
        "result": constants.RESULTS,
        "instrument": constants.INSTRUMENTS,
        "trade_decision": constants.TRADE_DECISIONS,
        "skip_reason": constants.SKIP_REASONS,
        "poc_risk_level": constants.POC_RISK_LEVELS,
        "screenshot_tag": constants.SCREENSHOT_TAGS,
        "followed_plan": constants.FOLLOWED_PLAN_VALUES,
        "mistake_type": constants.MISTAKE_TYPES,
        "bias": constants.BIAS_VALUES,
        "news_type": constants.NEWS_TYPES,
        "news_timing": constants.NEWS_TIMINGS,
    }
