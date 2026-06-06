ALTER TABLE trades ADD COLUMN IF NOT EXISTS account VARCHAR(64);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS broker_symbol VARCHAR(32);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS quantity NUMERIC(14, 2);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS entry_time TIMESTAMPTZ;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS exit_time TIMESTAMPTZ;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS exit_price NUMERIC(14, 2);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS gross_pnl NUMERIC(14, 2);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS commission NUMERIC(14, 2);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS net_pnl NUMERIC(14, 2);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS broker_trade_id VARCHAR(64);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS import_source VARCHAR(32);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS holding_time_minutes NUMERIC(14, 2);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS imported BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS review_status VARCHAR(16) NOT NULL DEFAULT 'reviewed';

ALTER TABLE trades DROP CONSTRAINT IF EXISTS ck_trades_review_status;

ALTER TABLE trades
    ADD CONSTRAINT ck_trades_review_status
    CHECK (review_status IN ('unreviewed', 'reviewed'));

UPDATE trades
SET review_status = 'reviewed'
WHERE review_status IS NULL;

UPDATE trades
SET imported = false
WHERE imported IS NULL;

CREATE INDEX IF NOT EXISTS ix_trades_account ON trades (account);
CREATE INDEX IF NOT EXISTS ix_trades_entry_time ON trades (entry_time);
CREATE INDEX IF NOT EXISTS ix_trades_broker_trade_id ON trades (broker_trade_id);
CREATE INDEX IF NOT EXISTS ix_trades_imported ON trades (imported);
CREATE INDEX IF NOT EXISTS ix_trades_review_status ON trades (review_status);
