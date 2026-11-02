CREATE TABLE categories (
    id    VARCHAR(64)  PRIMARY KEY,
    uid   VARCHAR(128) NOT NULL,
    name  VARCHAR(100) NOT NULL,
    color VARCHAR(20)  NOT NULL,
    icon  VARCHAR(60)  NOT NULL,
    type  VARCHAR(10)  NOT NULL CHECK (type IN ('expense', 'income'))
);
CREATE INDEX idx_categories_uid ON categories (uid);

CREATE TABLE transactions (
    id           VARCHAR(64)   PRIMARY KEY,
    uid          VARCHAR(128)  NOT NULL,
    type         VARCHAR(10)   NOT NULL CHECK (type IN ('expense', 'income')),
    amount       NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    category_id  VARCHAR(64)   NOT NULL,
    date         DATE          NOT NULL,
    note         TEXT          NOT NULL DEFAULT '',
    receipt_path VARCHAR(400),
    recurring_id VARCHAR(64),
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_transactions_uid_date ON transactions (uid, date DESC);
CREATE INDEX idx_transactions_recurring ON transactions (recurring_id);

CREATE TABLE recurring_payments (
    id          VARCHAR(64)   PRIMARY KEY,
    uid         VARCHAR(128)  NOT NULL,
    type        VARCHAR(10)   NOT NULL CHECK (type IN ('expense', 'income')),
    amount      NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    category_id VARCHAR(64)   NOT NULL,
    frequency   VARCHAR(10)   NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
    next_date   DATE          NOT NULL,
    active      BOOLEAN       NOT NULL DEFAULT TRUE,
    note        TEXT          NOT NULL DEFAULT ''
);
CREATE INDEX idx_recurring_uid ON recurring_payments (uid);

CREATE TABLE net_worth_entries (
    id    VARCHAR(64)   PRIMARY KEY,
    uid   VARCHAR(128)  NOT NULL,
    date  DATE          NOT NULL,
    items JSONB         NOT NULL DEFAULT '[]'::jsonb,
    total NUMERIC(16,2) NOT NULL
);
CREATE INDEX idx_net_worth_uid_date ON net_worth_entries (uid, date);
