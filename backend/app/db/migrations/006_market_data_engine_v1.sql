CREATE TABLE IF NOT EXISTS market_candles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(12) NOT NULL,
    timeframe VARCHAR(4) NOT NULL CHECK (timeframe IN ('1m', '5m')),
    timestamp TIMESTAMPTZ NOT NULL,
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
