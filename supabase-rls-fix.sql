-- Fix RLS Policies for Infinimap
-- Run this in your Supabase SQL Editor to fix the generation lock issue

-- Option 1: Give anon role full access (recommended for this app)
DROP POLICY IF EXISTS "Allow anonymous read access" ON tiles;
CREATE POLICY "Allow anonymous full access" ON tiles
    FOR ALL 
    TO anon 
    USING (true);

-- Option 2: Alternative - Disable RLS entirely (uncomment if you prefer this)
-- ALTER TABLE tiles DISABLE ROW LEVEL SECURITY;

-- Verify the policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'tiles';
