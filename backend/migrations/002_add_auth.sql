-- Add password_hash column for authentication
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
