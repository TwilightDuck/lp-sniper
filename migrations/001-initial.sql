CREATE TABLE test (
    id INTEGER PRIMARY KEY,
    asset TEXT NOT NULL,
    dex TEXT NOT NULL,
    amount INTEGER,
    quantity DECIMAL,
    price DECIMAL,
    created_at TIMESTAMP DEFAULT NOW
);

INSERT INTO
    test (asset, dex, price)
VALUES
    ('asset1', 'minswap', 5000);