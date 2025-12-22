/**
 * useDataExport Composable
 * 
 * 从 MainView.vue 提取的数据导出逻辑
 * 包含资产和空间数据的提取、映射和导出功能
 */

import { Ref } from 'vue';

// 英文 -> 中文分类名称映射
const CATEGORY_MAP: Record<string, string> = {
    'Identity Data': '标识数据',
    'Constraints': '约束',
    'Phasing': '阶段化',
    'Dimensions': '尺寸',
    'Construction': '构造',
    'Materials and Finishes': '材质和装饰',
    'Structural': '结构',
    'Mechanical': '机械',
    'Electrical': '电气',
    'Plumbing': '管道',
    'Fire Protection': '消防',
    'Text': '文字',
    'Graphics': '图形',
    'Data': '数据',
    'Other': '其他',
    'Room': '房间',
    'Analytical Properties': '分析属性',
    'Green Building Properties': '绿色建筑属性',
    'IFC Parameters': 'IFC参数',
    'Structural Analysis': '结构分析'
};

/**
 * 数据映射配置类型
 */
export interface MappingConfig {
    category: string;
    property: string;
}

export interface AssetMappings {
    assetMapping: Record<string, MappingConfig>;
    assetSpecMapping: Record<string, MappingConfig>;
}

export interface AssetData {
    dbId: number;
    name?: string;
    mcCode?: string;
    floor?: string;
    room?: string;
    omniClass21Number?: string;
    omniClass21Description?: string;
    category?: string;
    family?: string;
    type?: string;
    typeComments?: string;
    manufacturer?: string;
    address?: string;
    phone?: string;
    [key: string]: any;
}

export interface SpaceData {
    dbId: number;
    spaceCode?: string;
    name?: string;
    classificationCode?: string;
    classificationDesc?: string;
    floor?: string;
    area?: string;
    perimeter?: string;
    [key: string]: any;
}

export interface PropertyList {
    [category: string]: string[];
}

/**
 * useDataExport composable
 * 
 * @param viewerRef - 对 Autodesk Viewer 实例的引用
 * @param foundRoomDbIds - 已发现的房间 dbId 列表（响应式引用或普通数组）
 */
export function useDataExport(
    viewerRef: Ref<any> | (() => any),
    foundRoomDbIds: Ref<number[]> | (() => number[])
) {
    // 获取 viewer 实例的辅助函数
    const getViewer = () => {
        if (typeof viewerRef === 'function') return viewerRef();
        return viewerRef?.value ?? viewerRef;
    };

    // 获取房间 ID 列表的辅助函数
    const getRoomDbIds = (): number[] => {
        if (typeof foundRoomDbIds === 'function') return foundRoomDbIds();
        return (foundRoomDbIds as Ref<number[]>)?.value ?? (foundRoomDbIds as unknown as number[]) ?? [];
    };

    /**
     * 获取完整的资产数据（用于导出到数据库）
     */
    const getFullAssetData = async (): Promise<AssetData[]> => {
        const viewer = getViewer();
        if (!viewer || !viewer.model) return [];

        const instanceTree = viewer.model.getInstanceTree();
        if (!instanceTree) return [];

        const allDbIds: number[] = [];
        instanceTree.enumNodeChildren(instanceTree.getRootId(), (dbId: number) => {
            allDbIds.push(dbId);
        }, true);

        const assets: AssetData[] = [];

        for (const dbId of allDbIds) {
            try {
                const props = await new Promise<AssetData | null>((resolve) => {
                    viewer.getProperties(dbId, (result: any) => {
                        if (!result || !result.properties) {
                            resolve(null);
                            return;
                        }

                        const assetData: AssetData = {
                            dbId,
                            name: '',
                            mcCode: '',
                            floor: '',
                            room: '',
                            omniClass21Number: '',
                            omniClass21Description: '',
                            category: '',
                            family: '',
                            type: '',
                            typeComments: '',
                            manufacturer: '',
                            address: '',
                            phone: ''
                        };

                        result.properties.forEach((prop: any) => {
                            const name = prop.displayName;
                            const category = prop.displayCategory;
                            const value = prop.displayValue || '';

                            if ((category === '标识数据' || category === 'Identity Data') && (name === '名称' || name === 'Name')) {
                                assetData.name = value;
                            } else if (name === 'MC编码' || name === 'MC Code') {
                                assetData.mcCode = value;
                            } else if (name === '楼层' || name === 'Level') {
                                assetData.floor = value;
                            } else if ((category === '房间' || category === 'Room') && (name === '名称' || name === 'Name')) {
                                assetData.room = value;
                            } else if (name === 'Classification.OmniClass.21.Number') {
                                assetData.omniClass21Number = value;
                            } else if (name === 'Classification.OmniClass.21.Description') {
                                assetData.omniClass21Description = value;
                            } else if (name === '类别' || name === 'Category') {
                                assetData.category = value;
                            } else if (name === '族' || name === 'Family') {
                                assetData.family = value;
                            } else if (name === '类型' || name === 'Type') {
                                assetData.type = value;
                            } else if (name === '类型注释' || name === 'Type Comments') {
                                assetData.typeComments = value;
                            } else if (name === '制造商' || name === 'Manufacturer') {
                                assetData.manufacturer = value;
                            } else if (name === '地址' || name === 'Address') {
                                assetData.address = value;
                            } else if (name === '电话' || name === 'Phone') {
                                assetData.phone = value;
                            }
                        });

                        if (assetData.mcCode) {
                            resolve(assetData);
                        } else {
                            resolve(null);
                        }
                    });
                });

                if (props) {
                    assets.push(props);
                }
            } catch (e) {
                console.error('获取资产属性失败:', e);
            }
        }

        console.log(`📊 已提取 ${assets.length} 个资产数据`);
        return assets;
    };

    /**
     * 获取完整的空间数据（用于导出到数据库）
     */
    const getFullSpaceData = async (): Promise<SpaceData[]> => {
        const viewer = getViewer();
        const roomDbIds = getRoomDbIds();

        if (!viewer || !viewer.model || roomDbIds.length === 0) return [];

        const spaces: SpaceData[] = [];

        for (const dbId of roomDbIds) {
            try {
                const props = await new Promise<SpaceData | null>((resolve) => {
                    viewer.getProperties(dbId, (result: any) => {
                        if (!result || !result.properties) {
                            resolve(null);
                            return;
                        }

                        const spaceData: SpaceData = {
                            dbId,
                            spaceCode: '',
                            name: result.name || '',
                            classificationCode: '',
                            classificationDesc: '',
                            floor: '',
                            area: '',
                            perimeter: ''
                        };

                        result.properties.forEach((prop: any) => {
                            const name = prop.displayName || prop.attributeName;
                            const value = prop.displayValue;

                            if (name === '编号' || name === 'Number' || name === 'Mark') {
                                spaceData.spaceCode = value;
                            } else if (name === '名称' || name === 'Name') {
                                if (!spaceData.name) spaceData.name = value;
                            } else if (name === 'Classification.Space.Number') {
                                spaceData.classificationCode = value;
                            } else if (name === 'Classification.Space.Description') {
                                spaceData.classificationDesc = value;
                            } else if (name === '标高' || name === 'Level') {
                                spaceData.floor = value;
                            } else if (name === '面积' || name === 'Area') {
                                spaceData.area = value;
                            } else if (name === '周长' || name === 'Perimeter') {
                                spaceData.perimeter = value;
                            }
                        });

                        if (spaceData.spaceCode) {
                            resolve(spaceData);
                        } else {
                            resolve(null);
                        }
                    });
                });

                if (props) {
                    spaces.push(props);
                }
            } catch (e) {
                console.error('获取空间属性失败:', e);
            }
        }

        console.log(`📊 已提取 ${spaces.length} 个空间数据`);
        return spaces;
    };

    /**
     * 使用映射配置获取完整的资产数据（新版本，支持灵活映射）
     */
    const getFullAssetDataWithMapping = async (mappings: AssetMappings): Promise<AssetData[]> => {
        const viewer = getViewer();
        if (!viewer || !viewer.model) return [];

        const instanceTree = viewer.model.getInstanceTree();
        if (!instanceTree) return [];

        const assetMapping = mappings?.assetMapping;
        const assetSpecMapping = mappings?.assetSpecMapping;

        if (!assetMapping || !assetSpecMapping) {
            console.error('❌ 映射配置参数错误:', { assetMapping, assetSpecMapping });
            return [];
        }

        const allDbIds: number[] = [];
        instanceTree.enumNodeChildren(instanceTree.getRootId(), (dbId: number) => {
            allDbIds.push(dbId);
        }, true);

        console.log(`🔍 开始提取资产数据，共 ${allDbIds.length} 个构件`);

        const fullMapping = { ...assetMapping, ...assetSpecMapping };
        console.log('📋 合并后的映射配置字段:', Object.keys(fullMapping));

        const tempTable: AssetData[] = [];
        let firstAssetLogged = false;

        for (const dbId of allDbIds) {
            try {
                const row = await new Promise<AssetData | null>((resolve) => {
                    viewer.getProperties(dbId, (result: any) => {
                        if (!result || !result.properties) {
                            resolve(null);
                            return;
                        }

                        const rowData: AssetData = { dbId };

                        Object.keys(fullMapping).forEach(field => {
                            rowData[field] = '';
                        });

                        // 处理元数据分类
                        Object.entries(fullMapping).forEach(([field, mapping]) => {
                            if (mapping.category === '元数据') {
                                if (mapping.property === 'Name' && result.name) {
                                    rowData[field] = result.name;
                                } else if (mapping.property === 'externalId' && result.externalId) {
                                    rowData[field] = result.externalId;
                                } else if (mapping.property === 'dbId') {
                                    rowData[field] = String(dbId);
                                }
                            }
                        });

                        // 遍历所有属性
                        result.properties.forEach((prop: any) => {
                            const displayName = prop.displayName || '';
                            const attributeName = prop.attributeName || '';
                            const category = prop.displayCategory || '';
                            const value = prop.displayValue || '';

                            Object.entries(fullMapping).forEach(([field, mapping]) => {
                                if (rowData[field] && rowData[field] !== '') return;

                                const targetCategory = mapping.category;
                                const targetProperty = mapping.property;

                                const categoryMatch = category === targetCategory;
                                const nameMatch = displayName === targetProperty || attributeName === targetProperty;

                                if (categoryMatch && nameMatch) {
                                    rowData[field] = value;
                                    return;
                                }

                                if (targetProperty.includes('.') && nameMatch) {
                                    rowData[field] = value;
                                    return;
                                }

                                if (nameMatch) {
                                    if (targetCategory === '其他' || !['名称', 'Name'].includes(targetProperty)) {
                                        rowData[field] = value;
                                    }
                                }
                            });
                        });

                        // specCode 备用查找
                        if (!rowData['specCode'] && !rowData['typeComments']) {
                            const typeParams = result.properties.find((p: any) =>
                                p.displayName === '类型注释' || p.displayName === 'Type Comments' ||
                                p.attributeName === 'Type Comments');
                            if (typeParams && fullMapping.specCode) {
                                rowData['specCode'] = typeParams.displayValue;
                            }
                        }

                        if ((rowData as any).assetCode && !firstAssetLogged) {
                            console.log(`\n📋 第一个有MC编码的构件 (dbId: ${dbId}) 的所有属性:`);
                            const propsTable = result.properties.map((p: any) => ({
                                分类: p.displayCategory || '(无)',
                                显示名: p.displayName || '(无)',
                                属性名: p.attributeName || '(无)',
                                值: p.displayValue || ''
                            }));
                            console.table(propsTable);
                            firstAssetLogged = true;
                        }

                        if ((rowData as any).assetCode) {
                            resolve(rowData);
                        } else {
                            resolve(null);
                        }
                    });
                });

                if (row) {
                    tempTable.push(row);
                }
            } catch (e) {
                console.error('获取资产属性失败:', e);
            }
        }

        console.log(`✅ 提取完成: ${tempTable.length} 个资产（临时表）`);

        if (tempTable.length > 0) {
            console.log('📋 前3条资产数据示例:');
            console.table(tempTable.slice(0, 3));
        }

        return tempTable;
    };

    /**
     * 使用映射配置获取完整的空间数据（新版本，支持灵活映射）
     */
    const getFullSpaceDataWithMapping = async (spaceMapping: Record<string, MappingConfig>): Promise<SpaceData[]> => {
        const viewer = getViewer();
        const roomDbIds = getRoomDbIds();

        if (!viewer || !viewer.model || roomDbIds.length === 0) {
            console.warn('⚠️ 没有找到房间数据或模型未加载');
            return [];
        }

        console.log(`🔍 开始提取空间数据，共 ${roomDbIds.length} 个房间`);

        const spaces: SpaceData[] = [];

        // 调试：打印第一个房间的属性
        if (roomDbIds.length > 0) {
            const firstDbId = roomDbIds[0];
            await new Promise<void>((resolve) => {
                viewer.getProperties(firstDbId, (result: any) => {
                    if (result && result.properties) {
                        console.log(`📋 第一个房间的前20个属性 (dbId: ${firstDbId}):`);
                        const sample = result.properties.slice(0, 20).map((p: any) => ({
                            分类: p.displayCategory,
                            名称: p.displayName,
                            属性名: p.attributeName,
                            值: p.displayValue
                        }));
                        console.table(sample);
                    }
                    resolve();
                });
            });
        }

        for (const dbId of roomDbIds) {
            try {
                const spaceData = await new Promise<SpaceData | null>((resolve) => {
                    viewer.getProperties(dbId, (result: any) => {
                        if (!result || !result.properties) {
                            resolve(null);
                            return;
                        }

                        const data: SpaceData = { dbId };

                        Object.keys(spaceMapping).forEach(field => {
                            data[field] = '';
                        });

                        // 处理元数据
                        Object.entries(spaceMapping).forEach(([field, mapping]) => {
                            if (mapping.category === '元数据') {
                                if (mapping.property === 'Name' && result.name) {
                                    data[field] = result.name;
                                } else if (mapping.property === 'externalId' && result.externalId) {
                                    data[field] = result.externalId;
                                } else if (mapping.property === 'dbId') {
                                    data[field] = String(dbId);
                                }
                            }
                        });

                        // 遍历属性
                        result.properties.forEach((prop: any) => {
                            const displayName = prop.displayName || '';
                            const attributeName = prop.attributeName || '';
                            const category = prop.displayCategory || '';
                            const value = prop.displayValue || '';

                            Object.entries(spaceMapping).forEach(([field, mapping]) => {
                                const targetCategory = mapping.category;
                                const targetProperty = mapping.property;

                                const nameMatch = displayName === targetProperty || attributeName === targetProperty;
                                const isSpecialProperty = targetProperty.includes('.');

                                let shouldMatch = false;
                                if (isSpecialProperty) {
                                    shouldMatch = nameMatch;
                                } else {
                                    const categoryMatch = category === targetCategory;
                                    shouldMatch = categoryMatch && nameMatch;
                                }

                                if (shouldMatch) {
                                    data[field] = value;
                                }
                            });
                        });

                        if (!data.name && result.name) {
                            data.name = result.name;
                        }

                        if (data.spaceCode) {
                            resolve(data);
                        } else {
                            console.warn(`⚠️ 房间 ${dbId} 没有找到空间编号，请检查 spaceMapping 配置。房间名称: ${data.name || result.name}`);
                            data.spaceCode = `SPACE_${dbId}`;
                            resolve(data);
                        }
                    });
                });

                if (spaceData) {
                    spaces.push(spaceData);
                }
            } catch (e) {
                console.error('获取空间属性失败:', e);
            }
        }

        console.log(`✅ 提取完成: ${spaces.length} 个空间`);

        if (spaces.length > 0) {
            console.log('📋 前3条空间数据示例:');
            console.table(spaces.slice(0, 3));
        }

        return spaces;
    };

    /**
     * 获取资产的所有可用属性结构（用于填充映射配置下拉框）
     */
    const getAssetPropertyList = async (): Promise<PropertyList> => {
        const viewer = getViewer();
        if (!viewer || !viewer.model) return {};

        return new Promise((resolve) => {
            const tree = viewer.model.getInstanceTree();
            if (!tree) {
                resolve({});
                return;
            }

            const rootId = tree.getRootId();
            const dbIds: number[] = [];

            tree.enumNodeChildren(rootId, (dbId: number) => {
                if (dbId !== rootId) {
                    dbIds.push(dbId);
                }
            }, true);

            console.log(`📋 开始提取属性列表，构件总数: ${dbIds.length}（已排除根节点 ${rootId}）`);

            viewer.model.getBulkProperties(dbIds, null, (results: any[]) => {
                console.log(`📋 getBulkProperties 返回结果数: ${results.length}`);

                const categories: Record<string, Set<string>> = {};
                const categoryStats: Record<string, number> = {};

                results.forEach(res => {
                    if (!res.properties) return;

                    res.properties.forEach((prop: any) => {
                        const originalCat = prop.displayCategory || '其他';
                        let cat = CATEGORY_MAP[originalCat] || originalCat;

                        let name = prop.displayName || prop.attributeName;
                        if (!name || name.trim() === '') return;

                        if (!categories[cat]) {
                            categories[cat] = new Set();
                            categoryStats[cat] = 0;
                        }

                        const added = !categories[cat].has(name);
                        categories[cat].add(name);

                        if (added) {
                            categoryStats[cat]++;
                        }
                    });
                });

                const formatted: PropertyList = {};
                const sortedCategories = Object.keys(categories).sort();

                sortedCategories.forEach(cat => {
                    formatted[cat] = Array.from(categories[cat]).sort();
                });

                console.log(`📋 已提取资产属性结构: ${sortedCategories.length} 个分类`);

                // 添加元数据分类
                formatted['元数据'] = ['Name', 'externalId', 'dbId'];
                console.log('📋 已添加特殊分类 "元数据": Name, externalId, dbId');

                resolve(formatted);
            }, (err: any) => {
                console.error('获取属性列表失败:', err);
                resolve({});
            });
        });
    };

    /**
     * 获取空间的所有可用属性结构
     */
    const getSpacePropertyList = async (): Promise<PropertyList> => {
        const viewer = getViewer();
        const roomDbIds = getRoomDbIds();

        if (!viewer || !viewer.model || roomDbIds.length === 0) return {};

        return new Promise((resolve) => {
            console.log(`📋 开始提取空间属性列表，房间总数: ${roomDbIds.length}`);

            viewer.model.getBulkProperties(roomDbIds, null, (results: any[]) => {
                const categories: Record<string, Set<string>> = {};
                const categoryStats: Record<string, number> = {};

                results.forEach(res => {
                    if (!res.properties) return;

                    res.properties.forEach((prop: any) => {
                        const originalCat = prop.displayCategory || '其他';
                        let cat = CATEGORY_MAP[originalCat] || originalCat;

                        let name = prop.displayName || prop.attributeName;
                        if (!name || name.trim() === '') return;

                        if (!categories[cat]) {
                            categories[cat] = new Set();
                            categoryStats[cat] = 0;
                        }

                        const added = !categories[cat].has(name);
                        categories[cat].add(name);

                        if (added) {
                            categoryStats[cat]++;
                        }
                    });
                });

                const formatted: PropertyList = {};
                const sortedCategories = Object.keys(categories).sort();

                sortedCategories.forEach(cat => {
                    formatted[cat] = Array.from(categories[cat]).sort();
                });

                console.log(`📋 已提取空间属性结构: ${sortedCategories.length} 个分类`);

                formatted['元数据'] = ['Name', 'externalId', 'dbId'];
                console.log('📋 已添加特殊分类 "元数据": Name, externalId, dbId');

                resolve(formatted);
            }, (err: any) => {
                console.error('获取空间属性列表失败:', err);
                resolve({});
            });
        });
    };

    return {
        getFullAssetData,
        getFullSpaceData,
        getFullAssetDataWithMapping,
        getFullSpaceDataWithMapping,
        getAssetPropertyList,
        getSpacePropertyList
    };
}
