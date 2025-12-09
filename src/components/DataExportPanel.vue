<template>
  <div class="data-export-panel">
    <div class="panel-header">
      <h3>📦 {{ $t('dataExport.title') }}</h3>
      <span class="status-badge" :class="apiStatus">
        {{ apiStatus === 'connected' ? $t('dataExport.connected') : apiStatus === 'checking' ? $t('dataExport.checking') : $t('dataExport.disconnected') }}
      </span>
    </div>

    <div class="panel-content">
      <div class="info-section">
        <p>{{ $t('dataExport.description') }}</p>
      </div>

      <div class="stats-section" v-if="extractionStats">
        <div class="stat-item">
          <span class="stat-value">{{ extractionStats.assets }}</span>
          <span class="stat-label">{{ $t('dataExport.assets') }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ extractionStats.spaces }}</span>
          <span class="stat-label">{{ $t('dataExport.spaces') }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ extractionStats.specs }}</span>
          <span class="stat-label">{{ $t('dataExport.specs') }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ extractionStats.classifications }}</span>
          <span class="stat-label">{{ $t('dataExport.classifications') }}</span>
        </div>
      </div>

      <div class="actions-section">
        <button 
          class="btn btn-primary" 
          @click="extractAndExport" 
          :disabled="isExporting || apiStatus !== 'connected'"
        >
          <span v-if="isExporting" class="spinner"></span>
          {{ isExporting ? $t('dataExport.exporting') : $t('dataExport.extractAndExport') }}
        </button>
        
        <button 
          class="btn btn-secondary" 
          @click="checkConnection"
          :disabled="apiStatus === 'checking'"
        >
          {{ $t('dataExport.checkConnection') }}
        </button>
        
        <button 
          class="btn btn-config" 
          @click="openMappingConfig"
        >
          🔧 配置映射
        </button>
      </div>

      <!-- 映射配置弹窗 -->
      <MappingConfigPanel
        v-if="showMappingConfig"
        :assetMapping="assetMapping"
        :assetSpecMapping="assetSpecMapping"
        :spaceMapping="spaceMapping"
        :assetPropertyOptions="assetPropertyOptions"
        :spacePropertyOptions="spacePropertyOptions"
        @close="showMappingConfig = false"
        @save="handleSaveMapping"
      />

      <div class="result-section" v-if="exportResult">
        <div class="result-message" :class="exportResult.success ? 'success' : 'error'">
          <span class="icon">{{ exportResult.success ? '✅' : '❌' }}</span>
          <span>{{ exportResult.message }}</span>
        </div>
        <div class="result-details" v-if="exportResult.summary">
          <ul>
            <li>{{ $t('dataExport.classifications') }}: {{ exportResult.summary.classifications }}</li>
            <li>{{ $t('dataExport.specs') }}: {{ exportResult.summary.specs }}</li>
            <li>{{ $t('dataExport.assets') }}: {{ exportResult.summary.assets }}</li>
            <li>{{ $t('dataExport.spaces') }}: {{ exportResult.summary.spaces }}</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, toRaw } from 'vue';
import { useI18n } from 'vue-i18n';
import { checkApiHealth, importModelData } from '../services/postgres.js';
import MappingConfigPanel from './MappingConfigPanel.vue';

const { t } = useI18n();

// Props
const props = defineProps({
  fileId: { type: Number, default: null },
  getFullAssetData: { type: Function, default: null },
  getFullSpaceData: { type: Function, default: null },
  getAssetPropertyList: { type: Function, default: null },
  getSpacePropertyList: { type: Function, default: null },
  getFullAssetDataWithMapping: { type: Function, default: null },
  getFullSpaceDataWithMapping: { type: Function, default: null }
});

// 状态
const apiStatus = ref('checking');
const isExporting = ref(false);
const extractionStats = ref(null);
const exportResult = ref(null);
const showMappingConfig = ref(false);

// 映射配置（根据实际模型属性调整）
const assetMapping = ref({
  assetCode: { category: '文字', property: 'MC编码' },
  specCode: { category: '标识数据', property: '类型注释' }, 
  name: { category: '标识数据', property: '名称' },
  floor: { category: '约束', property: '标高' },
  room: { category: '房间', property: '名称' }
});

const assetSpecMapping = ref({
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
});

const spaceMapping = ref({
  spaceCode: { category: '标识数据', property: '编号' },
  name: { category: '标识数据', property: '名称' },
  classificationCode: { category: '数据', property: 'Classification.OmniClass.21.Number' },
  classificationDesc: { category: '数据', property: 'Classification.OmniClass.21.Description' }
});

// 属性选项（从模型提取）
const assetPropertyOptions = ref({});
const spacePropertyOptions = ref({});

// 打开映射配置面板
async function openMappingConfig() {
  // 获取属性列表
  if (props.getAssetPropertyList) {
    console.log('🔍 正在提取资产属性列表...');
    try {
      assetPropertyOptions.value = await props.getAssetPropertyList();
    } catch (e) {
      console.error('提取资产属性列表失败:', e);
    }
  }
  
  if (props.getSpacePropertyList) {
    console.log('🔍 正在提取空间属性列表...');
    try {
      spacePropertyOptions.value = await props.getSpacePropertyList();
    } catch (e) {
      console.error('提取空间属性列表失败:', e);
    }
  }

  showMappingConfig.value = true;
}

// 检查 API 连接
async function checkConnection() {
  apiStatus.value = 'checking';
  try {
    const isHealthy = await checkApiHealth();
    apiStatus.value = isHealthy ? 'connected' : 'disconnected';
  } catch {
    apiStatus.value = 'disconnected';
  }
}

// 保存映射配置
function handleSaveMapping(newMappings) {
  assetMapping.value = newMappings.assetMapping;
  assetSpecMapping.value = newMappings.assetSpecMapping;
  spaceMapping.value = newMappings.spaceMapping;
  
  // 保存到 localStorage
  try {
    localStorage.setItem('assetMapping', JSON.stringify(newMappings.assetMapping));
    localStorage.setItem('assetSpecMapping', JSON.stringify(newMappings.assetSpecMapping));
    localStorage.setItem('spaceMapping', JSON.stringify(newMappings.spaceMapping));
    console.log('✅ 映射配置已保存');
  } catch (e) {
    console.error('保存映射配置失败:', e);
  }
}


// 提取并导出数据
async function extractAndExport() {
  if (!props.getFullAssetDataWithMapping || !props.getFullSpaceDataWithMapping) {
    exportResult.value = { success: false, message: '函数未提供，请确保模型已加载' };
    return;
  }

  isExporting.value = true;
  exportResult.value = null;

  try {
    console.log('📊 开始提取数据...');
    
    // 调试：打印映射配置
    console.log('📋 assetMapping:', assetMapping.value);
    console.log('📋 assetSpecMapping:', assetSpecMapping.value);
    console.log('📋 spaceMapping:', spaceMapping.value);
    
    // 使用 JSON 深度克隆，彻底解决响应式对象传递问题
    const assetMappingPlain = JSON.parse(JSON.stringify(assetMapping.value));
    const assetSpecMappingPlain = JSON.parse(JSON.stringify(assetSpecMapping.value));
    const spaceMappingPlain = JSON.parse(JSON.stringify(spaceMapping.value));
    
    console.log('📋 JSON克隆后的 assetMapping:', assetMappingPlain);
    console.log('📋 JSON克隆后的 assetSpecMapping:', assetSpecMappingPlain);
    console.log('📋 类型检查:', {
      assetMapping: typeof assetMappingPlain,
      assetSpecMapping: typeof assetSpecMappingPlain,
      keys1: Object.keys(assetMappingPlain || {}),
      keys2: Object.keys(assetSpecMappingPlain || {})
    });
    
    // 调试：检查 props 函数
    console.log('📋 检查 props 函数:', {
      hasFn: !!props.getFullAssetDataWithMapping,
      fnType: typeof props.getFullAssetDataWithMapping,
      fn: props.getFullAssetDataWithMapping
    });
    
    // 直接调用，不通过变量
    console.log('📋 准备调用函数...');
    const tempTable = await props.getFullAssetDataWithMapping({
      assetMapping: JSON.parse(JSON.stringify(assetMapping.value)),
      assetSpecMapping: JSON.parse(JSON.stringify(assetSpecMapping.value))
    });
    const spaces = await props.getFullSpaceDataWithMapping(
      JSON.parse(JSON.stringify(spaceMapping.value))
    );

    console.log(`✅ 提取完成: ${tempTable.length} 个资产, ${spaces.length} 个空间`);
    
    // 调试：打印前3条临时表数据
    console.log('📋 临时表前3条数据（所有字段）:');
    console.table(tempTable.slice(0, 3));
    
    // 调试：打印前3条空间数据（使用JSON格式）
    console.log('📋 空间数据前3条（JSON）:');
    console.log(JSON.stringify(spaces.slice(0, 3), null, 2));
    
    // 检查 spaceCode 字段
    const spacesWithCode = spaces.filter(s => s.spaceCode);
    const spacesWithoutCode = spaces.filter(s => !s.spaceCode);
    console.log(`⚠️ 空间统计: 总数=${spaces.length}, 有spaceCode=${spacesWithCode.length}, 无spaceCode=${spacesWithoutCode.length}`);
    
    // 检查空间分类字段
    const spacesWithClass = spaces.filter(s => s.classificationCode);
    console.log(`⚠️ 空间分类统计: 有classificationCode=${spacesWithClass.length}`);
    if (spaces.length > 0) {
      console.log('📋 第一个空间的完整数据:');
      console.log(JSON.stringify(spaces[0], null, 2));
    }



    // 从临时表构建资产规格数据
    const specsMap = new Map();
    tempTable.forEach(row => {
      if (row.specCode && !specsMap.has(row.specCode)) {
        specsMap.set(row.specCode, {
          specCode: row.specCode,
          specName: row.specName || '',
          classificationCode: row.classificationCode || '',
          classificationDesc: row.classificationDesc || '',
          category: row.category || '',
          family: row.family || '',
          type: row.type || '',
          manufacturer: row.manufacturer || '',
          address: row.address || '',
          phone: row.phone || ''
        });
      }
    });

    // 从临时表构建资产数据
    const assets = tempTable.map(row => ({
      dbId: row.dbId,
      mcCode: row.assetCode,
      typeComments: row.specCode,
      typeName: row.specName || '',
      name: row.name,
      floor: row.floor,
      room: row.room,
      omniClass21Number: row.classificationCode || '',
      omniClass21Description: row.classificationDesc || '',
      category: row.category || '',
      family: row.family || '',
      type: row.type || '',
      manufacturer: row.manufacturer || '',
      address: row.address || '',
      phone: row.phone || ''
    }));

    // 计算统计信息
    const classificationsSet = new Set([
      ...Array.from(specsMap.values()).map(s => s.classificationCode).filter(Boolean),
      ...spaces.map(s => s.classificationCode).filter(Boolean)
    ]);

    extractionStats.value = {
      assets: assets.length,
      spaces: spaces.length,
      specs: specsMap.size,
      classifications: classificationsSet.size
    };

    // 发送到后端
    console.log('📤 正在准备发送数据到数据库...');

    // 1. 检查文件是否已存在数据 (如果有关联的文件ID)
    if (props.fileId) {
       // 此处可以加一个接口检查数据是否存在，但为了简单，我们可以在这里直接弹窗确认
       // 或者让后端处理 Upsert (已实现)。
       // 用户需求：如果已经存在，提示并先删除。
       
       // 由于后端目前是 Upsert 逻辑（On Conflict Update），这已经是在“更新”数据。
       // 但用户明确要求“先删除”，可能是为了清除那些在模型中已被删除但数据库中还残留的数据。
       


       // 调用删除接口 (需要新加或复用)
       // 目前没有独立的删除接口，但我们可以通过特定的标志或新接口来实现。
       // 暂时通过 importModelData 的参数控制，或者由后端 importModelData 内部处理
       // 这里我们修改 importModelData 让其支持 'overwrite' 模式，或者分两步：先删后存
    }

    // 更新：为了满足用户"先删除后导入"的需求，我们需要确保后端支持清除旧数据
    // 我们将在 importModelData 调用中传递一个 clearBeforeImport 标记 (需要后端支持，或分步调用)
    
    // 由于后端 importModelData 目前逻辑是 Upsert，我们保持其逻辑。
    // 为了实现"先删除"，我们可以调用一个专门的清理接口，或者让 importModelData 接受一个 flush 标志。
    
    // 方案：调用 importModelData 时带上 clearExisting: true
    const result = await importModelData({ 
        fileId: props.fileId,
        assets, 
        spaces,
        clearExisting: true // 告诉后端先删除该 fileId 下的所有数据
    });
    
    exportResult.value = {
      success: true,
      message: t('dataExport.success'),
      summary: result.summary
    };

    console.log('✅ 数据导出完成', result);

  } catch (error) {
    console.error('❌ 数据导出失败:', error);
    exportResult.value = {
      success: false,
      message: `${t('dataExport.failed')}: ${error.message}`
    };
  } finally {
    isExporting.value = false;
  }
}

// 组件挂载时检查连接并加载保存的映射配置
onMounted(() => {
  checkConnection();
  
  // 从 localStorage 加载映射配置
  try {
    const savedAssetMapping = localStorage.getItem('assetMapping');
    const savedAssetSpecMapping = localStorage.getItem('assetSpecMapping');
    const savedSpaceMapping = localStorage.getItem('spaceMapping');
    
    if (savedAssetMapping) {
      assetMapping.value = JSON.parse(savedAssetMapping);
      console.log('✅ 已加载保存的资产映射配置');
    }
    if (savedAssetSpecMapping) {
      assetSpecMapping.value = JSON.parse(savedAssetSpecMapping);
      console.log('✅ 已加载保存的规格映射配置');
    }
    if (savedSpaceMapping) {
      spaceMapping.value = JSON.parse(savedSpaceMapping);
      console.log('✅ 已加载保存的空间映射配置');
    }
  } catch (e) {
    console.warn('加载保存的映射配置失败，使用默认配置:', e);
  }
});

// 暴露方法
defineExpose({
  extractAndExport,
  checkConnection
});
</script>

<style scoped>
.data-export-panel {
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 8px;
  overflow: hidden;
  font-family: 'Segoe UI', sans-serif;
  color: #e0e0e0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #252526;
  border-bottom: 1px solid #333;
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.status-badge {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.status-badge.connected {
  background: #28a745;
  color: #fff;
}

.status-badge.disconnected {
  background: #dc3545;
  color: #fff;
}

.status-badge.checking {
  background: #ffc107;
  color: #000;
}

.panel-content {
  padding: 16px;
}

.info-section {
  margin-bottom: 16px;
}

.info-section p {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: #aaa;
}

.info-section ul {
  margin: 0;
  padding-left: 20px;
  font-size: 12px;
  color: #888;
}

.info-section li {
  margin-bottom: 4px;
}

.stats-section {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  padding: 12px;
  background: #2a2a2a;
  border-radius: 6px;
}

.stat-item {
  flex: 1;
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: #4fc3f7;
}

.stat-label {
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
}

.actions-section {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #0078d4;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #106ebe;
}

.btn-secondary {
  background: #444;
  color: #e0e0e0;
}

.btn-secondary:hover {
  background: #555;
}

.btn-config {
  background: #8b5cf6;
  color: #fff;
}

.btn-config:hover {
  background: #a78bfa;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.result-section {
  margin-top: 16px;
}

.result-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 6px;
  font-size: 13px;
}

.result-message.success {
  background: rgba(40, 167, 69, 0.2);
  border: 1px solid #28a745;
  color: #28a745;
}

.result-message.error {
  background: rgba(220, 53, 69, 0.2);
  border: 1px solid #dc3545;
  color: #dc3545;
}

.result-details {
  margin-top: 12px;
  padding: 12px;
  background: #2a2a2a;
  border-radius: 6px;
  font-size: 12px;
}

.result-details p {
  margin: 0 0 8px 0;
  font-weight: 500;
}

.result-details ul {
  margin: 0;
  padding-left: 20px;
  color: #aaa;
}

.result-details li {
  margin-bottom: 4px;
}
</style>
