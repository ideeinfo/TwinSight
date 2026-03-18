BEGIN;

ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS facility_id INTEGER REFERENCES facilities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_facility_id ON documents(facility_id);

COMMENT ON COLUMN documents.facility_id IS '文档所属设施ID';

UPDATE documents d
SET facility_id = src.facility_id
FROM (
    SELECT
        d1.id AS document_id,
        mf.facility_id
    FROM documents d1
    JOIN LATERAL (
        SELECT a.file_id
        FROM assets a
        JOIN model_files mf2 ON mf2.id = a.file_id
        WHERE d1.asset_code IS NOT NULL
          AND a.asset_code = d1.asset_code
          AND mf2.facility_id IS NOT NULL
        ORDER BY mf2.is_active DESC, a.updated_at DESC NULLS LAST, a.id DESC
        LIMIT 1
    ) match_file ON TRUE
    JOIN model_files mf ON mf.id = match_file.file_id
    WHERE d1.facility_id IS NULL
) src
WHERE d.id = src.document_id
  AND d.facility_id IS NULL;

UPDATE documents d
SET facility_id = src.facility_id
FROM (
    SELECT
        d1.id AS document_id,
        mf.facility_id
    FROM documents d1
    JOIN LATERAL (
        SELECT s.file_id
        FROM spaces s
        JOIN model_files mf2 ON mf2.id = s.file_id
        WHERE d1.space_code IS NOT NULL
          AND s.space_code = d1.space_code
          AND mf2.facility_id IS NOT NULL
        ORDER BY mf2.is_active DESC, s.updated_at DESC NULLS LAST, s.id DESC
        LIMIT 1
    ) match_file ON TRUE
    JOIN model_files mf ON mf.id = match_file.file_id
    WHERE d1.facility_id IS NULL
) src
WHERE d.id = src.document_id
  AND d.facility_id IS NULL;

UPDATE documents d
SET facility_id = src.facility_id
FROM (
    SELECT
        d1.id AS document_id,
        mf.facility_id
    FROM documents d1
    JOIN LATERAL (
        SELECT s.file_id
        FROM asset_specs s
        JOIN model_files mf2 ON mf2.id = s.file_id
        WHERE d1.spec_code IS NOT NULL
          AND s.spec_code = d1.spec_code
          AND mf2.facility_id IS NOT NULL
        ORDER BY mf2.is_active DESC, s.updated_at DESC NULLS LAST, s.id DESC
        LIMIT 1
    ) match_file ON TRUE
    JOIN model_files mf ON mf.id = match_file.file_id
    WHERE d1.facility_id IS NULL
) src
WHERE d.id = src.document_id
  AND d.facility_id IS NULL;

UPDATE documents d
SET facility_id = src.facility_id
FROM (
    SELECT
        d1.id AS document_id,
        mf.facility_id
    FROM documents d1
    JOIN public.views v ON v.id = d1.view_id
    JOIN model_files mf ON mf.id = v.file_id
    WHERE d1.facility_id IS NULL
      AND d1.view_id IS NOT NULL
      AND mf.facility_id IS NOT NULL
) src
WHERE d.id = src.document_id
  AND d.facility_id IS NULL;

COMMIT;
