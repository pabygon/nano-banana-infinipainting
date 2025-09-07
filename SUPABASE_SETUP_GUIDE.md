# Supabase Setup Guide for Infinimap

This guide will help you set up Supabase as your cloud database for tile metadata storage.

## Step 1: Create Supabase Project

1. **Go to** [https://supabase.com](https://supabase.com)
2. **Sign up/Login** to your account
3. **Create a new project**:
   - Choose a project name (e.g., "infinimap-tiles")
   - Set a database password (save this!)
   - Select a region close to you
   - Wait for project creation (~2 minutes)

## Step 2: Run Database Setup Scripts

1. **Open your Supabase dashboard**
2. **Go to the SQL Editor** (left sidebar)
3. **Copy the entire contents** of `supabase-setup.sql`
4. **Paste and run** the script
5. **Verify success**: You should see confirmation messages

## Step 3: Get Your Supabase Credentials

In your Supabase dashboard:

1. **Go to Settings** → **API**
2. **Copy these values**:
   - Project URL (looks like: `https://abcdefgh.supabase.co`)
   - Anon public key (long string starting with `eyJ...`)

## Step 4: Update Your Environment Variables

Add these to your `.env.local` file:

```bash
# Enable Supabase database
USE_SUPABASE_DB=true

# Supabase credentials (server-side only - NO NEXT_PUBLIC_ prefix!)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# R2 Storage (REQUIRED - file-based storage has been removed)
ENABLE_R2_REDIRECT=true
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_DEV_BUCKET=your-dev-bucket-name
R2_PROD_BUCKET=your-prod-bucket-name
R2_DEV_PUBLIC_URL=https://your-dev-bucket.r2.dev
R2_PROD_PUBLIC_URL=https://your-prod-bucket.r2.dev

# Other settings
GEMINI_API_KEY=your-gemini-key
```

## Step 5: Test the Setup

1. **Start your development server**:
   ```bash
   npm run dev
   # or yarn dev
   ```

2. **Check the console** - you should see:
   ```
   📊 Using Supabase database
   ```

3. **Test a tile operation**:
   - Visit http://localhost:3000/map
   - Zoom to max level and generate a tile
   - Check your Supabase dashboard → Table Editor → tiles table
   - You should see the new tile record!

## Step 6: Verify Database Operations

You can test the database directly in Supabase SQL Editor:

```sql
-- Check if tiles table exists
SELECT COUNT(*) FROM tiles;

-- View recent tiles
SELECT * FROM recent_tiles;

-- Get tile statistics
SELECT * FROM get_tile_statistics();

-- Test inserting a tile (optional)
INSERT INTO tiles (z, x, y, status, content_hash) 
VALUES (8, 999, 999, 'READY', 'test-hash')
ON CONFLICT (z, x, y) DO NOTHING;
```

## Important: NEXT_PUBLIC_ vs Server-Side Variables

**For this implementation, do NOT use `NEXT_PUBLIC_` prefix!**

### Why No `NEXT_PUBLIC_`?

- ✅ **Security**: Database credentials stay on the server
- ✅ **Architecture**: All database operations happen via API routes  
- ✅ **Performance**: No unnecessary client-side database code

### When You WOULD Use `NEXT_PUBLIC_`:

```bash
# Only if you want client-side Supabase access
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Use case**: Direct client-side queries, real-time subscriptions, authentication

### Current Architecture:
```
Browser → API Routes → Supabase Database
         ↑
    Server-side only
```

### Alternative Architecture (if using NEXT_PUBLIC_):
```
Browser → Direct → Supabase Database
         ↑
    Client-side access
```

For tile generation, server-side is better for security and performance.

## Troubleshooting

### Error: "Missing Supabase environment variables"
- ✅ Check your `.env.local` has `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- ✅ Restart your development server after adding variables

### Error: "Failed to load Supabase DB"
- ✅ Run `npm install @supabase/supabase-js`
- ✅ Check your Supabase project is running (not paused)
- ✅ Verify your URL and key are correct

### Tiles appear as "EMPTY" despite R2 images
- ✅ This is expected during migration - your R2 has images but Supabase starts empty
- ✅ Generate new tiles to test the full pipeline
- ✅ Or create a migration script to populate Supabase from R2

### Console shows "📁 Using file-based database"
- ✅ Set `USE_SUPABASE_DB=true` in `.env.local`
- ✅ Restart your development server

## Production Deployment

For production (Vercel, etc.):

1. **Add environment variables** to your hosting platform:
   ```
   USE_SUPABASE_DB=true
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-key
   ```
   
   **Note**: Still no `NEXT_PUBLIC_` prefix in production!

2. **Supabase will auto-scale** with your app usage

3. **Monitor your database** in the Supabase dashboard

## Database Schema Overview

Your `tiles` table structure:

| Column | Type | Description |
|--------|------|-------------|
| z, x, y | integers | Tile coordinates (primary key) |
| status | text | 'EMPTY', 'PENDING', or 'READY' |
| content_hash | text | Hash used for R2 filename |
| created_at | timestamp | When tile was first created |
| updated_at | timestamp | Last modification time |
| locked | boolean | Generation lock status |

## Useful Supabase Queries

```sql
-- Find all ready tiles
SELECT z, x, y, content_hash FROM tiles WHERE status = 'READY';

-- Tiles by zoom level
SELECT z, COUNT(*) FROM tiles GROUP BY z ORDER BY z;

-- Recent generation activity
SELECT * FROM tiles WHERE updated_at > NOW() - INTERVAL '1 hour';

-- Clear all test data (if needed)
DELETE FROM tiles WHERE content_hash LIKE 'test%';
```

## Benefits of Supabase

✅ **Automatic backups** - your data is safe  
✅ **Real-time updates** - can add multiplayer features later  
✅ **Horizontal scaling** - handles traffic growth  
✅ **SQL interface** - easy to query and debug  
✅ **Free tier** - generous limits for development  

Your tile metadata is now stored in the cloud and will persist across deployments! 🎉
