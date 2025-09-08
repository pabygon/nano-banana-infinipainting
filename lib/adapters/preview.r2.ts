// R2-based preview storage for production environments
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

interface PreviewStorage {
  store(id: string, buffer: Buffer): Promise<void>;
  get(id: string): Promise<Buffer | null>;
  delete(id: string): Promise<void>;
}

export class R2PreviewStorage implements PreviewStorage {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });

    // Use the same bucket as tile storage but with previews/ prefix
    const isDev = process.env.NODE_ENV === "development";
    this.bucket = isDev ? process.env.R2_DEV_BUCKET! : process.env.R2_PROD_BUCKET!;
  }

  private getKey(id: string): string {
    return `previews/${id}.webp`;
  }

  async store(id: string, buffer: Buffer): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.getKey(id),
        Body: buffer,
        ContentType: "image/webp",
        CacheControl: "private, max-age=600", // 10 minutes cache
        // Set expiration metadata for cleanup (optional)
        Metadata: {
          createdAt: Date.now().toString(),
          expiresAt: (Date.now() + 10 * 60 * 1000).toString() // 10 minutes TTL
        }
      });

      await this.client.send(command);
      console.log(`📦 Stored preview ${id} in R2 (${buffer.length} bytes)`);
    } catch (error) {
      console.error(`🚨 R2 preview upload failed for ${id}:`, error);
      throw error;
    }
  }

  async get(id: string): Promise<Buffer | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.getKey(id),
      });
      
      const response = await this.client.send(command);
      const chunks: Buffer[] = [];
      
      if (response.Body) {
        const stream = response.Body as any;
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        
        // Check if expired (optional cleanup)
        const metadata = response.Metadata;
        if (metadata?.expiresAt) {
          const expiresAt = parseInt(metadata.expiresAt);
          if (Date.now() > expiresAt) {
            console.log(`📦 Preview ${id} expired, cleaning up`);
            // Async cleanup - don't wait for it
            this.delete(id).catch(err => console.error('Cleanup error:', err));
            return null;
          }
        }
        
        return Buffer.concat(chunks);
      }
      return null;
    } catch (error) {
      console.log(`📦 Preview not found in R2: ${id}`);
      return null;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.getKey(id),
      });
      
      await this.client.send(command);
      console.log(`🗑️ Deleted preview ${id} from R2`);
    } catch (error) {
      console.error(`Error deleting preview ${id} from R2:`, error);
      // Don't throw - deletion failures are not critical
    }
  }
}

export const r2Preview = new R2PreviewStorage();
