ALTER TABLE trades
ADD COLUMN IF NOT EXISTS data_quality VARCHAR(16) NOT NULL DEFAULT 'incomplete';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_trades_data_quality'
    ) THEN
        ALTER TABLE trades
        ADD CONSTRAINT ck_trades_data_quality
        CHECK (data_quality IN ('good', 'incomplete', 'bad'));
    END IF;
END $$;

UPDATE trades
SET data_quality = CASE
    WHEN trade_decision <> 'Taken' THEN 'incomplete'
    WHEN entry_price IS NULL
        OR stop_loss IS NULL
        OR result IS NULL
        OR result_r IS NULL
        OR direction IS NULL
        OR session IS NULL
        OR location IS NULL
        OR bias_15m IS NULL
        OR liquidity_sweep IS NULL
        OR choch IS NULL
        OR fvg_reaction IS NULL THEN 'incomplete'
    WHEN result NOT IN ('TP1', 'BE', 'SL') THEN 'bad'
    WHEN entry_price = stop_loss THEN 'bad'
    WHEN result = 'SL' AND result_r >= 0 THEN 'bad'
    WHEN result = 'TP1' AND result_r <= 0 THEN 'bad'
    ELSE 'good'
END;

CREATE INDEX IF NOT EXISTS ix_trades_data_quality ON trades (data_quality);
CREATE INDEX IF NOT EXISTS ix_trades_valid_taken
ON trades (trade_decision, data_quality, date)
WHERE trade_decision = 'Taken' AND data_quality = 'good';
