-- 创建视图管理表
-- 存储模型的显示状态快照

CREATE TABLE IF NOT EXISTS views (
  id SERIAL PRIMARY KEY,
  file_id INTEGER NOT NULL REFERENCES model_files(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  thumbnail TEXT,  -- Base64编码的缩略图
  
  -- Forge Viewer状态数据
  camera_state JSONB,       -- 摄像机位置和视角
  isolation_state JSONB,    -- 构件隐藏/显示状态 (hiddenNodes, isolatedNodes)
  selection_state JSONB,    -- 构件选中状态 (selectedDbIds)
  theming_state JSONB,      -- 构件材质颜色覆盖
  environment VARCHAR(100), -- 环境主题名称
  cutplanes JSONB,          -- 剖切面状态
  explode_scale FLOAT,      -- 爆炸视图比例
  render_options JSONB,     -- 渲染选项(AO, shadows等)
  other_settings JSONB,     -- 其他扩展设置
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- 同一文件下视图名称唯一
  CONSTRAINT uq_views_file_name UNIQUE(file_id, name)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_views_file_id ON views(file_id);
CREATE INDEX IF NOT EXISTS idx_views_name ON views(name);
CREATE INDEX IF NOT EXISTS idx_views_created ON views(created_at DESC);

-- 添加注释
COMMENT ON TABLE views IS '模型视图状态快照表';
COMMENT ON COLUMN views.file_id IS '关联的模型文件ID';
COMMENT ON COLUMN views.name IS '视图名称';
COMMENT ON COLUMN views.thumbnail IS 'Base64编码的缩略图';
COMMENT ON COLUMN views.camera_state IS 'Forge Viewer摄像机状态';
COMMENT ON COLUMN views.isolation_state IS '构件隐藏/显示/隔离状态';
COMMENT ON COLUMN views.selection_state IS '构件选中状态';
COMMENT ON COLUMN views.theming_state IS '构件材质颜色覆盖';
COMMENT ON COLUMN views.environment IS '环境光照主题';
COMMENT ON COLUMN views.cutplanes IS '剖切面配置';
COMMENT ON COLUMN views.explode_scale IS '爆炸视图比例';
COMMENT ON COLUMN views.render_options IS '渲染选项';
