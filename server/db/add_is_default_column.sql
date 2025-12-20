-- Add is_default column to views table
-- This column indicates if a view is the default view for a file
-- Only one view per file can be set as default

ALTER TABLE views ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;

-- Create a partial unique index to ensure only one default view per file
-- This index only includes rows where is_default = TRUE
CREATE UNIQUE INDEX IF NOT EXISTS idx_views_default_per_file 
ON views(file_id) 
WHERE is_default = TRUE;

-- Add comment
COMMENT ON COLUMN views.is_default IS '是否为该文件的默认视图';
