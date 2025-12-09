<template>
  <div class="mapping-config-panel">
    <div class="panel-header">
      <h3>🔧 {{ $t('dataExport.mappingConfig.title') }}</h3>
      <button class="btn-close" @click="$emit('close')">✕</button>
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
            
            <input 
              v-model="mapping.category" 
              class="input-category"
              :list="'asset-cat-' + field"
              :placeholder="$t('dataExport.mappingConfig.categoryPlaceholder')"
            />
            <datalist :id="'asset-cat-' + field">
              <option v-for="cat in Object.keys(assetPropertyOptions)" :key="cat" :value="cat" />
            </datalist>

            <input 
              v-model="mapping.property" 
              class="input-property"
              :list="'asset-prop-' + field"
              :placeholder="$t('dataExport.mappingConfig.propertyPlaceholder')"
            />
            <datalist :id="'asset-prop-' + field">
              <option v-for="prop in (assetPropertyOptions[mapping.category] || [])" :key="prop" :value="prop" />
            </datalist>

            <button class="btn-reset" @click="resetField('asset', field)" title="重置">↻</button>
          </div>
        </div>

        <div v-if="currentTab === 'spec'" class="mapping-rows">
          <div v-for="(mapping, field) in localAssetSpecMapping" :key="field" class="mapping-row">
            <div class="field-name">{{ field }}</div>
            
            <input 
              v-model="mapping.category" 
              class="input-category"
              :list="'spec-cat-' + field"
              :placeholder="$t('dataExport.mappingConfig.categoryPlaceholder')"
            />
            <datalist :id="'spec-cat-' + field">
              <option v-for="cat in Object.keys(assetPropertyOptions)" :key="cat" :value="cat" />
            </datalist>

            <input 
              v-model="mapping.property" 
              class="input-property"
              :list="'spec-prop-' + field"
              :placeholder="$t('dataExport.mappingConfig.propertyPlaceholder')"
            />
            <datalist :id="'spec-prop-' + field">
              <option v-for="prop in (assetPropertyOptions[mapping.category] || [])" :key="prop" :value="prop" />
            </datalist>

            <button class="btn-reset" @click="resetField('spec', field)" title="重置">↻</button>
          </div>
        </div>

        <div v-if="currentTab === 'space'" class="mapping-rows">
          <div v-for="(mapping, field) in localSpaceMapping" :key="field" class="mapping-row">
            <div class="field-name">{{ field }}</div>
            
            <input 
              v-model="mapping.category" 
              class="input-category"
              :list="'space-cat-' + field"
              :placeholder="$t('dataExport.mappingConfig.categoryPlaceholder')"
            />
            <datalist :id="'space-cat-' + field">
              <option v-for="cat in Object.keys(spacePropertyOptions)" :key="cat" :value="cat" />
            </datalist>

            <input 
              v-model="mapping.property" 
              class="input-property"
              :list="'space-prop-' + field"
              :placeholder="$t('dataExport.mappingConfig.propertyPlaceholder')"
            />
            <datalist :id="'space-prop-' + field">
              <option v-for="prop in (spacePropertyOptions[mapping.category] || [])" :key="prop" :value="prop" />
            </datalist>

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
  
  if (defaultMappings[type][field]) {
    mapping.value[field] = JSON.parse(JSON.stringify(defaultMappings[type][field]));
  }
}

function resetAll() {
  if (confirm(t('dataExport.mappingConfig.confirmReset') || '确定要重置所有映射配置吗？')) {
    localAssetMapping.value = JSON.parse(JSON.stringify(defaultMappings.asset));
    localAssetSpecMapping.value = JSON.parse(JSON.stringify(defaultMappings.spec));
    localSpaceMapping.value = JSON.parse(JSON.stringify(defaultMappings.space));
  }
}

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

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #252526;
  border-bottom: 1px solid #444;
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  color: #e0e0e0;
}

.btn-close {
  background: none;
  border: none;
  color: #999;
  font-size: 20px;
  cursor: pointer;
  padding: 0 8px;
  line-height: 1;
}

.btn-close:hover {
  color: #fff;
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
