-- Update the specific admin user to instructor role if exists
UPDATE public.users SET role = 'instructor' WHERE email = 'chetan1920681@gmail.com';

-- Insert admin user if doesn't exist
INSERT INTO public.users (email, role, verified)
VALUES ('chetan1920681@gmail.com', 'instructor', true)
ON CONFLICT (email) DO UPDATE SET role = 'instructor';

-- Create unique constraint on email if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_email_unique'
    ) THEN
        ALTER TABLE public.users ADD CONSTRAINT users_email_unique UNIQUE (email);
    END IF;
END $$;