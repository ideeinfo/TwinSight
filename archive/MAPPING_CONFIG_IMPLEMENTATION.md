# 映射配置数据库持久化实施指南

## 📌 当前状态

### ✅ 已完成
1. ✅ 数据库表结构设计 (`create_mapping_config.sql`)
2. ✅ 后端数据模型 (`mapping-config.js`)
3. ✅ API 路由 (`GET/POST /api/mapping-config/:fileId`)  
4. ✅ SearchableSelect 下拉组件优化
5. ✅ 重置功能改进
6. ✅ 数据库迁移执行完成
7. ✅ 外键约束添加到 `model_files` 表
8. ✅ 前端 API 服务创建 (`src/services/mapping-config.js`)
9. ✅ 属性列表提取问题修复（排除根节点）

### 🔧 待完成
1. ~~执行数据库迁移~~ ✅ 已完成
2. **修改 DataExportPanel.vue** ⬅️ 下一步
3. ~~修复属性列表显示问题~~ ✅ 已完成

---

## 步骤 1: 执行数据库迁移

### 方法A：使用脚本（推荐）
```bash
cd server
node scripts/run_create_mapping_config.js
```

### 方法B：手动执行SQL
连接到PostgreSQL数据库，执行 `server/db/migrations/create_mapping_config.sql`

### 验证
```sql
\d mapping_configs
SELECT * FROM mapping_configs LIMIT 1;
```

---

## 步骤 2: 修改前端代码

### 2.1 创建映射配置API服务

**文件**: `src/services/mapping-config.js` (新建)

```javascript
const API_BASE = 'http://localhost:3000/api';

/**
 * 获取文件的映射配置
 * @param {number} fileId - 文件ID
 * @returns {Promise<Object>}
 */
export async function getMappingConfig(fileId) {
  try {
    const response = await fetch(`${API_BASE}/mapping-config/${fileId}`);
    const data = await response.json();
    if (data.success) {
      return data.data;
    }
    throw new Error(data.error || '获取映射配置失败');
  } catch (error) {
    console.error('获取映射配置失败:', error);
    // 返回默认配置
    return getDefaultMapping();
  }
}

/**
 * 保存文件的映射配置
 * @param {number} fileId - 文件ID
 * @param {Object} config - 配置对象
 * @returns {Promise<void>}
 */
export async function saveMappingConfig(fileId, config) {
  const response = await fetch(`${API_BASE}/mapping-config/${fileId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(config)
  });
  
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || '保存映射配置失败');
  }
  
  return data;
}

/**
 * 获取默认映射配置
 */
function getDefaultMapping() {
  return {
    assetMapping: {
      assetCode: { category: '文字', property: 'MC编码' },
      specCode: { category: '标识数据', property: '类型注释' },
      name: { category: '标识数据', property: '名称' },
      floor: { category: '约束', property: '标高' },
      room: { category: '房间', property: '名称' }
    },
    assetSpecMapping: {
      specCode: { category: '标识数据', property: '类型注释' },
      specName: { category: '标识数据', property: '类型名称' },
      classificationCode: { category: '数据', property: 'Classification.OmniClass.21.Number' },
      classificationDesc: { category: '数据', property: 'Classification.OmniClass.21.Description' },
      category: { category: '其他', property: '类别' },
      family: { category: '其他', property: '族' },
      type: { category: '其他', property: '类型' },
      manufacturer: { category: '标识数据', property: '制造商' },
      address: { category: '标识数据', property: '地址' },
      phone: { category: '标识数据', property: '联系人电话' }
    },
    spaceMapping: {
      spaceCode: { category: '标识数据', property: '编号' },
      name: { category: '标识数据', property: '名称' },
      classificationCode: { category: '数据', property: 'Classification.OmniClass.21.Number' },
      classificationDesc: { category: '数据', property: 'Classification.OmniClass.21.Description' }
    }
  };
}
```

### 2.2 修改 DataExportPanel.vue

**需要修改的部分**:

1. **导入API服务**
```javascript
import { getMappingConfig, saveMappingConfig } from '../services/mapping-config.js';
```

2. **从数据库加载配置（替换localStorage）**
```javascript
// 打开映射配置面板
async function openMappingConfig() {
  // 获取属性列表
  if (props.getAssetPropertyList) {
    assetPropertyOptions.value = await props.getAssetPropertyList();
  }
  if (props.getSpacePropertyList) {
    spacePropertyOptions.value = await props.getSpacePropertyList();
  }

  // 从数据库加载映射配置
  if (props.fileId) {
    try {
      const config = await getMappingConfig(props.fileId);
      if (config.assetMapping && Object.keys(config.assetMapping).length > 0) {
        assetMapping.value = config.assetMapping;
      }
      if (config.assetSpecMapping && Object.keys(config.assetSpecMapping).length > 0) {
        assetSpecMapping.value = config.assetSpecMapping;
      }
      if (config.spaceMapping && Object.keys(config.spaceMapping).length > 0) {
        spaceMapping.value = config.spaceMapping;
      }
      console.log('✅ 已加载文件映射配置');
    } catch (error) {
      console.warn('加载映射配置失败，使用默认配置:', error);
    }
  }

  showMappingConfig.value = true;
}
```

3. **保存到数据库（替换localStorage）**
```javascript
// 保存映射配置
async function handleSaveMapping(newMappings) {
  assetMapping.value = newMappings.assetMapping;
  assetSpecMapping.value = newMappings.assetSpecMapping;
  spaceMapping.value = newMappings.spaceMapping;
  
  // 保存到数据库
  if (props.fileId) {
    try {
      await saveMappingConfig(props.fileId, {
        assetMapping: newMappings.assetMapping,
        assetSpecMapping: newMappings.assetSpecMapping,
        spaceMapping: newMappings.spaceMapping
      });
      console.log('✅ 映射配置已保存到数据库');
    } catch (error) {
      console.error('保存映射配置失败:', error);
      alert('保存配置失败: ' + error.message);
    }
  }
}
```

4. **删除 localStorage 相关代码**
```javascript
// 删除 onMounted 中的 localStorage 加载逻辑
// 删除 handleSaveMapping 中的 localStorage 保存逻辑
```

---

## 步骤 3: 修复属性列表显示问题

### 问题分析
属性下拉列表只显示当前分类下的属性：
```javascript
:options="assetPropertyOptions[mapping.category] || []"
```

### 解决方案A: 显示所有属性（推荐）

修改 `MappingConfigPanel.vue`:

```javascript
// 添加计算属性：所有属性的扁平列表
const allAssetProperties = computed(() => {
  const props = new Set();
  Object.values(assetPropertyOptions.value).forEach(categoryProps => {
    categoryProps.forEach(prop => props.add(prop));
  });
  return Array.from(props).sort();
});

const allSpaceProperties = computed(() => {
  const props = new Set();
  Object.values(spacePropertyOptions.value).forEach(categoryProps => {
    categoryProps.forEach(prop => props.add(prop));
  });
  return Array.from(props).sort();
});
```

然后在模板中使用：
```html
<SearchableSelect
  v-model="mapping.property"
  :options="allAssetProperties"
  placeholder="属性名"
/>
```

### 解决方案B: 提供切换选项

添加一个开关，让用户选择：
- 只显示当前分类下的属性
- 显示所有属性

---

## 步骤 4: 测试流程

### 4.1 测试映射配置保存和加载
1. 打开文件
2. 点击"配置映射"
3. 修改某些映射
4. 点击"保存"
5. 关闭配置面板
6. 重新打开配置面板
7. 验证配置已保存

### 4.2 测试不同文件的配置隔离
1. 打开文件A，设置映射配置并保存
2. 打开文件B，设置不同的映射配置并保存
3. 重新打开文件A，验证配置是文件A的配置
4. 重新打开文件B，验证配置是文件B的配置

### 4.3 测试数据导出
1. 配置映射后
2. 点击"提取并导出"
3. 验证数据正确导出
4. 检查数据库中的数据

---

## 注意事项

1. **fileId 必须存在**: 确保 DataExportPanel 接收到有效的 fileId
2. **向后兼容**: 如果数据库中没有配置，使用默认配置
3. **错误处理**: 网络错误时要有友好的提示
4. **性能**: 映射配置较小，不需要缓存优化

---

## 下一步建议

1. ✅ 先执行数据库迁移
2. ✅ 创建 mapping-config.js 服务文件
3. ✅ 修改 DataExportPanel.vue
4. ✅ 测试基本功能
5. ✅ 优化属性列表显示
6. ✅ 进行完整测试
