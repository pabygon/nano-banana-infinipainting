-- Supabase Database Setup for Infinimap
-- Run these scripts in your Supabase SQL Editor

-- ============================================================================
-- 1. CREATE TILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tiles (
  -- Primary coordinates
  z INTEGER NOT NULL,
  x INTEGER NOT NULL, 
  y INTEGER NOT NULL,
  
  -- Tile status and content
  status TEXT NOT NULL DEFAULT 'EMPTY' CHECK (status IN ('EMPTY', 'PENDING', 'READY')),
  seed TEXT,                    -- hex or decimal string for generation
  hash TEXT,                    -- tile payload hash (algorithm + content + seed)
  content_hash TEXT,            -- image content hash (used for R2 filename)
  content_ver INTEGER DEFAULT 1, -- increments on change
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Generation lock fields
  locked BOOLEAN DEFAULT FALSE,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,               -- user/client ID
  
  -- Primary key constraint
  PRIMARY KEY (z, x, y)
);

-- ============================================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for querying by status (find all READY tiles, etc.)
CREATE INDEX IF NOT EXISTS idx_tiles_status ON tiles(status);

-- Index for querying by zoom level (common operation)
CREATE INDEX IF NOT EXISTS idx_tiles_zoom ON tiles(z);

-- Index for finding locked tiles (cleanup operations)
CREATE INDEX IF NOT EXISTS idx_tiles_locked ON tiles(locked, locked_at) WHERE locked = true;

-- Index for timestamp queries (recent tiles, cleanup)
CREATE INDEX IF NOT EXISTS idx_tiles_updated_at ON tiles(updated_at);

-- Composite index for spatial queries (tiles in a region)
CREATE INDEX IF NOT EXISTS idx_tiles_spatial ON tiles(z, x, y);

-- Index for content hash lookups (R2 filename matching)
CREATE INDEX IF NOT EXISTS idx_tiles_content_hash ON tiles(content_hash) WHERE content_hash IS NOT NULL;

-- ============================================================================
-- 3. CREATE UPDATED_AT TRIGGER
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to call the function before any UPDATE
CREATE TRIGGER update_tiles_updated_at 
    BEFORE UPDATE ON tiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS (you can disable this if you don't need user-level security)
ALTER TABLE tiles ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous read access (for serving tiles)
CREATE POLICY "Allow anonymous read access" ON tiles
    FOR SELECT 
    TO anon 
    USING (true);

-- Policy: Allow authenticated users full access
CREATE POLICY "Allow authenticated full access" ON tiles
    FOR ALL 
    TO authenticated 
    USING (true);

-- Policy: Allow service role full access (for server-side operations)
CREATE POLICY "Allow service role full access" ON tiles
    FOR ALL 
    TO service_role 
    USING (true);

-- ============================================================================
-- 5. USEFUL VIEWS (OPTIONAL)
-- ============================================================================

-- View for tile statistics
CREATE OR REPLACE VIEW tile_stats AS
SELECT 
    z,
    status,
    COUNT(*) as count,
    MIN(created_at) as first_created,
    MAX(updated_at) as last_updated
FROM tiles 
GROUP BY z, status
ORDER BY z, status;

-- View for recent activity
CREATE OR REPLACE VIEW recent_tiles AS
SELECT 
    z, x, y, status, content_hash,
    created_at, updated_at
FROM tiles 
WHERE updated_at > NOW() - INTERVAL '24 hours'
ORDER BY updated_at DESC;

-- View for locked tiles (for monitoring)
CREATE OR REPLACE VIEW locked_tiles AS
SELECT 
    z, x, y, locked_at, locked_by,
    EXTRACT(EPOCH FROM (NOW() - locked_at)) as seconds_locked
FROM tiles 
WHERE locked = true
ORDER BY locked_at;

-- ============================================================================
-- 6. CLEANUP FUNCTIONS (OPTIONAL)
-- ============================================================================

-- Function to clean up stale locks (older than 5 minutes)
CREATE OR REPLACE FUNCTION cleanup_stale_locks()
RETURNS INTEGER AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    UPDATE tiles 
    SET locked = false, locked_at = NULL, locked_by = NULL
    WHERE locked = true 
    AND locked_at < NOW() - INTERVAL '5 minutes';
    
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN affected_rows;
END;
$$ LANGUAGE plpgsql;

-- Function to get tile statistics
CREATE OR REPLACE FUNCTION get_tile_statistics()
RETURNS TABLE(
    zoom_level INTEGER,
    total_tiles BIGINT,
    ready_tiles BIGINT,
    pending_tiles BIGINT,
    empty_tiles BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        z as zoom_level,
        COUNT(*) as total_tiles,
        COUNT(*) FILTER (WHERE status = 'READY') as ready_tiles,
        COUNT(*) FILTER (WHERE status = 'PENDING') as pending_tiles,
        COUNT(*) FILTER (WHERE status = 'EMPTY') as empty_tiles
    FROM tiles
    GROUP BY z
    ORDER BY z;
END;
$$ LANGUAGE plpgsql;



-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if everything was created successfully
SELECT 'Tables created:' as check_type, COUNT(*) as count 
FROM information_schema.tables 
WHERE table_name = 'tiles';

SELECT 'Indexes created:' as check_type, COUNT(*) as count 
FROM pg_indexes 
WHERE tablename = 'tiles';

SELECT 'Sample data:' as check_type, COUNT(*) as count 
FROM tiles;

-- Test the statistics function
SELECT * FROM get_tile_statistics();
