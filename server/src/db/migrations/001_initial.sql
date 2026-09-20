-- Forge OS v1.3 durable owner ledger schema

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS facilities (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  facility_name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  contracted_mw REAL NOT NULL DEFAULT 0,
  deployed_mw REAL NOT NULL DEFAULT 0,
  electricity_rate REAL,
  hosting_fee REAL,
  hosting_structure TEXT,
  term TEXT,
  agreement_start TEXT,
  agreement_end TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  notes TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS miner_assets (
  id TEXT PRIMARY KEY,
  manufacturer TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  serial_numbers_json TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  nominal_hashrate_th REAL NOT NULL DEFAULT 0,
  wattage REAL NOT NULL DEFAULT 0,
  efficiency_j_th REAL,
  acquisition_date TEXT,
  acquisition_cost_usd REAL,
  shipping_cost_usd REAL,
  deployment_cost_usd REAL,
  deployment_date TEXT,
  hosting_provider TEXT NOT NULL DEFAULT '',
  facility TEXT NOT NULL DEFAULT '',
  facility_id TEXT REFERENCES facilities(id),
  electricity_rate_per_kwh REAL,
  monthly_hosting_fee_usd REAL,
  pool TEXT NOT NULL DEFAULT 'Braiins Pool',
  braiins_worker_name TEXT,
  status TEXT NOT NULL DEFAULT 'ordered',
  enabled INTEGER NOT NULL DEFAULT 1,
  warranty_expiration TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_miner_serial_unique
  ON miner_assets(serial_number)
  WHERE serial_number != '' AND status NOT IN ('sold', 'decommissioned');

CREATE TABLE IF NOT EXISTS treasury_positions (
  id TEXT PRIMARY KEY CHECK (id = 'default'),
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS treasury_transactions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  asset TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price REAL,
  gross_amount REAL NOT NULL DEFAULT 0,
  fee REAL NOT NULL DEFAULT 0,
  counterparty TEXT NOT NULL DEFAULT '',
  account TEXT NOT NULL DEFAULT '',
  miner_id TEXT,
  facility_id TEXT,
  memo TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  external_reference TEXT,
  production_ref TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_treasury_tx_date ON treasury_transactions(date);

CREATE TABLE IF NOT EXISTS liabilities (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  amount_usd REAL NOT NULL DEFAULT 0,
  original_principal_usd REAL,
  outstanding_principal_usd REAL,
  rate_pct REAL,
  payment_usd REAL,
  maturity TEXT,
  secured_asset TEXT,
  counterparty TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  as_of TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS owner_assumptions (
  id TEXT PRIMARY KEY CHECK (id = 'default'),
  pool_fee_pct REAL NOT NULL DEFAULT 2,
  uptime_pct REAL NOT NULL DEFAULT 95,
  default_electricity_rate_per_kwh REAL NOT NULL DEFAULT 0.045,
  efficiency_target_j_th REAL,
  monthly_accumulation_btc REAL NOT NULL DEFAULT 0,
  target_btc REAL NOT NULL DEFAULT 250,
  other_assets_usd REAL NOT NULL DEFAULT 0,
  btc_allocation_target_pct REAL,
  mining_allocation_target_pct REAL,
  cash_allocation_target_pct REAL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS allocation_targets (
  bucket TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  target_pct REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS demo_mode (
  id TEXT PRIMARY KEY CHECK (id = 'default'),
  enabled INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_snapshots (
  id TEXT PRIMARY KEY,
  btc_usd REAL,
  change_24h_pct REAL,
  provider TEXT NOT NULL,
  source_timestamp TEXT,
  ingested_at TEXT NOT NULL,
  success INTEGER NOT NULL,
  error TEXT,
  payload_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_market_snapshots_ingested
  ON market_snapshots(ingested_at);

CREATE TABLE IF NOT EXISTS network_snapshots (
  id TEXT PRIMARY KEY,
  network_hashrate_ehs REAL,
  difficulty REAL,
  block_height INTEGER,
  block_subsidy_btc REAL,
  estimated_next_adjustment TEXT,
  days_until_adjustment REAL,
  provider TEXT NOT NULL,
  source_timestamp TEXT,
  ingested_at TEXT NOT NULL,
  success INTEGER NOT NULL,
  error TEXT,
  payload_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_network_snapshots_ingested
  ON network_snapshots(ingested_at);

CREATE TABLE IF NOT EXISTS production_daily (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  btc_produced REAL NOT NULL DEFAULT 0,
  pool_source TEXT NOT NULL DEFAULT '',
  average_hashrate_th REAL,
  uptime_pct REAL,
  mining_revenue_usd REAL,
  power_hosting_cost_usd REAL,
  operating_profit_usd REAL,
  provenance TEXT NOT NULL DEFAULT 'MODELED',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fleet_snapshots (
  id TEXT PRIMARY KEY,
  ingested_at TEXT NOT NULL,
  miner_id TEXT,
  worker_name TEXT,
  hashrate_th REAL,
  worker_status TEXT,
  shares REAL,
  estimated_production_btc REAL,
  uptime_indicator TEXT,
  payload_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_fleet_snapshots_ingested
  ON fleet_snapshots(ingested_at);

CREATE TABLE IF NOT EXISTS exception_history (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL,
  miner TEXT,
  miner_id TEXT,
  facility_id TEXT,
  reason TEXT NOT NULL,
  observed_value TEXT,
  expected_value TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_hours REAL,
  payload_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_exception_history_started
  ON exception_history(started_at);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,
  prior_value_json TEXT,
  new_value_json TEXT,
  source TEXT NOT NULL DEFAULT 'api',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_events_created
  ON audit_events(created_at);

CREATE TABLE IF NOT EXISTS migration_status (
  id TEXT PRIMARY KEY CHECK (id = 'legacy_localStorage'),
  status TEXT NOT NULL DEFAULT 'pending',
  imported_at TEXT,
  fingerprint TEXT,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounting_imports (
  id TEXT PRIMARY KEY,
  imported_at TEXT NOT NULL,
  filename TEXT,
  row_count INTEGER NOT NULL DEFAULT 0,
  provenance TEXT NOT NULL DEFAULT 'MANUAL',
  notes TEXT NOT NULL DEFAULT '',
  payload_json TEXT
);

CREATE TABLE IF NOT EXISTS braiins_sync_state (
  id TEXT PRIMARY KEY CHECK (id = 'default'),
  last_success_at TEXT,
  last_error TEXT,
  worker_count INTEGER,
  matched_workers INTEGER,
  unmatched_workers INTEGER,
  stale_workers INTEGER,
  updated_at TEXT NOT NULL
);
