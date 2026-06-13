<template>
  <div class="data-export-panel">
    <div class="dialog-header panel-header">
      <h3 class="dialog-title">📦 {{ $t('dataExport.title') }}</h3>
      <span class="status-badge" :class="apiStatus">
        {{ apiStatus === 'connected' ? $t('dataExport.connected') : apiStatus === 'checking' ? $t('dataExport.checking') : $t('dataExport.disconnected') }}
      </span>
    </div>

    <div class="panel-content-scroll">
      <!-- 1. 顶部说明区域 (移至最上) -->
      <div class="top-info-section">
        <div class="section-title">{{ $t('dataExport.stepExport') }}</div>
        <p class="description-text">{{ $t('dataExport.description') }}</p>
      </div>

      <!-- 2. 映射配置区域 -->
      <div class="config-section">
        <MappingConfigPanel
          :embedded="true"
          :asset-mapping="assetMapping"
          :asset-spec-mapping="assetSpecMapping"
          :space-mapping="spaceMapping"
          :asset-property-options="assetPropertyOptions"
          :space-property-options="spacePropertyOptions"
          :save-message="saveMessage"
          :save-message-type="saveMessageType"
          @save="handleSaveMapping"
        />
      </div>

      <!-- 3. 导出操作区域 -->
      <div class="export-section">
        <div v-if="extractionStats" class="stats-section">
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
          <el-button 
            type="primary" 
            :loading="isExporting"
            :disabled="apiStatus !== 'connected' || !authStore.hasPermission('model:upload')" 
            @click="extractAndExport"
          >
            {{ isExporting ? $t('dataExport.exporting') : $t('dataExport.exportAction') }}
          </el-button>
        </div>

        <div v-if="exportResult" class="result-section" :class="{ success: exportResult.success, error: !exportResult.success }">
          <div class="result-message">
            <span class="icon">{{ exportResult.success ? '✅' : '❌' }}</span>
            <span>{{ exportResult.message }}</span>
          </div>
          <div v-if="exportResult.success && exportResult.summary" class="result-summary">
            <div>PostgreSQL 导入摘要:</div>
            <ul>
              <li>资产: {{ exportResult.summary.assets }} (新增: {{ exportResult.summary.assetInserts }}, 更新: {{ exportResult.summary.assetUpdates }})</li>
              <li>空间: {{ exportResult.summary.spaces }} (新增: {{ exportResult.summary.spaceInserts }}, 更新: {{ exportResult.summary.spaceUpdates }})</li>
              <li>规格: {{ exportResult.summary.specs }}</li>
              <li>分类: {{ exportResult.summary.classifications }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessageBox } from 'element-plus';
import { checkApiHealth, importModelData, checkExistingData } from '../services/postgres.js';

import { getMappingConfig, saveMappingConfig, getDefaultMapping } from '../services/mapping-config.js';
import MappingConfigPanel from './MappingConfigPanel.vue';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();

const { t } = useI18n();

// Props
const props = defineProps({
  fileId: [String, Number],
  initialAssetPropertyOptions: { type: Object, default: null },
  getFullAssetData: Function,
  getFullSpaceData: Function,
  getAssetPropertyList: Function,
  getSpacePropertyList: Function,
  getFullAssetDataWithMapping: Function,
  getFullSpaceDataWithMapping: Function
});

// 状态
const apiStatus = ref('checking');
const isExporting = ref(false);
const extractionStats = ref(null);
const exportResult = ref(null);
const saveMessage = ref('');
const saveMessageType = ref('success');

// 映射配置状态
const assetMapping = ref({});
const assetPropertyOptions = ref({});
const spacePropertyOptions = ref({});
const spaceMapping = ref({});
const assetSpecMapping = ref({});

// Helper to show confirm dialog using ElMessageBox
const showConfirm = async (options) => {
  try {
    await ElMessageBox.confirm(
      options.message || '',
      options.title || t('common.confirm'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: options.danger ? 'warning' : 'info',
        dangerouslyUseHTMLString: false
      }
    );
    return true;
  } catch {
    return false;
  }
};


// 获取属性列表
async function fetchProperties() {
  // 获取资产属性列表
  if (props.getAssetPropertyList && Object.keys(assetPropertyOptions.value || {}).length === 0) {
    try {
      assetPropertyOptions.value = await props.getAssetPropertyList();
    } catch (e) {
      console.error('提取资产属性列表失败:', e);
    }
  }
  
  if (props.getSpacePropertyList) {
    try {
      spacePropertyOptions.value = await props.getSpacePropertyList();
    } catch (e) {
      console.error('提取空间属性列表失败:', e);
    }
  }
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
async function handleSaveMapping(newMappings) {
  assetMapping.value = newMappings.assetMapping;
  assetSpecMapping.value = newMappings.assetSpecMapping;
  spaceMapping.value = newMappings.spaceMapping;
  
  // 保存到数据库（如果有 fileId）
  if (props.fileId) {
    try {
      await saveMappingConfig(props.fileId, {
        assetMapping: newMappings.assetMapping,
        assetSpecMapping: newMappings.assetSpecMapping,
        spaceMapping: newMappings.spaceMapping
      });
      console.log('✅ 映射配置已保存到数据库');
      saveMessage.value = t('dataExport.mappingConfig.saveSuccess') || '配置已保存';
      saveMessageType.value = 'success';
      setTimeout(() => { saveMessage.value = ''; }, 3000);
    } catch (error) {
      console.error('保存映射配置到数据库失败:', error);
      saveMessage.value = t('dataExport.mappingConfig.saveFailed') || '保存失败: ' + error.message;
      saveMessageType.value = 'error';
      setTimeout(() => { saveMessage.value = ''; }, 5000);
    }
  } else {
    console.warn('⚠️ 没有 fileId,无法保存映射配置到数据库');
    saveMessage.value = '仅应用到当前会话';
    saveMessageType.value = 'success';
    setTimeout(() => { saveMessage.value = ''; }, 3000);
  }
}


// 提取并导出数据
async function extractAndExport() {
  if (!props.getFullAssetDataWithMapping || !props.getFullSpaceDataWithMapping) {
    exportResult.value = { success: false, message: '函数未提供，请确保模型已加载' };
    return;
  }

  // Check if there is existing data for this file
  if (props.fileId) {
    try {
      const hasData = await checkExistingData(props.fileId);
      if (hasData) {
        const confirmed = await showConfirm({
          title: t('dataExport.exportAction'),
          message: t('dataExport.mappingConfig.confirmOverwrite'),
          danger: true
        });
        if (!confirmed) {
          return;
        }
      }
    } catch (error) {
      console.warn('检查现有数据失败:', error);
      // Continue anyway if check fails
    }
  }

  isExporting.value = true;
  exportResult.value = null;

  try {
    console.log('📊 开始提取数据...');
    
    // 直接调用，不通过变量
    const tempTable = await props.getFullAssetDataWithMapping({
      assetMapping: JSON.parse(JSON.stringify(assetMapping.value)),
      assetSpecMapping: JSON.parse(JSON.stringify(assetSpecMapping.value))
    });
    const spaces = await props.getFullSpaceDataWithMapping(
      JSON.parse(JSON.stringify(spaceMapping.value))
    );

    console.log(`✅ 提取完成: ${tempTable.length} 个资产, ${spaces.length} 个空间`);
    
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

    // 调用 importModelData 时带上 clearExisting: true
    const result = await importModelData({ 
        fileId: props.fileId,
        assets, 
        spaces: spaces.map(s => ({...s, fileId: props.fileId})),
        clearExisting: true 
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

// 组件挂载时检查连接并加载映射配置
onMounted(async () => {
  checkConnection();

  if (props.initialAssetPropertyOptions && Object.keys(props.initialAssetPropertyOptions).length > 0) {
    assetPropertyOptions.value = props.initialAssetPropertyOptions;
  }

  fetchProperties();
  
  // 从数据库加载映射配置（如果有 fileId）
  if (props.fileId) {
    try {
      console.log(`📥 从数据库加载文件 ${props.fileId} 的映射配置...`);
      const config = await getMappingConfig(props.fileId);
      
      // 如果数据库中有配置，则使用；否则使用默认配置
      if (config.assetMapping && Object.keys(config.assetMapping).length > 0) {
        assetMapping.value = config.assetMapping;
      } else {
        const defaults = getDefaultMapping();
        assetMapping.value = defaults.assetMapping;
      }
      
      if (config.assetSpecMapping && Object.keys(config.assetSpecMapping).length > 0) {
        assetSpecMapping.value = config.assetSpecMapping;
      } else {
        const defaults = getDefaultMapping();
        assetSpecMapping.value = defaults.assetSpecMapping;
      }
      
      if (config.spaceMapping && Object.keys(config.spaceMapping).length > 0) {
        spaceMapping.value = config.spaceMapping;
      } else {
        const defaults = getDefaultMapping();
        spaceMapping.value = defaults.spaceMapping;
      }
    } catch (error) {
      console.warn('从数据库加载映射配置失败，使用默认配置:', error);
      const defaults = getDefaultMapping();
      assetMapping.value = defaults.assetMapping;
      assetSpecMapping.value = defaults.assetSpecMapping;
      spaceMapping.value = defaults.spaceMapping;
    }
  } else {
    const defaults = getDefaultMapping();
    assetMapping.value = defaults.assetMapping;
    assetSpecMapping.value = defaults.assetSpecMapping;
    spaceMapping.value = defaults.spaceMapping;
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
  display: flex;
  flex-direction: column;
  max-height: 90vh; /* 增加最大高度，减少滚动条出现概率 */
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 8px;
  overflow: hidden; /* 外层禁止滚动，内部滚动 */
  font-family: 'Segoe UI', sans-serif;
  color: #e0e0e0;
}

.panel-header {
  flex-shrink: 0;
  padding-right: 48px;
  background: #252526;
  border-bottom: 1px solid #333;
}

.panel-content-scroll {
  flex: 1;
  overflow-y: auto; 
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
}

/* 顶部说明区域 */
.top-info-section {
  padding: 20px 24px 16px 24px; /* 增加一点左右间距 */
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 8px;
  border-left: 3px solid #0078d4;
  padding-left: 8px;
  display: flex;
  align-items: center;
}

.description-text {
  margin: 0;
  font-size: 13px;
  color: #aaa;
  margin-bottom: 8px;
}

.config-section {
  margin: 0 24px 24px 24px; /* 增加底部间距 */
  padding: 0;
  background: #252526;
  border: 1px solid #333;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
}

/* 导出操作区域 */
.export-section {
  padding: 0 24px 24px 24px;
  background: transparent; /* 透明背景，与窗体一致 */
}

.stats-section {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  padding: 12px;
  background: #2a2a2a;
  border-radius: 6px;
  border: 1px solid #333;
}

.stat-item {
  flex: 1;
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: #4fc3f7;
}

.stat-label {
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
}

/* 按钮区域：右对齐，统一宽度 */
.actions-section {
  display: flex;
  gap: 12px;
  justify-content: flex-end; /* 右对齐 */
  margin-bottom: 0;
}

.result-section {
  margin-top: 16px;
  padding: 12px;
  border-radius: 4px;
  background: #2a2a2a;
  border-left: 4px solid #aaa;
}

.result-section.success {
  border-left-color: #28a745;
  background: rgba(40, 167, 69, 0.1);
}

.result-section.error {
  border-left-color: #dc3545;
  background: rgba(220, 53, 69, 0.1);
}

.result-message {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  font-size: 13px;
}

.result-summary {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255,255,255,0.1);
  font-size: 12px;
  color: #ccc;
}

.result-summary ul {
  margin: 4px 0 0 0;
  padding-left: 20px;
}

.result-summary li {
  margin-bottom: 2px;
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
</style>
