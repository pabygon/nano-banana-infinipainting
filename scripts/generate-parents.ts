/* NOTE: This script was designed for file-based storage and is no longer used with R2 storage.
 * Parent tiles are now generated automatically when child tiles are created/updated.
 * If you need to regenerate parent tiles, use the /api/generate-parents endpoint instead.
 */

console.error(`
❌ This script is not compatible with R2 storage.

With R2 storage, parent tiles are generated automatically when child tiles are created or updated.

If you need to manually regenerate parent tiles, use the API endpoint instead:
  curl -X POST http://localhost:3000/api/generate-parents

Or implement a new R2-compatible version of this script that:
1. Queries the Supabase database for all READY tiles at max zoom
2. Generates parent tiles using the existing generateAllParentTiles() function
3. Uses R2 storage instead of file operations
`);

process.exit(1);
