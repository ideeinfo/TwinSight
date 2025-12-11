<template>
  <div class="mapping-config-panel">
    <div class="dialog-header">
      <h3 class="dialog-title">🔧 {{ $t('dataExport.mappingConfig.title') }}</h3>
      <button class="dialog-close-btn" @click="$emit('close')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
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
          <div>字段名</div>
          <div>分类</div>
          <div>属性名</div>
          <div>操作</div>
        </div>

        <div v-if="currentTab === 'asset'" class="mapping-rows">
          <div v-for="(mapping, field) in localAssetMapping" :key="field" class="mapping-row">
            <div class="field-name">{{ field }}</div>
            
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

            <button class="btn-reset" @click="resetField('asset', field)" title="重置">↻</button>
          </div>
        </div>

        <div v-if="currentTab === 'spec'" class="mapping-rows">
          <div v-for="(mapping, field) in localAssetSpecMapping" :key="field" class="mapping-row">
            <div class="field-name">{{ field }}</div>
            
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

            <button class="btn-reset" @click="resetField('spec', field)" title="重置">↻</button>
          </div>
        </div>

        <div v-if="currentTab === 'space'" class="mapping-rows">
          <div v-for="(mapping, field) in localSpaceMapping" :key="field" class="mapping-row">
            <div class="field-name">{{ field }}</div>
            
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

            <button class="btn-reset" @click="resetField('space', field)" title="重置">↻</button>
          </div>
        </div>
      </div>

      <div class="panel-actions">
        <button class="btn btn-secondary" @click="resetAll">{{ $t('dataExport.mappingConfig.resetAll') }}</button>
        <button class="btn btn-primary" @click="saveMapping">{{ $t('dataExport.mappingConfig.save') }}</button>
      </div>

      <div class="help-section">
        <h4>💡 {{ $t('dataExport.mappingConfig.helpTitle') }}</h4>
        <ul>
          <li>{{ $t('dataExport.mappingConfig.help1') }}</li>
          <li>{{ $t('dataExport.mappingConfig.help2') }}</li>
          <li>{{ $t('dataExport.mappingConfig.help3') }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import SearchableSelect from './SearchableSelect.vue';

const { t } = useI18n();

const props = defineProps({
  assetMapping: { type: Object, required: true },
  assetSpecMapping: { type: Object, required: true },
  spaceMapping: { type: Object, required: true },
  assetPropertyOptions: { type: Object, default: () => ({}) },
  spacePropertyOptions: { type: Object, default: () => ({}) }
});

const emit = defineEmits(['close', 'save']);

const currentTab = ref('asset');

const tabs = [
  { id: 'asset', label: t('dataExport.assetTable') },
  { id: 'spec', label: t('dataExport.assetSpecTable') },
  { id: 'space', label: t('dataExport.spaceTable') }
];

// 创建本地副本
const localAssetMapping = ref(JSON.parse(JSON.stringify(props.assetMapping)));
const localAssetSpecMapping = ref(JSON.parse(JSON.stringify(props.assetSpecMapping)));
const localSpaceMapping = ref(JSON.parse(JSON.stringify(props.spaceMapping)));

// 保存初始配置（用于重置到上次保存的状态）
const initialAssetMapping = JSON.parse(JSON.stringify(props.assetMapping));
const initialAssetSpecMapping = JSON.parse(JSON.stringify(props.assetSpecMapping));
const initialSpaceMapping = JSON.parse(JSON.stringify(props.spaceMapping));

// 默认配置（用于重置）
const defaultMappings = {
  asset: {
    assetCode: { category: '文字', property: 'MC编码' },
    specCode: { category: '标识数据', property: '类型注释' },
    name: { category: '标识数据', property: '名称' },
    floor: { category: '约束', property: '标高' },
    room: { category: '房间', property: '名称' }
  },
  spec: {
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
  space: {
    spaceCode: { category: '标识数据', property: '编号' },
    name: { category: '标识数据', property: '名称' },
    classificationCode: { category: '数据', property: 'Classification.OmniClass.21.Number' },
    classificationDesc: { category: '数据', property: 'Classification.OmniClass.21.Description' }
  }
};

function resetField(type, field) {
  const mapping = type === 'asset' ? localAssetMapping : 
                  type === 'spec' ? localAssetSpecMapping : 
                  localSpaceMapping;
  
  const initial = type === 'asset' ? initialAssetMapping : 
                  type === 'spec' ? initialAssetSpecMapping : 
                  initialSpaceMapping;
  
  if (initial[field]) {
    mapping.value[field] = JSON.parse(JSON.stringify(initial[field]));
  }
}

function resetAll() {
  if (confirm(t('dataExport.mappingConfig.confirmReset') || '确定要恢复到上次保存的配置吗？')) {
    // 恢复到初始配置（上次保存的状态）
    localAssetMapping.value = JSON.parse(JSON.stringify(initialAssetMapping));
    localAssetSpecMapping.value = JSON.parse(JSON.stringify(initialAssetSpecMapping));
    localSpaceMapping.value = JSON.parse(JSON.stringify(initialSpaceMapping));
  }
}

// 默认分类列表（确保常用分类都能显示）
const defaultCategories = [
  '文字',
  '标识数据',
  '约束',
  '数据',
  '其他',
  '尺寸',
  '阶段化',
  '构造',
  '房间',
  'Identity Data',
  'Constraints',
  'Dimensions',
  'Data'
];

// 合并的分类选项（包含默认分类和从模型提取的分类）
const mergedAssetCategories = computed(() => {
  const categories = new Set(defaultCategories);
  Object.keys(props.assetPropertyOptions).forEach(cat => categories.add(cat));
  return Array.from(categories).sort();
});

const mergedSpaceCategories = computed(() => {
  const categories = new Set(defaultCategories);
  Object.keys(props.spacePropertyOptions).forEach(cat => categories.add(cat));
  return Array.from(categories).sort();
});

function saveMapping() {
  emit('save', {
    assetMapping: localAssetMapping.value,
    assetSpecMapping: localAssetSpecMapping.value,
    spaceMapping: localSpaceMapping.value
  });
  emit('close');
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
  border-radius: 4px;
  overflow: hidden;
}

.grid-header {
  display: grid;
  grid-template-columns: 180px 1fr 1fr 60px;
  gap: 12px;
  padding: 12px;
  background: #333;
  font-weight: 600;
  font-size: 13px;
  color: #aaa;
}

.mapping-rows {
  max-height: 400px;
  overflow-y: auto;
}

.mapping-row {
  display: grid;
  grid-template-columns: 180px 1fr 1fr 60px;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid #333;
  align-items: center;
}

.mapping-row:last-child {
  border-bottom: none;
}

.field-name {
  font-weight: 500;
  color: #4fc3f7;
  font-size: 13px;
}

.input-category,
.input-property {
  background: #1e1e1e;
  border: 1px solid #444;
  color: #e0e0e0;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  font-family: 'Consolas', monospace;
}

.input-category:focus,
.input-property:focus {
  outline: none;
  border-color: #4fc3f7;
}

.btn-reset {
  background: #444;
  border: none;
  color: #999;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
}

.btn-reset:hover {
  background: #555;
  color: #fff;
}

.panel-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #444;
}

.btn {
  padding: 10px 24px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #4fc3f7;
  color: #000;
}

.btn-primary:hover {
  background: #6dd5ff;
}

.btn-secondary {
  background: #444;
  color: #e0e0e0;
}

.btn-secondary:hover {
  background: #555;
}

.help-section {
  margin-top: 24px;
  padding: 16px;
  background: #2a2a2a;
  border-radius: 4px;
  border-left: 3px solid #4fc3f7;
}

.help-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #4fc3f7;
}

.help-section ul {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: #aaa;
  line-height: 1.8;
}
</style>
