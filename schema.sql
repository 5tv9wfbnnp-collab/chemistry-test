CREATE TABLE IF NOT EXISTS invitations (
 id uuid PRIMARY KEY, code_hash text NOT NULL UNIQUE, label text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), draft jsonb NOT NULL DEFAULT '{}',
 draft_updated_at timestamptz, started_at timestamptz
);
CREATE TABLE IF NOT EXISTS submissions (
 attempt_id uuid PRIMARY KEY REFERENCES invitations(id),
 submitted_at timestamptz NOT NULL DEFAULT now(), version text NOT NULL,
 answers jsonb NOT NULL, report jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_limits (
 bucket text PRIMARY KEY, hits integer NOT NULL, expires_at timestamptz NOT NULL
);
