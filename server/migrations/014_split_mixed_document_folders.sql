BEGIN;

WITH mixed_folders AS (
    SELECT
        d.folder_id,
        array_agg(DISTINCT d.facility_id) FILTER (WHERE d.facility_id IS NOT NULL) AS facility_ids
    FROM documents d
    WHERE d.folder_id IS NOT NULL
    GROUP BY d.folder_id
    HAVING COUNT(DISTINCT d.facility_id) FILTER (WHERE d.facility_id IS NOT NULL) > 1
),
folder_targets AS (
    SELECT
        f.id AS original_folder_id,
        f.name,
        f.parent_id,
        f.path,
        unnest(mf.facility_ids) AS facility_id
    FROM mixed_folders mf
    JOIN document_folders f ON f.id = mf.folder_id
),
inserted AS (
    INSERT INTO document_folders (name, parent_id, path, facility_id, created_at, updated_at)
    SELECT
        ft.name,
        ft.parent_id,
        ft.path,
        ft.facility_id,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM folder_targets ft
    WHERE NOT EXISTS (
        SELECT 1
        FROM document_folders existing
        WHERE existing.name = ft.name
          AND existing.path = ft.path
          AND existing.parent_id IS NOT DISTINCT FROM ft.parent_id
          AND existing.facility_id = ft.facility_id
    )
    RETURNING id, name, parent_id, path, facility_id
),
target_folders AS (
    SELECT
        ft.original_folder_id,
        existing.id AS scoped_folder_id,
        ft.facility_id
    FROM folder_targets ft
    JOIN document_folders existing
      ON existing.name = ft.name
     AND existing.path = ft.path
     AND existing.parent_id IS NOT DISTINCT FROM ft.parent_id
     AND existing.facility_id = ft.facility_id
)
UPDATE documents d
SET folder_id = tf.scoped_folder_id
FROM target_folders tf
WHERE d.folder_id = tf.original_folder_id
  AND d.facility_id = tf.facility_id;

WITH single_facility_folders AS (
    SELECT
        d.folder_id,
        MIN(d.facility_id) AS facility_id
    FROM documents d
    WHERE d.folder_id IS NOT NULL
      AND d.facility_id IS NOT NULL
    GROUP BY d.folder_id
    HAVING COUNT(DISTINCT d.facility_id) = 1
)
UPDATE document_folders f
SET facility_id = s.facility_id
FROM single_facility_folders s
WHERE f.id = s.folder_id
  AND f.facility_id IS NULL;

DELETE FROM document_folders f
WHERE f.facility_id IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM documents d
      WHERE d.folder_id = f.id
  );

COMMIT;
