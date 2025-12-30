<template>
  <div class="mapping-config-panel" :class="{ 'embedded': embedded }">
    <div v-if="!embedded" class="dialog-header">
      <h3 class="dialog-title">🔧 {{ $t('dataExport.mappingConfig.title') }}</h3>
      <button class="dialog-close-btn" @click="$emit('close')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>
    </div>

    <div class="panel-content">
      <div class="tabs">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          :class="['tab', { active: currentTab === tab.id }]"
          @click="currentTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="mapping-grid">
        <div class="grid-header">
          <div>{{ $t('dataExport.fieldName') || '字段名' }}</div>
          <div>{{ $t('dataExport.mappingConfig.help1').split('：')[0] || '分类' }}</div>
          <div>{{ $t('dataExport.mappingConfig.help2').split('：')[0] || '属性名' }}</div>
          <div class="header-action">{{ $t('dataExport.action') || '操作' }}</div>
        </div>

        <div v-if="currentTab === 'asset'" class="mapping-rows">
          <div v-for="(mapping, field) in localAssetMapping" :key="field" class="mapping-row">
            <div class="field-name" :title="field">{{ $t(`dataExport.fields.${field}`) }} <span class="field-key">({{ field }})</span></div>
            
            <SearchableSelect
              v-model="mapping.category"
              :options="mergedAssetCategories"
              :placeholder="$t('dataExport.mappingConfig.categoryPlaceholder')"
            />

            <SearchableSelect
              v-model="mapping.property"
              :options="assetPropertyOptions[mapping.category] || []"
              :placeholder="$t('dataExport.mappingConfig.propertyPlaceholder')"
            />

            <button class="btn-reset" :title="$t('dataExport.mappingConfig.reset') || '重置'" @click="resetField('asset', field)">↻</button>
          </div>
        </div>

        <div v-if="currentTab === 'spec'" class="mapping-rows">
          <div v-for="(mapping, field) in localAssetSpecMapping" :key="field" class="mapping-row">
            <div class="field-name" :title="field">{{ $t(`dataExport.fields.${field}`) }} <span class="field-key">({{ field }})</span></div>
            
            <SearchableSelect
              v-model="mapping.category"
              :options="mergedAssetCategories"
              :placeholder="$t('dataExport.mappingConfig.categoryPlaceholder')"
            />

            <SearchableSelect
              v-model="mapping.property"
              :options="assetPropertyOptions[mapping.category] || []"
              :placeholder="$t('dataExport.mappingConfig.propertyPlaceholder')"
            />

            <button class="btn-reset" :title="$t('dataExport.mappingConfig.reset') || '重置'" @click="resetField('spec', field)">↻</button>
          </div>
        </div>

        <div v-if="currentTab === 'space'" class="mapping-rows">
          <div v-for="(mapping, field) in localSpaceMapping" :key="field" class="mapping-row">
            <div class="field-name" :title="field">{{ $t(`dataExport.fields.${field}`) }} <span class="field-key">({{ field }})</span></div>
            
            <SearchableSelect
              v-model="mapping.category"
              :options="mergedSpaceCategories"
              :placeholder="$t('dataExport.mappingConfig.categoryPlaceholder')"
            />

            <SearchableSelect
              v-model="mapping.property"
              :options="spacePropertyOptions[mapping.category] || []"
              :placeholder="$t('dataExport.mappingConfig.propertyPlaceholder')"
            />

            <button class="btn-reset" :title="$t('dataExport.mappingConfig.reset') || '重置'" @click="resetField('space', field)">↻</button>
          </div>
        </div>
      </div>

      <!-- 底部栏：包含帮助和保存按钮 -->
      <div class="panel-footer-bar">
        <div class="help-section-inline">
          <div class="help-icon">💡</div>
          <div class="help-content">
            <h4>{{ $t('dataExport.mappingConfig.helpTitle') }}</h4>
            <ol>
              <li>{{ $t('dataExport.mappingConfig.help1') }}</li>
              <li>{{ $t('dataExport.mappingConfig.help2') }}</li>
              <li>{{ $t('dataExport.mappingConfig.help3') }}</li>
            </ol>
          </div>
        </div>
        <div class="panel-actions">
          <transition name="fade">
            <span v-if="saveMessage" class="save-msg" :class="saveMessageType">
              <span class="icon">{{ saveMessageType === 'success' ? '✅' : '⚠️' }}</span>
              {{ saveMessage }}
            </span>
          </transition>
          <button class="btn btn-primary" @click="saveMapping">{{ $t('dataExport.mappingConfig.save') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import SearchableSelect from './SearchableSelect.vue';

const { t } = useI18n();

const props = defineProps({
  assetMapping: { type: Object, default: () => ({}) },
  assetSpecMapping: { type: Object, default: () => ({}) },
  spaceMapping: { type: Object, default: () => ({}) },
  assetPropertyOptions: { type: Object, default: () => ({}) },
  spacePropertyOptions: { type: Object, default: () => ({}) },
  embedded: { type: Boolean, default: false },
  saveMessage: { type: String, default: '' },
  saveMessageType: { type: String, default: 'success' }
});

const emit = defineEmits(['save', 'close', 'reset']);

const currentTab = ref('asset');

const tabs = computed(() => [
  { id: 'asset', label: t('dataExport.assetTable') },
  { id: 'spec', label: t('dataExport.assetSpecTable') },
  { id: 'space', label: t('dataExport.spaceTable') }
]);

// 本地副本
const localAssetMapping = ref({});
const localAssetSpecMapping = ref({});
const localSpaceMapping = ref({});

// 监听 Pros 变化，这对于异步数据至关重要
// 使用 deep: true 和 immediate: true 确保初始化和后续更新都能捕获
watch(() => props.assetMapping, (newVal) => {
  if (newVal && Object.keys(newVal).length > 0) {
    localAssetMapping.value = JSON.parse(JSON.stringify(newVal));
  }
}, { deep: true, immediate: true });

watch(() => props.assetSpecMapping, (newVal) => {
  if (newVal && Object.keys(newVal).length > 0) {
    localAssetSpecMapping.value = JSON.parse(JSON.stringify(newVal));
  }
}, { deep: true, immediate: true });

watch(() => props.spaceMapping, (newVal) => {
  if (newVal && Object.keys(newVal).length > 0) {
    localSpaceMapping.value = JSON.parse(JSON.stringify(newVal));
  }
}, { deep: true, immediate: true });


// 提取所有分类供选择
const mergedAssetCategories = computed(() => {
  const categories = new Set();
  
  if (props.assetPropertyOptions) {
    Object.keys(props.assetPropertyOptions).forEach(c => categories.add(c));
  }
  
  Object.values(localAssetMapping.value || {}).forEach(m => {
    if (m.category) categories.add(m.category);
  });
  
  // 确保也包含 Asset Spec 的分类
  Object.values(localAssetSpecMapping.value || {}).forEach(m => {
    if (m.category) categories.add(m.category);
  });
  
  return Array.from(categories).sort();
});

const mergedSpaceCategories = computed(() => {
  const categories = new Set();
  
  if (props.spacePropertyOptions) {
    Object.keys(props.spacePropertyOptions).forEach(c => categories.add(c));
  }
  
  Object.values(localSpaceMapping.value || {}).forEach(m => {
    if (m.category) categories.add(m.category);
  });
  
  return Array.from(categories).sort();
});

// 重置单个字段
function resetField(type, field) {
  if (type === 'asset' && localAssetMapping.value[field]) {
    localAssetMapping.value[field].category = '';
    localAssetMapping.value[field].property = '';
  } else if (type === 'spec' && localAssetSpecMapping.value[field]) {
    localAssetSpecMapping.value[field].category = '';
    localAssetSpecMapping.value[field].property = '';
  } else if (type === 'space' && localSpaceMapping.value[field]) {
    localSpaceMapping.value[field].category = '';
    localSpaceMapping.value[field].property = '';
  }
}

// 保存
function saveMapping() {
  emit('save', {
    assetMapping: JSON.parse(JSON.stringify(localAssetMapping.value)),
    assetSpecMapping: JSON.parse(JSON.stringify(localAssetSpecMapping.value)),
    spaceMapping: JSON.parse(JSON.stringify(localSpaceMapping.value))
  });
}
</script>

<style scoped>
.mapping-config-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90%;
  max-width: 900px;
  max-height: 85vh;
  background: #1e1e1e;
  border: 1px solid #444;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'Segoe UI', sans-serif;
  color: #e0e0e0;
}

/* 嵌入模式样式覆盖 */
.mapping-config-panel.embedded {
  position: static;
  top: auto;
  left: auto;
  transform: none;
  width: 100%;
  max-width: none;
  max-height: none;
  border: none;
  box-shadow: none;
  background: transparent;
  flex: 1;
  z-index: auto;
}

.mapping-config-panel.embedded .panel-content {
  overflow-y: visible;
  height: auto;
  flex: none;
  padding: 0; 
}


.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  border-bottom: 1px solid #444;
}

.tab {
  padding: 10px 20px;
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  font-weight: 500;
}

.tab:hover {
  color: #fff;
}

.tab.active {
  color: #4fc3f7;
  border-bottom-color: #4fc3f7;
}

.mapping-grid {
  background: #2a2a2a;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #333;
}

.grid-header {
  display: grid;
  grid-template-columns: 200px 1fr 1fr 60px; /* 调整列宽 */
  gap: 16px;
  padding: 12px 16px;
  background: #333;
  font-weight: 600;
  font-size: 13px;
  color: #ccc;
  align-items: center;
}

.header-action {
  text-align: center;
}

.mapping-rows {
  height: 320px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #555 #2e2e2e;
}

.mapping-row {
  display: grid;
  grid-template-columns: 200px 1fr 1fr 60px;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid #333;
  align-items: center; /* 垂直居中 */
  transition: background 0.2s;
}

.mapping-row:hover {
  background: #333;
}

.mapping-row:last-child {
  border-bottom: none;
}

.field-name {
  font-size: 13px;
  color: #fff;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  flex-direction: column;
}

.field-key {
  font-size: 11px;
  color: #888;
  font-weight: normal;
  margin-top: 2px;
}

.btn-reset {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 1px solid #444;
  background: #333;
  color: #aaa;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  margin: 0 auto;
}

.btn-reset:hover {
  background: #444;
  color: #fff;
  border-color: #555;
}

/* 底部功能栏 */
.panel-footer-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start; /* 整体顶部对齐，避免因高度差异导致的错位 */
  margin-top: 20px;
  padding: 0 16px 20px 16px; 
}

.help-section-inline {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  color: #aaa;
  max-width: 70%;
}

.help-icon {
  font-size: 16px;
  margin-top: -2px; /* 微调图标位置，使其与标题行垂直对齐 */
}

.help-content h4 {
  margin: 0 0 6px 0;
  font-size: 13px; /* 稍微调大标题 */
  font-weight: 600;
  color: #ffc107;
  line-height: 1.2;
}

.help-content ol {
  margin: 0;
  padding-left: 20px; /* 为序号留出空间 */
  list-style: decimal; /* 显示数字序号 */
  font-size: 12px;
  line-height: 1.5;
  color: #bbb;
}

.panel-actions {
  display: flex;
  gap: 12px;
  align-self: flex-end; /* 按钮靠下对齐，或者 center? flex-end 会和帮助文本底部对齐 */
  margin-bottom: 2px;
}

.btn {
  padding: 8px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: #0078d4;
  color: #fff;
}

.btn-primary:hover {
  background: #106ebe;
}

.btn-secondary {
  background: #444;
  color: #ccc;
}

.btn-secondary:hover {
  background: #555;
  color: #fff;
}

.save-msg {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.2);
}

.save-msg.success {
  color: #4caf50;
  border: 1px solid rgba(76, 175, 80, 0.3);
}

.save-msg.error {
  color: #f44336;
  border: 1px solid rgba(244, 67, 54, 0.3);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
