BEGIN;

ALTER TABLE trades ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(64);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS trade_decision VARCHAR(16) NOT NULL DEFAULT 'Taken';
ALTER TABLE trades ADD COLUMN IF NOT EXISTS skip_reason VARCHAR(32);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS distance_to_poc NUMERIC(10, 2);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS distance_to_vah NUMERIC(10, 2);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS distance_to_val NUMERIC(10, 2);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS poc_risk_level VARCHAR(8) NOT NULL DEFAULT 'Unknown';
ALTER TABLE trades ADD COLUMN IF NOT EXISTS similarity_group_id VARCHAR(64);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS management_rule_notes TEXT;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_trades_result'
          AND conrelid = 'trades'::regclass
    ) THEN
        ALTER TABLE trades DROP CONSTRAINT ck_trades_result;
    END IF;

    ALTER TABLE trades
        ADD CONSTRAINT ck_trades_result
        CHECK (result IN ('TP1', 'BE', 'SL', 'NoTrade', 'Unknown'));
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_trades_trade_decision'
          AND conrelid = 'trades'::regclass
    ) THEN
        ALTER TABLE trades
            ADD CONSTRAINT ck_trades_trade_decision
            CHECK (trade_decision IN ('Taken', 'Skipped', 'Watched', 'Invalidated'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_trades_skip_reason'
          AND conrelid = 'trades'::regclass
    ) THEN
        ALTER TABLE trades
            ADD CONSTRAINT ck_trades_skip_reason
            CHECK (
                skip_reason IS NULL
                OR skip_reason IN (
                    'Near POC',
                    'Weak CHOCH',
                    'No Clear FVG',
                    'Poor RR',
                    'Against 15m Bias',
                    'News Risk',
                    'Too Late',
                    'Too Early',
                    'Emotional Reason',
                    'Other'
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_trades_poc_risk_level'
          AND conrelid = 'trades'::regclass
    ) THEN
        ALTER TABLE trades
            ADD CONSTRAINT ck_trades_poc_risk_level
            CHECK (poc_risk_level IN ('Low', 'Medium', 'High', 'Unknown'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_trades_user_id ON trades (user_id);
CREATE INDEX IF NOT EXISTS ix_trades_workspace_id ON trades (workspace_id);
CREATE INDEX IF NOT EXISTS ix_trades_trade_decision ON trades (trade_decision);
CREATE INDEX IF NOT EXISTS ix_trades_poc_risk_level ON trades (poc_risk_level);
CREATE INDEX IF NOT EXISTS ix_trades_similarity_group_id ON trades (similarity_group_id);

COMMIT;

