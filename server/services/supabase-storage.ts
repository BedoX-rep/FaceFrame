import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Extract Supabase project URL from DATABASE_URL
// Format: postgresql://postgres.{project}:{password}@aws-0-{region}.pooler.supabase.com:6543/postgres
const databaseUrl = process.env.DATABASE_URL;
const match = databaseUrl.match(/postgres\.(\w+):/);
if (!match) {
  throw new Error("Could not extract project ID from DATABASE_URL");
}
const projectId = match[1];
const supabaseUrl = `https://${projectId}.supabase.co`;

// For now we'll use the service role key for server-side operations
// In production, you'd want to use service role key from environment
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdmtweWZkbWZrZWpqaWN1YXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0Mjg0MzUsImV4cCI6MjA3MjAwNDQzNX0.X7xOFMJjWgHZ_BLEKw3Gu0jhR6qNSDGvABmUvr5pVTw"; // This should be from environment

const supabase = createClient(supabaseUrl, supabaseKey);

export interface UploadedImage {
  fileName: string;
  publicUrl: string;
}

export class SupabaseStorageService {
  private bucketName = 'eyeglass-frames';

  async ensureBucketExists(): Promise<void> {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      throw new Error('Failed to check bucket existence');
    }

    const bucketExists = buckets?.some(bucket => bucket.name === this.bucketName);

    if (!bucketExists) {
      // Create the bucket
      const { error: createError } = await supabase.storage.createBucket(this.bucketName, {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg'],
        fileSizeLimit: 5242880 // 5MB
      });

      if (createError) {
        console.error('Error creating bucket:', createError);
        throw new Error('Failed to create storage bucket');
      }

      console.log(`Created bucket: ${this.bucketName}`);
    }
  }

  async uploadImage(localPath: string, fileName: string): Promise<UploadedImage> {
    await this.ensureBucketExists();

    try {
      // Read the local file
      const fileBuffer = readFileSync(localPath);
      
      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(fileName, fileBuffer, {
          contentType: 'image/png',
          upsert: true
        });

      if (error) {
        console.error('Error uploading file:', error);
        throw new Error(`Failed to upload ${fileName}: ${error.message}`);
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from(this.bucketName)
        .getPublicUrl(fileName);

      return {
        fileName: fileName,
        publicUrl: publicUrlData.publicUrl
      };
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }
}

export const storageService = new SupabaseStorageService();