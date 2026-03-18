BEGIN;

ALTER TABLE document_folders
    ADD COLUMN IF NOT EXISTS facility_id INTEGER REFERENCES facilities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_document_folders_facility_id
    ON document_folders(facility_id);

CREATE INDEX IF NOT EXISTS idx_document_folders_facility_parent
    ON document_folders(facility_id, parent_id);

COMMENT ON COLUMN document_folders.facility_id IS '文件夹所属设施ID';

WITH RECURSIVE folder_tree AS (
    SELECT f.id AS root_id, f.id AS folder_id
    FROM document_folders f
    UNION ALL
    SELECT ft.root_id, child.id AS folder_id
    FROM folder_tree ft
    JOIN document_folders child ON child.parent_id = ft.folder_id
),
folder_facility_candidates AS (
    SELECT
        ft.root_id AS folder_id,
        array_agg(DISTINCT d.facility_id) FILTER (WHERE d.facility_id IS NOT NULL) AS facility_ids
    FROM folder_tree ft
    LEFT JOIN documents d ON d.folder_id = ft.folder_id
    GROUP BY ft.root_id
),
single_facility_folders AS (
    SELECT
        folder_id,
        facility_ids[1] AS facility_id
    FROM folder_facility_candidates
    WHERE COALESCE(array_length(facility_ids, 1), 0) = 1
)
UPDATE document_folders f
SET facility_id = s.facility_id
FROM single_facility_folders s
WHERE f.id = s.folder_id
  AND f.facility_id IS NULL;

COMMIT;
