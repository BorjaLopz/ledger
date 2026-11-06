CREATE TABLE warranties (
    id            VARCHAR(64)  PRIMARY KEY,
    uid           VARCHAR(128) NOT NULL,
    name          VARCHAR(100) NOT NULL,
    purchase_date DATE         NOT NULL,
    months        INTEGER      NOT NULL CHECK (months BETWEEN 1 AND 120),
    note          TEXT         NOT NULL DEFAULT '',
    receipt_path  VARCHAR(400),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_warranties_uid ON warranties (uid);
