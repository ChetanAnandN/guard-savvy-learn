-- Add 'blocked' to the user_action_type enum
ALTER TYPE public.user_action_type ADD VALUE IF NOT EXISTS 'blocked';