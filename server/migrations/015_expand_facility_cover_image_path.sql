BEGIN;

ALTER TABLE facilities
    ALTER COLUMN cover_image_path TYPE TEXT;

COMMIT;
