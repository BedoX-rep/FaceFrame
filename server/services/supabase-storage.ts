import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Use the direct Supabase URL since we know the project
const supabaseUrl = 'https://rlvkpyfdmfkejjicuayb.supabase.co';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is required");
}

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export interface UploadedImage {
  fileName: string;
  publicUrl: string;
}

export class SupabaseStorageService {
  private bucketName = 'eyeglass-frames';

  async ensureBucketExists(): Promise<void> {
    try {
      // Try to list files in the bucket to check if it exists
      const { data, error } = await supabase.storage.from(this.bucketName).list('', { limit: 1 });
      
      if (error && error.message.includes('not found')) {
        // Bucket doesn't exist, create it
        const { error: createError } = await supabase.storage.createBucket(this.bucketName, {
          public: true,
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg'],
          fileSizeLimit: 5242880 // 5MB
        });

        if (createError) {
          console.error('Error creating bucket:', createError);
          // If creation fails, try uploading anyway - bucket might exist
        } else {
          console.log(`Created bucket: ${this.bucketName}`);
        }
      } else if (error) {
        console.warn('Bucket check warning:', error);
        // Continue anyway - bucket might exist
      }
    } catch (err) {
      console.warn('Bucket existence check failed, continuing anyway:', err);
      // Continue - the upload might work even if we can't check
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