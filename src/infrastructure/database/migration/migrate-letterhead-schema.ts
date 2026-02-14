 import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function migrateLetterheadSchema() {
  console.log('Starting letterhead schema migration...');
  
  try {
    console.log('Adding new columns to letterheads table...');
  
    const migrationSteps = [
      // Step 1: Add new columns to letterheads table
      // IMPORTANT: Use "pdfs" schema (not "pdf")
      `ALTER TABLE "pdfs"."letterheads" 
       ADD COLUMN IF NOT EXISTS file_path TEXT,
       ADD COLUMN IF NOT EXISTS thumbnail_path TEXT,
       ADD COLUMN IF NOT EXISTS paper_size "pdfs"."PageSize" DEFAULT 'A4',
       ADD COLUMN IF NOT EXISTS orientation "pdfs"."Orientation" DEFAULT 'PORTRAIT',
       ADD COLUMN IF NOT EXISTS margins JSONB DEFAULT '{"top":57.6,"right":18,"bottom":36,"left":18}',
       ADD COLUMN IF NOT EXISTS safe_zones JSONB,
       ADD COLUMN IF NOT EXISTS brand_colors TEXT[] DEFAULT '{}',
       ADD COLUMN IF NOT EXISTS primary_font VARCHAR(50),
       ADD COLUMN IF NOT EXISTS secondary_font VARCHAR(50),
       ADD COLUMN IF NOT EXISTS dimensions_unit "pdfs"."DimensionsUnit" DEFAULT 'POINTS',
       ADD COLUMN IF NOT EXISTS color_profile "pdfs"."ColorProfile" DEFAULT 'RGB',
       ADD COLUMN IF NOT EXISTS has_bleed_area BOOLEAN DEFAULT false,
       ADD COLUMN IF NOT EXISTS bleed_area_size INTEGER,
       ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE,
       ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES "pdfs"."letterheads"(id),
       ADD COLUMN IF NOT EXISTS version VARCHAR(20) DEFAULT '1.0.0'`,
      
      // Step 2: Add unique constraint AFTER populating data
      // We'll add this constraint later after data migration
      
      // Step 3: Create indexes
      `CREATE INDEX IF NOT EXISTS idx_letterheads_file_path ON "pdfs"."letterheads"(file_path)`,
      `CREATE INDEX IF NOT EXISTS idx_letterheads_last_used ON "pdfs"."letterheads"(last_used_at)`,
      `CREATE INDEX IF NOT EXISTS idx_letterheads_parent ON "pdfs"."letterheads"(parent_id)`,
    ];
    
    // Execute schema changes
    console.log('Executing schema changes...');
    for (const step of migrationSteps) {
      try {
        await prisma.$executeRawUnsafe(step);
        console.log(`Executed: ${step.substring(0, 100)}...`);
      } catch (error) {
        console.error(`Error executing step: ${error}`);
      }
    }
    
    // 2. Migrate existing file URLs to paths
    console.log('\nMigrating existing file URLs to paths...');
    
    // First, get ALL letterheads to check fileUrl
    const allLetterheads = await prisma.letterhead.findMany();
    console.log(`Found ${allLetterheads.length} letterheads to process`);
    
    let migratedCount = 0;
    for (const letterhead of allLetterheads) {
      if (letterhead.fileUrl) {
        const filePath = extractFilePath(letterhead.fileUrl);
        const thumbnailPath = letterhead.thumbnailUrl 
          ? extractFilePath(letterhead.thumbnailUrl)
          : null;
        
        // Use raw SQL to update since Prisma doesn't know about new columns yet
        await prisma.$executeRaw`
          UPDATE "pdfs"."letterheads" 
          SET 
            file_path = ${filePath},
            thumbnail_path = ${thumbnailPath},
            brand_colors = ARRAY['#000000', '#FFFFFF']::TEXT[],
            paper_size = CASE 
              WHEN width >= 595 AND height >= 842 THEN 'A4' 
              WHEN width >= 612 AND height >= 792 THEN 'LETTER'
              ELSE 'A4' 
            END,
            dimensions_unit = 'POINTS'
          WHERE id = ${letterhead.id}::UUID
        `;
        
        migratedCount++;
        if (migratedCount % 10 === 0) {
          console.log(`Migrated ${migratedCount} letterheads...`);
        }
      }
    }
    
    console.log(`Successfully migrated ${migratedCount} letterheads`);
    
    // 3. Update fileType for SVG files
    console.log('\nUpdating file types for SVG files...');
    const svgUpdateResult = await prisma.$executeRaw`
      UPDATE "pdfs"."letterheads" 
      SET file_type = 'SVG'
      WHERE mime_type = 'image/svg+xml' 
        AND file_type = 'IMAGE'
    `;
    console.log(`Updated ${svgUpdateResult} SVG files`);
    
    // 4. Add unique constraint on file_path AFTER data is populated
    console.log('\nAdding unique constraint on file_path...');
    try {
      await prisma.$executeRaw`
        ALTER TABLE "pdfs"."letterheads" 
        ADD CONSTRAINT unique_file_path UNIQUE (file_path)
      `;
      console.log('Added unique constraint on file_path');
    } catch (error) {
      console.warn('Could not add unique constraint (may already exist or have duplicates):', error);
    }
    
    // 5. Clean up: Remove NULL file_path entries
    console.log('\nCleaning up NULL file_path entries...');
    const nullCleanup = await prisma.$executeRaw`
      UPDATE "pdfs"."letterheads" 
      SET file_path = 'legacy-' || id::TEXT
      WHERE file_path IS NULL
    `;
    console.log(`Fixed ${nullCleanup} NULL file_path entries`);
    
    console.log('\nSchema migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

function extractFilePath(url: string): string {
  try {
    // Extract path from Supabase URL
    // Example: https://xxx.supabase.co/storage/v1/object/public/pdf-service/letterheads/user/file.png
    // Should return: letterheads/user/file.png
    
    // Remove query parameters if any
    const cleanUrl = url.split('?')[0];
    const urlObj = new URL(cleanUrl);
    const pathParts = urlObj.pathname.split('/');
    
    // Find the storage path after the bucket name
    // Pattern: /storage/v1/object/public/{bucket-name}/{path}
    const objectIndex = pathParts.indexOf('object');
    
    if (objectIndex !== -1 && objectIndex + 2 < pathParts.length) {
      // Skip 'object' and 'public' (or 'private' for signed URLs)
      const startIndex = objectIndex + 2;
      return pathParts.slice(startIndex).join('/');
    }
    
    // Alternative: Look for 'letterheads/' in the path
    const letterheadsIndex = pathParts.findIndex(part => part === 'letterheads');
    if (letterheadsIndex !== -1) {
      return pathParts.slice(letterheadsIndex).join('/');
    }
    
    // Fallback: extract filename
    const filename = pathParts[pathParts.length - 1];
    return `letterheads/legacy/${filename}`;
    
  } catch (error) {
    console.warn(`Failed to parse URL: ${url}`, error);
    // Generate a safe fallback path
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `letterheads/legacy/${timestamp}-${random}`;
  }
}

// Run migration
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateLetterheadSchema()
    .then(() => {
      console.log('Migration script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}


export { migrateLetterheadSchema };