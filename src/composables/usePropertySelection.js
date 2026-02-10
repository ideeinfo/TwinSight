/**
 * usePropertySelection.js
 * 
 * 提取并复用资产/空间属性选择逻辑
 * 用于解决 AppViewer.vue 代码冗余及 RDS 视图属性显示不全的问题
 */

const VARIES_VALUE = '__VARIES__';

export function usePropertySelection() {

    /**
     * 格式化单个资产属性
     * @param {Object} asset - 原始资产对象 (来自 assetList)
     * @returns {Object} - RightPanel 所需的属性对象
     */
    const formatAssetProperties = (asset) => {
        if (!asset) return null;

        return {
            name: asset.name || '',
            mcCode: asset.mcCode || asset.asset_code || asset.code || '',
            level: asset.floor || '',
            room: asset.room || '',
            // 类型属性映射 (支持 snake_case 和 camelCase)
            omniClass21Number: asset.classification_code || asset.classificationCode || '',
            omniClass21Description: asset.classification_desc || asset.classificationDesc || '',
            category: asset.category || '',
            family: asset.family || '',
            type: asset.type || '',
            // 注意: RightPanel 中用 typeComments 字段来绑定 specCode 的编辑
            typeComments: asset.spec_code || asset.specCode || '',
            specName: asset.spec_name || asset.specName || '',
            manufacturer: asset.manufacturer || '',
            address: asset.address || '',
            phone: asset.phone || ''
        };
    };

    /**
     * 格式化单个空间属性
     * @param {Object} space - 原始空间对象 (来自 roomList)
     * @returns {Object} - RightPanel 所需的属性对象
     */
    const formatSpaceProperties = (space) => {
        if (!space) return null;

        return {
            name: space.name || '',
            code: space.code || '',
            floor: space.floor || '',
            area: space.area,
            perimeter: space.perimeter,
            // 空间分类属性
            spaceNumber: space.classificationCode || '',     // 对应 omniClass21Number
            spaceDescription: space.classificationDesc || '', // 对应 omniClass21Description
            omniClass21Number: space.classificationCode || '',
            omniClass21Description: space.classificationDesc || ''
        };
    };

    /**
     * 判断两个值是否逻辑相等
     */
    const isSameValue = (v1, v2) => {
        const normalize = (v) => (v == null || v === '') ? '' : String(v);
        return normalize(v1) === normalize(v2);
    };

    /**
     * 合并多个属性对象 (处理 VARIES)
     * @param {Array<Object>} propsArray - 已格式化的属性对象数组
     * @returns {Object} - 合并后的属性对象
     */
    const mergeProperties = (propsArray) => {
        if (!propsArray || propsArray.length === 0) return null;
        if (propsArray.length === 1) return propsArray[0];

        const mergedProps = { ...propsArray[0], isMultiple: true };
        const keys = Object.keys(mergedProps).filter(k => k !== 'isMultiple');

        let allVaries = false;

        for (let i = 1; i < propsArray.length; i++) {
            if (allVaries) break;

            const current = propsArray[i];
            const base = propsArray[0];
            let stillConsistent = false;

            for (const key of keys) {
                if (mergedProps[key] !== VARIES_VALUE) {
                    if (!isSameValue(base[key], current[key])) {
                        mergedProps[key] = VARIES_VALUE;
                    } else {
                        stillConsistent = true;
                    }
                }
            }

            if (!stillConsistent) {
                // 如果除去 isMultiple 外的所有字段都不同，标记全为 varies
                allVaries = keys.every(key => mergedProps[key] === VARIES_VALUE);
            }
        }

        return mergedProps;
    };

    /**
     * 根据 dbIds 获取并格式化属性 (通用入口)
     * @param {Array} dbIds - 选中的数据库 ID
     * @param {Array} dataList - 数据源列表 (assetList 或 roomList)
     * @param {String} type - 'asset' | 'space'
     * @returns {Object} - 最终属性对象
     */
    const getPropertiesFromSelection = (dbIds, dataList, type = 'asset') => {
        if (!dbIds || dbIds.length === 0 || !dataList) return null;

        const formatter = type === 'asset' ? formatAssetProperties : formatSpaceProperties;
        // 查找并转换
        const selectedItems = dbIds.map(id => dataList.find(item => item.dbId === id)).filter(Boolean);

        if (selectedItems.length === 0) return null;

        if (selectedItems.length === 1) {
            return formatter(selectedItems[0]);
        } else {
            const allProps = selectedItems.map(formatter);
            return mergeProperties(allProps);
        }
    };

    return {
        formatAssetProperties,
        formatSpaceProperties,
        mergeProperties,
        getPropertiesFromSelection
    };
}
