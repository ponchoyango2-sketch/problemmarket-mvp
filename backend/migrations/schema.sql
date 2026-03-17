-- Schema for ProblemMarket MVP
-- Run with: psql <connection> -f backend/migrations/schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  reputation NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Rewards
CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(8) DEFAULT 'USD',
  escrow_status VARCHAR(32) DEFAULT 'deposited', -- deposited | released | refunded
  platform_fee NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  released_at TIMESTAMP WITH TIME ZONE
);

-- Problems
CREATE TABLE IF NOT EXISTS problems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  publisher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  reward_id UUID REFERENCES rewards(id) ON DELETE SET NULL,
  status VARCHAR(32) DEFAULT 'draft', -- draft | pending_payment | published | awarded | closed
  fee_paid BOOLEAN NOT NULL DEFAULT false,
  stripe_session_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Solutions
CREATE TABLE IF NOT EXISTS solutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  selected BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(status);
CREATE INDEX IF NOT EXISTS idx_solutions_problem ON solutions(problem_id);
