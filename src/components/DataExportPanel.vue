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
      </div>

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
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { checkApiHealth, importModelData } from '../services/postgres.js';

const { t } = useI18n();

// Props
const props = defineProps({
  // 从 MainView 传入的方法
  getFullAssetData: { type: Function, default: null },
  getFullSpaceData: { type: Function, default: null }
});

// 状态
const apiStatus = ref('checking');
const isExporting = ref(false);
const extractionStats = ref(null);
const exportResult = ref(null);

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

// 提取并导出数据
async function extractAndExport() {
  if (!props.getFullAssetData || !props.getFullSpaceData) {
    exportResult.value = { success: false, message: t('dataExport.failed') };
    return;
  }

  isExporting.value = true;
  exportResult.value = null;

  try {
    // 1. 提取资产数据
    console.log('📊 开始提取资产数据...');
    const assets = await props.getFullAssetData();
    console.log(`📊 提取到 ${assets.length} 个资产`);

    // 2. 提取空间数据
    console.log('📊 开始提取空间数据...');
    const spaces = await props.getFullSpaceData();
    console.log(`📊 提取到 ${spaces.length} 个空间`);

    // 3. 计算统计信息
    const specsSet = new Set(assets.map(a => a.typeComments).filter(Boolean));
    const classificationsSet = new Set([
      ...assets.map(a => a.omniClass21Number).filter(Boolean),
      ...spaces.map(s => s.classificationCode).filter(Boolean)
    ]);

    extractionStats.value = {
      assets: assets.length,
      spaces: spaces.length,
      specs: specsSet.size,
      classifications: classificationsSet.size
    };

    // 4. 发送到后端
    console.log('📤 正在发送数据到数据库...');
    const result = await importModelData({ assets, spaces });
    
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

// 组件挂载时检查连接
onMounted(() => {
  checkConnection();
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
  background: #3e3e3e;
  color: #e0e0e0;
}

.btn-secondary:hover:not(:disabled) {
  background: #4e4e4e;
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
