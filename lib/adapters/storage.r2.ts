 import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

export class R2Storage {
  private client: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor() {
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });

    const isDev = process.env.NODE_ENV === "development";
    this.bucket = isDev ? process.env.R2_DEV_BUCKET! : process.env.R2_PROD_BUCKET!;
    this.publicUrl = isDev ? process.env.R2_DEV_PUBLIC_URL! : process.env.R2_PROD_PUBLIC_URL!;
  }

  private getKey(z: number, x: number, y: number, hash?: string): string {
    if (hash) {
      return `${z}/${x}/${y}-${hash}.webp`;
    }
    return `${z}/${x}/${y}.webp`;
  }

  async readTile(z: number, x: number, y: number, hash?: string): Promise<Buffer | null> {
    // Try with hash first if provided
    if (hash) {
      try {
        const command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: this.getKey(z, x, y, hash),
        });
        
        const response = await this.client.send(command);
        const chunks: Buffer[] = [];
        
        if (response.Body) {
          const stream = response.Body as any;
          for await (const chunk of stream) {
            chunks.push(chunk);
          }
          return Buffer.concat(chunks);
        }
        return null;
      } catch (error) {
        console.log(`R2 tile not found with hash: z:${z} x:${x} y:${y} hash:${hash}, trying without hash...`);
        // Fall through to try without hash
      }
    }

    // Try without hash (backward compatibility)
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.getKey(z, x, y), // No hash
      });
      
      const response = await this.client.send(command);
      const chunks: Buffer[] = [];
      
      if (response.Body) {
        const stream = response.Body as any;
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        return Buffer.concat(chunks);
      }
      return null;
    } catch (error) {
      console.log(`R2 tile not found: z:${z} x:${x} y:${y}${hash ? ` (tried with and without hash)` : ''}`);
      return null;
    }
  }

  async writeTile(z: number, x: number, y: number, buffer: Buffer, hash?: string): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.getKey(z, x, y, hash),
        Body: buffer,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      });

      await this.client.send(command);
      console.log(`✅ Uploaded tile to R2: z:${z} x:${x} y:${y}${hash ? ` hash:${hash}` : ''}`);
    } catch (error) {
      // Log to monitoring service in production
      console.error(`🚨 CRITICAL: R2 upload failed for z:${z} x:${x} y:${y}:`, error);
      
      if (process.env.NODE_ENV === "production") {
        // Optional: Add your monitoring service alert here
        // await sendAlert(`R2 storage failure: ${error.message}`);
      }
      
      throw error; // Re-throw to trigger graceful failure
    }
  }

  async tileExists(z: number, x: number, y: number, hash?: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: this.getKey(z, x, y, hash),
      });
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  getPublicUrl(z: number, x: number, y: number, hash?: string): string {
    return `${this.publicUrl}/${this.getKey(z, x, y, hash)}`;
  }
}

export const r2Storage = new R2Storage();
