ALTER TABLE trades ADD COLUMN IF NOT EXISTS setup_type VARCHAR(32);

ALTER TABLE trades DROP CONSTRAINT IF EXISTS ck_trades_setup_type;

ALTER TABLE trades
    ADD CONSTRAINT ck_trades_setup_type
    CHECK (
        setup_type IS NULL
        OR setup_type IN (
            'Fabio Long',
            'Fabio Short',
            'Sweep Reversal Long',
            'Sweep Reversal Short',
            'Direct Delivery Long',
            'Direct Delivery Short',
            'POC Rejection',
            'Breakout Continuation',
            'News Trade',
            'Other'
        )
    );

CREATE INDEX IF NOT EXISTS ix_trades_setup_type ON trades (setup_type);
