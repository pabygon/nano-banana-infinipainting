import { Queue } from "./queue";
import { generateTile } from "../generator";
import { bubbleHashes } from "../hashing";

// In-memory tracking for serverless environments
const RUNNING = new Set<string>();

export const serverlessQueue: Queue = {
  async enqueue(name, payload) {
    // For serverless, run job immediately without file locks
    const key = `${payload.z}/${payload.x}/${payload.y}`;
    if (RUNNING.has(key)) {
      console.log(`Job already running for tile ${key}, skipping`);
      return;
    }
    
    RUNNING.add(key);
    try {
      console.log(`🎯 Starting tile generation: ${key} with prompt: "${payload.prompt}"`);
      // Pass the API key and provider from the payload for AI generation
      await generateTile(payload.z, payload.x, payload.y, payload.prompt, payload.apiKey, payload.apiProvider);
      await bubbleHashes(payload.z, payload.x, payload.y);
      console.log(`✅ Completed tile generation: ${key}`);
    } catch (error) {
      console.error(`❌ Failed tile generation: ${key}`, error);
      throw error;
    } finally {
      RUNNING.delete(key);
    }
  }
};
