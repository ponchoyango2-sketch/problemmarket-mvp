-- Add Stripe publish-fee tracking to problems
ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS fee_paid BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

-- New default for publish workflow: draft -> pending_payment -> published
ALTER TABLE problems
  ALTER COLUMN status SET DEFAULT 'draft';

CREATE UNIQUE INDEX IF NOT EXISTS idx_problems_stripe_session_id
  ON problems(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;
