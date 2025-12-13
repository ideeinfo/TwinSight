/**
 * Document EXIF Model
 * 图像文件 EXIF 元数据模型
 */
import db from '../db/index.js';

const documentExifModel = {
    /**
     * 创建 EXIF 记录
     * @param {Object} exifData - EXIF 数据
     */
    async createExif(exifData) {
        const {
            documentId,
            // 文件组
            dateTime,
            imageWidth,
            imageHeight,
            // 照相机组
            equipModel,
            fNumber,
            exposureTime,
            isoSpeed,
            focalLength,
            // GPS组
            gpsLongitude,
            gpsLatitude,
            gpsAltitude
        } = exifData;

        const result = await db.query(
            `INSERT INTO document_exif (
                document_id,
                date_time, image_width, image_height,
                equip_model, f_number, exposure_time, iso_speed, focal_length,
                gps_longitude, gps_latitude, gps_altitude
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (document_id) DO UPDATE SET
                date_time = EXCLUDED.date_time,
                image_width = EXCLUDED.image_width,
                image_height = EXCLUDED.image_height,
                equip_model = EXCLUDED.equip_model,
                f_number = EXCLUDED.f_number,
                exposure_time = EXCLUDED.exposure_time,
                iso_speed = EXCLUDED.iso_speed,
                focal_length = EXCLUDED.focal_length,
                gps_longitude = EXCLUDED.gps_longitude,
                gps_latitude = EXCLUDED.gps_latitude,
                gps_altitude = EXCLUDED.gps_altitude,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *`,
            [
                documentId,
                dateTime || null,
                imageWidth || null,
                imageHeight || null,
                equipModel || null,
                fNumber || null,
                exposureTime || null,
                isoSpeed || null,
                focalLength || null,
                gpsLongitude || null,
                gpsLatitude || null,
                gpsAltitude || null
            ]
        );

        return result.rows[0];
    },

    /**
     * 根据文档ID获取 EXIF 信息
     * @param {number} documentId - 文档ID
     */
    async getExifByDocumentId(documentId) {
        const result = await db.query(
            'SELECT * FROM document_exif WHERE document_id = $1',
            [documentId]
        );
        return result.rows[0] || null;
    },

    /**
     * 删除 EXIF 记录（通常通过级联删除自动完成）
     * @param {number} documentId - 文档ID
     */
    async deleteExifByDocumentId(documentId) {
        const result = await db.query(
            'DELETE FROM document_exif WHERE document_id = $1 RETURNING *',
            [documentId]
        );
        return result.rows[0];
    },

    /**
     * 获取带有 EXIF 信息的文档列表
     * @param {Object} filter - 筛选条件
     */
    async getDocumentsWithExif(filter = {}) {
        let query = `
            SELECT d.*, e.date_time, e.image_width, e.image_height,
                   e.equip_model, e.f_number, e.exposure_time, e.iso_speed, e.focal_length,
                   e.gps_longitude, e.gps_latitude, e.gps_altitude
            FROM documents d
            LEFT JOIN document_exif e ON d.id = e.document_id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (filter.assetCode) {
            query += ` AND d.asset_code = $${paramIndex++}`;
            params.push(filter.assetCode);
        }
        if (filter.spaceCode) {
            query += ` AND d.space_code = $${paramIndex++}`;
            params.push(filter.spaceCode);
        }
        if (filter.specCode) {
            query += ` AND d.spec_code = $${paramIndex++}`;
            params.push(filter.specCode);
        }

        query += ' ORDER BY d.created_at DESC';

        const result = await db.query(query, params);
        return result.rows;
    },

    /**
     * 格式化 EXIF 数据为分组结构
     * @param {Object} exif - 原始 EXIF 数据
     */
    formatExifGroups(exif) {
        if (!exif) return null;

        return {
            file: {
                label: '文件',
                properties: [
                    { key: 'date_time', label: '拍摄时间', value: exif.date_time },
                    { key: 'image_width', label: '图像宽度', value: exif.image_width, unit: 'px' },
                    { key: 'image_height', label: '图像高度', value: exif.image_height, unit: 'px' }
                ]
            },
            camera: {
                label: '照相机',
                properties: [
                    { key: 'equip_model', label: '照相机型号', value: exif.equip_model },
                    { key: 'f_number', label: '光圈值', value: exif.f_number ? `f/${exif.f_number}` : null },
                    { key: 'exposure_time', label: '曝光时间', value: exif.exposure_time },
                    { key: 'iso_speed', label: 'ISO速度', value: exif.iso_speed },
                    { key: 'focal_length', label: '焦距', value: exif.focal_length, unit: 'mm' }
                ]
            },
            gps: {
                label: 'GPS',
                properties: [
                    { key: 'gps_longitude', label: 'GPS经度', value: exif.gps_longitude },
                    { key: 'gps_latitude', label: 'GPS纬度', value: exif.gps_latitude },
                    { key: 'gps_altitude', label: 'GPS高度', value: exif.gps_altitude, unit: 'm' }
                ]
            }
        };
    }
};

export default documentExifModel;
