-- Add password_hash column to users table for password-based login
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash text;

-- Add index for faster email lookups during login
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);