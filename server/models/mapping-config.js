import { query, getClient } from '../db/index.js';

/**
 * 获取文件的映射配置
 * @param {number} fileId - 文件ID
 * @returns {Promise<Object>} 包含 assetMapping, assetSpecMapping, spaceMapping
 */
export async function getMappingConfig(fileId) {
    const client = await getClient();
    try {
        const result = await client.query(
            'SELECT config_type, field_name, category, property FROM mapping_configs WHERE file_id = $1',
            [fileId]
        );

        // 将数据库记录转换为前端需要的格式
        const config = {
            assetMapping: {},
            assetSpecMapping: {},
            spaceMapping: {}
        };

        result.rows.forEach(row => {
            const mapping = { category: row.category, property: row.property };

            if (row.config_type === 'asset') {
                config.assetMapping[row.field_name] = mapping;
            } else if (row.config_type === 'asset_spec') {
                config.assetSpecMapping[row.field_name] = mapping;
            } else if (row.config_type === 'space') {
                config.spaceMapping[row.field_name] = mapping;
            }
        });

        return config;
    } finally {
        client.release();
    }
}

/**
 * 保存文件的映射配置
 * @param {number} fileId - 文件ID
 * @param {Object} config - 包含 assetMapping, assetSpecMapping, spaceMapping
 * @returns {Promise<void>}
 */
export async function saveMappingConfig(fileId, config) {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        // 删除旧配置
        await client.query('DELETE FROM mapping_configs WHERE file_id = $1', [fileId]);

        // 插入新配置
        const insertPromises = [];

        // 资产映射
        if (config.assetMapping) {
            for (const [fieldName, mapping] of Object.entries(config.assetMapping)) {
                insertPromises.push(
                    client.query(
                        'INSERT INTO mapping_configs (file_id, config_type, field_name, category, property) VALUES ($1, $2, $3, $4, $5)',
                        [fileId, 'asset', fieldName, mapping.category, mapping.property]
                    )
                );
            }
        }

        // 资产规格映射
        if (config.assetSpecMapping) {
            for (const [fieldName, mapping] of Object.entries(config.assetSpecMapping)) {
                insertPromises.push(
                    client.query(
                        'INSERT INTO mapping_configs (file_id, config_type, field_name, category, property) VALUES ($1, $2, $3, $4, $5)',
                        [fileId, 'asset_spec', fieldName, mapping.category, mapping.property]
                    )
                );
            }
        }

        // 空间映射
        if (config.spaceMapping) {
            for (const [fieldName, mapping] of Object.entries(config.spaceMapping)) {
                insertPromises.push(
                    client.query(
                        'INSERT INTO mapping_configs (file_id, config_type, field_name, category, property) VALUES ($1, $2, $3, $4, $5)',
                        [fileId, 'space', fieldName, mapping.category, mapping.property]
                    )
                );
            }
        }

        await Promise.all(insertPromises);
        await client.query('COMMIT');

        console.log(`✅ 已保存文件 ${fileId} 的映射配置`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('保存映射配置失败:', error);
        throw error;
    } finally {
        client.release();
    }
}
