BEGIN;

ALTER TABLE knowledge_bases
    ADD COLUMN IF NOT EXISTS scope_type VARCHAR(20) NOT NULL DEFAULT 'file',
    ADD COLUMN IF NOT EXISTS facility_id INTEGER REFERENCES facilities(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS source_file_id INTEGER REFERENCES model_files(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

ALTER TABLE knowledge_bases
    ALTER COLUMN file_id DROP NOT NULL;

ALTER TABLE knowledge_bases
    DROP CONSTRAINT IF EXISTS knowledge_bases_file_id_fkey;

ALTER TABLE knowledge_bases
    ADD CONSTRAINT knowledge_bases_file_id_fkey
    FOREIGN KEY (file_id) REFERENCES model_files(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_bases_facility_id
    ON knowledge_bases(facility_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_bases_scope_status
    ON knowledge_bases(scope_type, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_bases_active_facility
    ON knowledge_bases(facility_id)
    WHERE scope_type = 'facility' AND status = 'active' AND facility_id IS NOT NULL;

COMMIT;
