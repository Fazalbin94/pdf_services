 
-- First, ensure all records have a file_path (update any nulls if they exist)
UPDATE pdfs.letterheads 
SET file_path = COALESCE(file_path, 'temp/' || id || '.tmp')
WHERE file_path IS NULL OR file_path = '';

-- Make file_path NOT NULL
ALTER TABLE pdfs.letterheads 
ALTER COLUMN file_path SET NOT NULL;

-- Now we can safely remove the URL columns
ALTER TABLE pdfs.letterheads 
DROP COLUMN IF EXISTS file_url,
DROP COLUMN IF EXISTS thumbnail_url;

-- Create index on file_path (if it doesn't exist)
CREATE INDEX IF NOT EXISTS letterheads_file_path_idx 
ON pdfs.letterheads(file_path);

-- Update any remaining records with empty paths (safety check)
UPDATE pdfs.letterheads 
SET file_path = 'legacy/' || id || '.legacy'
WHERE file_path = '' OR file_path IS NULL;

-- Verify the migration
DO $$
BEGIN
    -- Check that file_url column is gone
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'pdfs' 
        AND table_name = 'letterheads' 
        AND column_name = 'file_url'
    ) THEN
        RAISE EXCEPTION 'file_url column still exists';
    END IF;
    
    -- Check that file_path is not null
    IF EXISTS (
        SELECT 1 
        FROM pdfs.letterheads 
        WHERE file_path IS NULL OR file_path = ''
    ) THEN
        RAISE EXCEPTION 'Found null or empty file_path values';
    END IF;
    
    RAISE NOTICE 'Migration completed successfully';
END $$;