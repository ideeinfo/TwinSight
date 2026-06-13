-- Points module: unified sensor, energy and video point registry.

CREATE TABLE IF NOT EXISTS points (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid(),
    facility_id INTEGER REFERENCES facilities(id) ON DELETE SET NULL,
    file_id INTEGER NOT NULL REFERENCES model_files(id) ON DELETE CASCADE,
    point_code VARCHAR(120) NOT NULL,
    name VARCHAR(200) NOT NULL,
    point_type VARCHAR(40) NOT NULL DEFAULT 'temperature',
    data_kind VARCHAR(20) NOT NULL DEFAULT 'scalar',
    target_type VARCHAR(20) NOT NULL DEFAULT 'space',
    target_code VARCHAR(200) NOT NULL,
    unit VARCHAR(40),
    multiplier DECIMAL(15, 6) DEFAULT 1,
    protocol VARCHAR(40) DEFAULT 'http',
    source_url TEXT,
    threshold_min DECIMAL(15, 4),
    threshold_max DECIMAL(15, 4),
    is_enabled BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT points_data_kind_check CHECK (data_kind IN ('scalar', 'video')),
    CONSTRAINT points_target_type_check CHECK (target_type IN ('space', 'asset')),
    CONSTRAINT points_point_type_check CHECK (point_type IN (
        'temperature',
        'humidity',
        'illuminance',
        'displacement',
        'vibration',
        'energy',
        'electricity',
        'water',
        'gas',
        'video'
    )),
    UNIQUE (file_id, point_code)
);

CREATE INDEX IF NOT EXISTS idx_points_file_id ON points(file_id);
CREATE INDEX IF NOT EXISTS idx_points_facility_id ON points(facility_id);
CREATE INDEX IF NOT EXISTS idx_points_target ON points(file_id, target_type, target_code);
CREATE INDEX IF NOT EXISTS idx_points_type ON points(file_id, point_type);

CREATE OR REPLACE FUNCTION update_points_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_points_updated_at ON points;
CREATE TRIGGER trigger_update_points_updated_at
    BEFORE UPDATE ON points
    FOR EACH ROW
    EXECUTE FUNCTION update_points_updated_at();
