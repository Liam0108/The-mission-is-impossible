ALTER TABLE trades ADD COLUMN IF NOT EXISTS manual_quality VARCHAR(8);

ALTER TABLE trades ALTER COLUMN liquidity_sweep TYPE VARCHAR(24);
ALTER TABLE trades ALTER COLUMN choch TYPE VARCHAR(8);
ALTER TABLE trades ALTER COLUMN lh_hl TYPE VARCHAR(16);

ALTER TABLE trades DROP CONSTRAINT IF EXISTS ck_trades_liquidity_sweep;
ALTER TABLE trades DROP CONSTRAINT IF EXISTS ck_trades_choch;
ALTER TABLE trades DROP CONSTRAINT IF EXISTS ck_trades_lh_hl;
ALTER TABLE trades DROP CONSTRAINT IF EXISTS ck_trades_manual_quality;

ALTER TABLE trades
    ADD CONSTRAINT ck_trades_liquidity_sweep
    CHECK (liquidity_sweep IN ('None', '1m', '5m', '15m', 'PDH/PDL', 'Session High/Low', 'Yes', 'No'));

ALTER TABLE trades
    ADD CONSTRAINT ck_trades_choch
    CHECK (choch IN ('None', '1m', '5m', '15m', 'Yes', 'No'));

ALTER TABLE trades
    ADD CONSTRAINT ck_trades_lh_hl
    CHECK (lh_hl IN ('None', 'HL for Long', 'LH for Short', 'Failed HL', 'Failed LH', 'Yes', 'No'));

ALTER TABLE trades
    ADD CONSTRAINT ck_trades_manual_quality
    CHECK (manual_quality IS NULL OR manual_quality IN ('A+', 'A', 'B', 'C', 'Skip'));
