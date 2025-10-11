-- Fix: Replace unrestricted UPDATE policy with user-scoped policy on deployments table
DROP POLICY IF EXISTS "Allow deployment status updates" ON public.deployments;

-- Users can only update their own deployments
CREATE POLICY "Users can update own deployments" ON public.deployments
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Service role can update all deployments (for Fly.io worker)
CREATE POLICY "Service role can update all deployments" ON public.deployments
FOR UPDATE TO service_role
USING (true)
WITH CHECK (true);