-- Fix: Make user_id NOT NULL in deployments table to enforce RLS properly
ALTER TABLE public.deployments ALTER COLUMN user_id SET NOT NULL;