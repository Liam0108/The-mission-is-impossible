ALTER TABLE market_candles ADD COLUMN IF NOT EXISTS raw_timestamp TEXT;
ALTER TABLE market_candles ADD COLUMN IF NOT EXISTS source_row_index INTEGER;
ALTER TABLE market_candles ADD COLUMN IF NOT EXISTS source_symbol VARCHAR(32);
ALTER TABLE market_candles ADD COLUMN IF NOT EXISTS source_filename TEXT;
