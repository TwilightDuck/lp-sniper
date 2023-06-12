CREATE TABLE test (
    id INTEGER PRIMARY KEY,
    asset TEXT NOT NULL,
    dex TEXT NOT NULL,
    amount DECIMAL,
    quantity DECIMAL,
    price DECIMAL,
    fees DECIMAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);