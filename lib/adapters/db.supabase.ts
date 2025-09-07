import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DB, TileRecord, TileStatus } from './db';

// Database schema type for better TypeScript support
interface DatabaseTileRecord {
  z: number;
  x: number; 
  y: number;
  status: TileStatus;
  seed?: string;
  hash?: string;
  content_hash?: string;
  content_ver?: number;
  created_at?: string;
  updated_at?: string;
  locked?: boolean;
  locked_at?: string;
  locked_by?: string;
}

export class SupabaseDB implements DB {
  private client: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables: SUPABASE_URL and SUPABASE_ANON_KEY required');
    }

    this.client = createClient(supabaseUrl, supabaseKey);
  }

  async getTile(z: number, x: number, y: number): Promise<TileRecord | null> {
    try {
      const { data, error } = await this.client
        .from('tiles')
        .select('*')
        .eq('z', z)
        .eq('x', x)
        .eq('y', y)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - tile doesn't exist
          return null;
        }
        console.error('Supabase getTile error:', error);
        return null;
      }

      return this.mapFromDatabase(data);
    } catch (error) {
      console.error('Supabase getTile exception:', error);
      return null;
    }
  }

  async upsertTile(tr: Partial<TileRecord> & { z: number; x: number; y: number }): Promise<TileRecord> {
    try {
      const now = new Date().toISOString();
      
      // Prepare the data for database insertion
      const dbRecord: Partial<DatabaseTileRecord> = {
        z: tr.z,
        x: tr.x,
        y: tr.y,
        status: tr.status || 'EMPTY',
        seed: tr.seed,
        hash: tr.hash,
        content_hash: tr.contentHash,
        content_ver: tr.contentVer || 1,
        updated_at: now,
        locked: tr.locked || false,
        locked_at: tr.locked_at,
        locked_by: tr.locked_by,
      };

      // Only set created_at for new records
      if (!await this.getTile(tr.z, tr.x, tr.y)) {
        dbRecord.created_at = now;
      }

      const { data, error } = await this.client
        .from('tiles')
        .upsert(dbRecord, { 
          onConflict: 'z,x,y',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase upsertTile error:', error);
        throw new Error(`Failed to upsert tile: ${error.message}`);
      }

      return this.mapFromDatabase(data);
    } catch (error) {
      console.error('Supabase upsertTile exception:', error);
      throw error;
    }
  }

  async updateTile(z: number, x: number, y: number, patch: Partial<TileRecord>): Promise<TileRecord> {
    try {
      // Map the patch to database format
      const dbPatch: Partial<DatabaseTileRecord> = {
        updated_at: new Date().toISOString(),
      };

      if (patch.status !== undefined) dbPatch.status = patch.status;
      if (patch.seed !== undefined) dbPatch.seed = patch.seed;
      if (patch.hash !== undefined) dbPatch.hash = patch.hash;
      if (patch.contentHash !== undefined) dbPatch.content_hash = patch.contentHash;
      if (patch.contentVer !== undefined) dbPatch.content_ver = patch.contentVer;
      if (patch.locked !== undefined) dbPatch.locked = patch.locked;
      if (patch.locked_at !== undefined) dbPatch.locked_at = patch.locked_at;
      if (patch.locked_by !== undefined) dbPatch.locked_by = patch.locked_by;

      const { data, error } = await this.client
        .from('tiles')
        .update(dbPatch)
        .eq('z', z)
        .eq('x', x)
        .eq('y', y)
        .select()
        .single();

      if (error) {
        console.error('Supabase updateTile error:', error);
        throw new Error(`Failed to update tile: ${error.message}`);
      }

      return this.mapFromDatabase(data);
    } catch (error) {
      console.error('Supabase updateTile exception:', error);
      throw error;
    }
  }

  async getTiles(batch: { z: number; x: number; y: number }[]): Promise<TileRecord[]> {
    if (batch.length === 0) return [];

    try {
      // Build a query for multiple tiles using OR conditions
      let query = this.client.from('tiles').select('*');
      
      // For small batches, use OR conditions
      if (batch.length <= 10) {
        const conditions = batch.map(({ z, x, y }) => 
          `(z.eq.${z},x.eq.${x},y.eq.${y})`
        ).join(',');
        query = query.or(conditions);
      } else {
        // For larger batches, we'd need to use a different approach
        // For now, fall back to individual queries (not optimal, but works)
        const results = await Promise.all(
          batch.map(({ z, x, y }) => this.getTile(z, x, y))
        );
        return results.map((tile, index) => 
          tile || { 
            z: batch[index].z, 
            x: batch[index].x, 
            y: batch[index].y, 
            status: 'EMPTY' as TileStatus,
            contentVer: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            locked: false
          }
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error('Supabase getTiles error:', error);
        // Return empty tiles for the batch
        return batch.map(({ z, x, y }) => ({
          z, x, y,
          status: 'EMPTY' as TileStatus,
          contentVer: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          locked: false
        }));
      }

      // Map results and fill in missing tiles
      const resultMap = new Map<string, TileRecord>();
      data?.forEach(record => {
        const key = `${record.z}_${record.x}_${record.y}`;
        resultMap.set(key, this.mapFromDatabase(record));
      });

      return batch.map(({ z, x, y }) => {
        const key = `${z}_${x}_${y}`;
        return resultMap.get(key) || {
          z, x, y,
          status: 'EMPTY' as TileStatus,
          contentVer: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          locked: false
        };
      });
    } catch (error) {
      console.error('Supabase getTiles exception:', error);
      // Return empty tiles for the batch
      return batch.map(({ z, x, y }) => ({
        z, x, y,
        status: 'EMPTY' as TileStatus,
        contentVer: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        locked: false
      }));
    }
  }

  // Helper method to map database records to application format
  private mapFromDatabase(dbRecord: DatabaseTileRecord): TileRecord {
    return {
      z: dbRecord.z,
      x: dbRecord.x,
      y: dbRecord.y,
      status: dbRecord.status,
      seed: dbRecord.seed,
      hash: dbRecord.hash,
      contentHash: dbRecord.content_hash,
      contentVer: dbRecord.content_ver,
      createdAt: dbRecord.created_at,
      updatedAt: dbRecord.updated_at,
      locked: dbRecord.locked,
      locked_at: dbRecord.locked_at,
      locked_by: dbRecord.locked_by,
    };
  }

  // Utility method to clean up stale locks
  async cleanupStaleLocks(): Promise<number> {
    try {
      const { data, error } = await this.client.rpc('cleanup_stale_locks');
      
      if (error) {
        console.error('Failed to cleanup stale locks:', error);
        return 0;
      }
      
      return data || 0;
    } catch (error) {
      console.error('Exception during stale lock cleanup:', error);
      return 0;
    }
  }

  // Utility method to get tile statistics
  async getStatistics(): Promise<any[]> {
    try {
      const { data, error } = await this.client.rpc('get_tile_statistics');
      
      if (error) {
        console.error('Failed to get tile statistics:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Exception during statistics retrieval:', error);
      return [];
    }
  }
}

// Create and export the instance
export const supabaseDB = new SupabaseDB();
