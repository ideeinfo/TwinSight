BEGIN;

CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid() NOT NULL,
    facility_id INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    file_id INTEGER NOT NULL REFERENCES model_files(id) ON DELETE CASCADE,
    ticket_no VARCHAR(64) NOT NULL UNIQUE,
    title VARCHAR(200),
    description TEXT NOT NULL,
    priority VARCHAR(16) NOT NULL DEFAULT 'medium',
    status VARCHAR(16) NOT NULL DEFAULT 'new',
    source_type VARCHAR(16) NOT NULL DEFAULT 'manual',
    source_space_code VARCHAR(100) NOT NULL,
    assignee_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    completed_at TIMESTAMP NULL,
    closed_at TIMESTAMP NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT tickets_priority_check CHECK (priority IN ('low', 'medium', 'high')),
    CONSTRAINT tickets_status_check CHECK (status IN ('new', 'completed', 'closed')),
    CONSTRAINT tickets_source_type_check CHECK (source_type IN ('manual', 'space', 'asset'))
);

CREATE TABLE IF NOT EXISTS ticket_assets (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (ticket_id, asset_id)
);

CREATE TABLE IF NOT EXISTS ticket_attachments (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    mime_type VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tickets_facility_status ON tickets(facility_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_file_id ON tickets(file_id);
CREATE INDEX IF NOT EXISTS idx_tickets_source_space_code ON tickets(source_space_code);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee_user_id ON tickets(assignee_user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_assets_ticket_id ON ticket_assets(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_assets_asset_id ON ticket_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON ticket_attachments(ticket_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_uuid ON tickets(uuid);

DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;
