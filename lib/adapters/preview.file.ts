// File-based preview storage for development
import fs from "node:fs/promises";
import path from "node:path";

const TEMP_DIR = path.join(process.cwd(), '.temp');

// Ensure temp directory exists
let ensured = false;
async function ensureTempDir() {
  if (!ensured) {
    await fs.mkdir(TEMP_DIR, { recursive: true }).catch(() => {});
    ensured = true;
  }
}

export const filePreview = {
  async store(id: string, buffer: Buffer): Promise<void> {
    await ensureTempDir();
    const previewPath = path.join(TEMP_DIR, `${id}.webp`);
    await fs.writeFile(previewPath, buffer);
    console.log(`📁 Stored preview ${id} to file system`);
  },

  async get(id: string): Promise<Buffer | null> {
    await ensureTempDir();
    const previewPath = path.join(TEMP_DIR, `${id}.webp`);
    try {
      return await fs.readFile(previewPath);
    } catch {
      return null;
    }
  },

  async delete(id: string): Promise<void> {
    await ensureTempDir();
    const previewPath = path.join(TEMP_DIR, `${id}.webp`);
    await fs.unlink(previewPath).catch(() => {});
    console.log(`🗑️ Deleted preview ${id} from file system`);
  }
};
