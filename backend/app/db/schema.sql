CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(64),
    workspace_id VARCHAR(64),
    date DATE NOT NULL,
    instrument VARCHAR(12) NOT NULL CHECK (instrument IN ('NQ', 'MNQ', 'ES', 'MES', 'GC')),
    data_type VARCHAR(16) NOT NULL CHECK (data_type IN ('Backtest', 'Replay', 'Paper', 'Live')),
    session VARCHAR(16) NOT NULL CHECK (session IN ('Asian', 'London', 'NY_AM', 'NY_PM', 'NY_Open', 'NY_Power_Hour', 'NY_Lunch', 'Asian_Early', 'Asian_Late', 'London_Open', 'London_Mid')),
    direction VARCHAR(8) NOT NULL CHECK (direction IN ('Long', 'Short')),
    bias_15m VARCHAR(32) NOT NULL,
    market_state VARCHAR(16) NOT NULL CHECK (market_state IN ('Balanced', 'Imbalanced')),
    regime_label VARCHAR(24) CHECK (regime_label IS NULL OR regime_label IN ('Trend Up', 'Trend Down', 'Balanced', 'Expansion', 'Choppy', 'News Driven', 'POC Chop')),
    location VARCHAR(16) NOT NULL CHECK (location IN ('VAH', 'VAL', 'POC', 'PDH', 'PDL', 'EQH', 'EQL', 'Other')),
    liquidity_sweep VARCHAR(24) NOT NULL CHECK (liquidity_sweep IN ('None', '1m', '5m', '15m', 'PDH/PDL', 'Session High/Low', 'Yes', 'No')),
    choch VARCHAR(8) NOT NULL CHECK (choch IN ('None', '1m', '5m', '15m', 'Yes', 'No')),
    lh_hl VARCHAR(16) NOT NULL CHECK (lh_hl IN ('None', 'HL for Long', 'LH for Short', 'Failed HL', 'Failed LH', 'Yes', 'No')),
    fvg_reaction VARCHAR(8) NOT NULL CHECK (fvg_reaction IN ('Strong', 'Medium', 'Weak', 'None')),
    volume_state VARCHAR(8) NOT NULL CHECK (volume_state IN ('Low', 'Normal', 'High')),
    strategy_version VARCHAR(32),
    setup_type VARCHAR(32) CHECK (setup_type IS NULL OR setup_type IN ('Fabio Long', 'Fabio Short', 'Sweep Reversal Long', 'Sweep Reversal Short', 'Direct Delivery Long', 'Direct Delivery Short', 'POC Rejection', 'Breakout Continuation', 'News Trade', 'Other')),
    setup_score INTEGER CHECK (setup_score IS NULL OR setup_score BETWEEN 0 AND 100),
    manual_quality VARCHAR(8) CHECK (manual_quality IS NULL OR manual_quality IN ('A+', 'A', 'B', 'C', 'Skip')),
    trade_decision VARCHAR(16) NOT NULL DEFAULT 'Taken' CHECK (trade_decision IN ('Taken', 'Skipped', 'Watched', 'Invalidated')),
    skip_reason VARCHAR(32) CHECK (skip_reason IS NULL OR skip_reason IN ('Near POC', 'Weak CHOCH', 'No Clear FVG', 'Poor RR', 'Against 15m Bias', 'News Risk', 'Too Late', 'Too Early', 'Emotional Reason', 'Other')),
    entry_price NUMERIC(14, 2),
    stop_loss NUMERIC(14, 2),
    tp1_price NUMERIC(14, 2),
    tp2_price NUMERIC(14, 2),
    risk_amount NUMERIC(14, 2),
    result VARCHAR(8) NOT NULL CHECK (result IN ('TP1', 'BE', 'SL', 'NoTrade', 'Unknown')),
    result_r NUMERIC(10, 2) DEFAULT 0,
    mfe NUMERIC(10, 2) NOT NULL DEFAULT 0,
    mae NUMERIC(10, 2) NOT NULL DEFAULT 0,
    distance_to_poc NUMERIC(10, 2),
    distance_to_vah NUMERIC(10, 2),
    distance_to_val NUMERIC(10, 2),
    poc_risk_level VARCHAR(8) NOT NULL DEFAULT 'Unknown' CHECK (poc_risk_level IN ('Low', 'Medium', 'High', 'Unknown')),
    similarity_group_id VARCHAR(64),
    management_rule_notes TEXT,
    screenshot_tags TEXT,
    screenshot_favorite BOOLEAN NOT NULL DEFAULT false,
    screenshot_bookmarked BOOLEAN NOT NULL DEFAULT false,
    screenshot_notes TEXT,
    lessons_learned TEXT,
    followed_plan VARCHAR(16) NOT NULL DEFAULT 'Yes' CHECK (followed_plan IN ('Yes', 'Partially', 'No')),
    mistake_type VARCHAR(32) NOT NULL DEFAULT 'None' CHECK (mistake_type IN ('None', 'Early Entry', 'Late Entry', 'FOMO', 'No Stop', 'Moved Stop', 'Ignored Bias', 'Ignored Risk', 'Overtrading', 'Revenge Trading', 'Emotional Trade', 'Other')),
    discipline_score INTEGER CHECK (discipline_score IS NULL OR discipline_score BETWEEN 1 AND 10),
    execution_score INTEGER CHECK (execution_score IS NULL OR execution_score BETWEEN 1 AND 10),
    emotion_score INTEGER CHECK (emotion_score IS NULL OR emotion_score BETWEEN 1 AND 10),
    review_notes TEXT,
    daily_bias VARCHAR(8) NOT NULL DEFAULT 'Neutral' CHECK (daily_bias IN ('Bullish', 'Bearish', 'Neutral')),
    weekly_bias VARCHAR(8) NOT NULL DEFAULT 'Neutral' CHECK (weekly_bias IN ('Bullish', 'Bearish', 'Neutral')),
    monthly_bias VARCHAR(8) NOT NULL DEFAULT 'Neutral' CHECK (monthly_bias IN ('Bullish', 'Bearish', 'Neutral')),
    high_impact_news VARCHAR(3) NOT NULL DEFAULT 'No' CHECK (high_impact_news IN ('Yes', 'No')),
    news_type VARCHAR(24) CHECK (news_type IS NULL OR news_type IN ('CPI', 'FOMC', 'NFP', 'PCE', 'GDP', 'Retail Sales', 'Jobless Claims', 'Other')),
    news_timing VARCHAR(16) NOT NULL DEFAULT 'No News' CHECK (news_timing IN ('Before News', 'During News', 'After News', 'No News')),
    notes TEXT,
    screenshot_path TEXT,
    data_quality VARCHAR(16) NOT NULL DEFAULT 'incomplete' CHECK (data_quality IN ('good', 'incomplete', 'bad')),
    account VARCHAR(64),
    broker_symbol VARCHAR(32),
    buy_price NUMERIC(14, 2),
    sell_price NUMERIC(14, 2),
    bought_time TIMESTAMPTZ,
    sold_time TIMESTAMPTZ,
    quantity NUMERIC(14, 2),
    entry_time TIMESTAMPTZ,
    exit_time TIMESTAMPTZ,
    exit_price NUMERIC(14, 2),
    gross_pnl NUMERIC(14, 2),
    commission NUMERIC(14, 2),
    net_pnl NUMERIC(14, 2),
    broker_trade_id VARCHAR(64),
    import_source VARCHAR(32),
    holding_time_minutes NUMERIC(14, 2),
    holding_time_text VARCHAR(64),
    imported BOOLEAN NOT NULL DEFAULT false,
    review_status VARCHAR(16) NOT NULL DEFAULT 'reviewed' CHECK (review_status IN ('unreviewed', 'reviewed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_trades_date ON trades (date);
CREATE INDEX IF NOT EXISTS ix_trades_session ON trades (session);
CREATE INDEX IF NOT EXISTS ix_trades_location ON trades (location);
CREATE INDEX IF NOT EXISTS ix_trades_result ON trades (result);
CREATE INDEX IF NOT EXISTS ix_trades_user_id ON trades (user_id);
CREATE INDEX IF NOT EXISTS ix_trades_workspace_id ON trades (workspace_id);
CREATE INDEX IF NOT EXISTS ix_trades_trade_decision ON trades (trade_decision);
CREATE INDEX IF NOT EXISTS ix_trades_poc_risk_level ON trades (poc_risk_level);
CREATE INDEX IF NOT EXISTS ix_trades_similarity_group_id ON trades (similarity_group_id);
CREATE INDEX IF NOT EXISTS ix_trades_strategy_version ON trades (strategy_version);
CREATE INDEX IF NOT EXISTS ix_trades_setup_type ON trades (setup_type);
CREATE INDEX IF NOT EXISTS ix_trades_mistake_type ON trades (mistake_type);
CREATE INDEX IF NOT EXISTS ix_trades_news_timing ON trades (news_timing);
CREATE INDEX IF NOT EXISTS ix_trades_daily_bias ON trades (daily_bias);
CREATE INDEX IF NOT EXISTS ix_trades_regime_label ON trades (regime_label);
CREATE INDEX IF NOT EXISTS ix_trades_data_quality ON trades (data_quality);
CREATE INDEX IF NOT EXISTS ix_trades_account ON trades (account);
CREATE INDEX IF NOT EXISTS ix_trades_entry_time ON trades (entry_time);
CREATE INDEX IF NOT EXISTS ix_trades_broker_trade_id ON trades (broker_trade_id);
CREATE INDEX IF NOT EXISTS ix_trades_imported ON trades (imported);
CREATE INDEX IF NOT EXISTS ix_trades_review_status ON trades (review_status);
CREATE INDEX IF NOT EXISTS ix_trades_valid_taken
    ON trades (trade_decision, data_quality, date)
    WHERE trade_decision = 'Taken' AND data_quality = 'good';
CREATE INDEX IF NOT EXISTS ix_trades_setup_similarity
    ON trades (session, direction, bias_15m, market_state, location, liquidity_sweep, choch, lh_hl, fvg_reaction, volume_state, trade_decision);

CREATE TABLE IF NOT EXISTS market_candles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(12) NOT NULL,
    timeframe VARCHAR(4) NOT NULL CHECK (timeframe IN ('1m', '5m')),
    timestamp TIMESTAMPTZ NOT NULL,
    raw_timestamp TEXT,
    source_row_index INTEGER,
    source_symbol VARCHAR(32),
    source_filename TEXT,
    open NUMERIC(14, 4) NOT NULL,
    high NUMERIC(14, 4) NOT NULL,
    low NUMERIC(14, 4) NOT NULL,
    close NUMERIC(14, 4) NOT NULL,
    volume NUMERIC(20, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_market_candles_symbol_timeframe_timestamp UNIQUE (symbol, timeframe, timestamp)
);

CREATE INDEX IF NOT EXISTS ix_market_candles_symbol ON market_candles (symbol);
CREATE INDEX IF NOT EXISTS ix_market_candles_timeframe ON market_candles (timeframe);
CREATE INDEX IF NOT EXISTS ix_market_candles_timestamp ON market_candles (timestamp);
CREATE INDEX IF NOT EXISTS ix_market_candles_lookup ON market_candles (symbol, timeframe, timestamp);

CREATE TABLE IF NOT EXISTS setup_candidate_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(12) NOT NULL,
    timeframe VARCHAR(4) NOT NULL CHECK (timeframe IN ('1m', '5m')),
    direction VARCHAR(8) NOT NULL CHECK (direction IN ('Long', 'Short')),
    setup_type VARCHAR(32) NOT NULL,
    confidence_score INTEGER NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
    reasons TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_setup_candidate_logs_identity UNIQUE (symbol, timeframe, timestamp, setup_type, direction)
);

CREATE INDEX IF NOT EXISTS ix_setup_candidate_logs_timestamp ON setup_candidate_logs (timestamp);
CREATE INDEX IF NOT EXISTS ix_setup_candidate_logs_symbol ON setup_candidate_logs (symbol);
CREATE INDEX IF NOT EXISTS ix_setup_candidate_logs_timeframe ON setup_candidate_logs (timeframe);
CREATE INDEX IF NOT EXISTS ix_setup_candidate_logs_setup_type ON setup_candidate_logs (setup_type);
