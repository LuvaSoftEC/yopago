-- Initialize YoPago database
-- This script runs when the PostgreSQL container is first created

-- Create database (if using default postgres database)
-- CREATE DATABASE yopago;

-- Connect to yopago database
\c yopago;

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE yopago TO yopago;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO yopago;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO yopago;

-- Create initial schema (Flyway will handle migrations in production)
-- This is just for local development bootstrap

CREATE TABLE IF NOT EXISTS expense_groups (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(500),
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
    id BIGSERIAL PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    paid_by VARCHAR(255) NOT NULL,
    group_id BIGINT REFERENCES expense_groups(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_expenses_group_id ON expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON expenses(paid_by);
CREATE INDEX IF NOT EXISTS idx_expense_groups_created_by ON expense_groups(created_by);

-- Insert sample data for development
INSERT INTO expense_groups (name, description, created_by) VALUES
    ('Roommates', 'Shared apartment expenses', 'demo'),
    ('Trip to Italy', 'Summer vacation 2024', 'demo')
ON CONFLICT DO NOTHING;

INSERT INTO expenses (description, amount, paid_by, group_id, category) VALUES
    ('Grocery shopping', 125.50, 'demo', 1, 'Food'),
    ('Internet bill', 60.00, 'demo', 1, 'Utilities'),
    ('Flight tickets', 450.00, 'demo', 2, 'Travel'),
    ('Hotel Rome', 300.00, 'demo', 2, 'Accommodation')
ON CONFLICT DO NOTHING;
