<template>
  <div class="right-panel">
    <div class="header-row">
      <span>{{ t('rightPanel.properties') }}</span>
      <div class="header-icons">
        <svg class="icon-btn close-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" @click="$emit('close-properties')"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </div>
    </div>
    <div class="breadcrumb-row"><span class="breadcrumb-text">{{ breadcrumbText }}</span><svg class="link-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg></div>
    <div class="tabs">
      <div v-if="activeTab === 'ELEMENT'" class="tab" :class="{ active: activeTab === 'ELEMENT' }" @click="activeTab = 'ELEMENT'">{{ t('rightPanel.element') }}</div>
      <div v-if="activeTab === 'TYPE' || activeTab === 'ELEMENT'" class="tab" :class="{ active: activeTab === 'TYPE' }" @click="activeTab = 'TYPE'">{{ t('rightPanel.type') }}</div>
      <div v-if="activeTab !== 'ELEMENT' && activeTab !== 'TYPE'" class="add-action">+ {{ t('common.add') }} <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9" /></svg></div>
    </div>
    <div class="scroll-content">
      <div v-if="activeTab === 'ELEMENT'">
        <div class="group-header" @click="toggleGroup('element_asset')"><span>{{ t('rightPanel.assetProperties') }}</span><svg class="arrow-icon" :class="{ rotated: collapsedState.element_asset }" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15" /></svg></div>
        <div v-show="!collapsedState.element_asset" class="group-body">
          <!-- 资产模式 -->
          <div v-if="isAssetMode" class="form-group">
            <div class="sub-label">{{ t('rightPanel.common') }}</div>
            <div class="row"><label>{{ t('rightPanel.assetCode') }}</label><EditableField :model-value="localProperties.mcCode" :disabled="true" :placeholder="t('common.none')" /></div>
            <div class="row"><label>{{ t('rightPanel.specCode') }}</label><EditableField :model-value="localProperties.typeComments" :field-type="getFieldType('typeComments')" :disabled="!isFieldEditable('typeComments')" :placeholder="t('common.none')" @change="handleFieldChange('typeComments', $event)" /></div>
            <div class="row"><label>{{ t('rightPanel.name') }}</label><EditableField :model-value="localProperties.name" :field-type="getFieldType('name')" :disabled="!isFieldEditable('name')" :placeholder="t('common.none')" @change="handleFieldChange('name', $event)" /></div>
            <div class="row"><label>{{ t('rightPanel.level') }}</label><EditableField :model-value="localProperties.level" :field-type="getFieldType('level')" :disabled="!isFieldEditable('level')" :placeholder="t('common.none')" @change="handleFieldChange('level', $event)" /></div>
            <div class="row"><label>{{ t('rightPanel.room') }}</label><EditableField :model-value="localProperties.room" :field-type="getFieldType('room')" :disabled="!isFieldEditable('room')" :placeholder="t('common.none')" @change="handleFieldChange('room', $event)" /></div>
          </div>
          <!-- 房间模式 -->
          <div v-else-if="roomProperties" class="form-group">
            <div class="sub-label">{{ t('rightPanel.common') }}</div>
            <div class="row"><label>{{ t('rightPanel.code') }}</label><EditableField :model-value="localProperties.code" :disabled="true" :placeholder="t('common.none')" /></div>
            <div class="row"><label>{{ t('rightPanel.name') }}</label><EditableField :model-value="localProperties.name" :field-type="getFieldType('name')" :disabled="!isFieldEditable('name')" :placeholder="t('common.none')" @change="handleFieldChange('name', $event)" /></div>
            <div class="row"><label>{{ t('rightPanel.area') }}</label><EditableField :model-value="localProperties.area" :field-type="getFieldType('area')" :disabled="!isFieldEditable('area')" :placeholder="t('common.none')" @change="handleFieldChange('area', $event)" /></div>
            <div class="row"><label>{{ t('rightPanel.perimeter') }}</label><EditableField :model-value="localProperties.perimeter" :field-type="getFieldType('perimeter')" :disabled="!isFieldEditable('perimeter')" :placeholder="t('common.none')" @change="handleFieldChange('perimeter', $event)" /></div>
            <div class="row"><label>{{ t('rightPanel.level') }}</label><EditableField :model-value="localProperties.level" :field-type="getFieldType('level')" :disabled="!isFieldEditable('level')" :placeholder="t('common.none')" @change="handleFieldChange('level', $event)" /></div>
            <div class="row"><label>{{ t('rightPanel.spaceNumber') }}</label><EditableField :model-value="localProperties.spaceNumber" :field-type="getFieldType('spaceNumber')" :disabled="!isFieldEditable('spaceNumber')" :placeholder="t('common.none')" @change="handleFieldChange('spaceNumber', $event)" /></div>
            <div class="row"><label>{{ t('rightPanel.spaceDescription') }}</label><EditableField :model-value="localProperties.spaceDescription" :field-type="getFieldType('spaceDescription')" :disabled="!isFieldEditable('spaceDescription')" :placeholder="t('common.none')" @change="handleFieldChange('spaceDescription', $event)" /></div>
          </div>
          <!-- 房间模式：未选中时显示空白属性字段 -->
          <div v-else class="form-group">
            <div class="sub-label">{{ t('rightPanel.common') }}</div>
            <div class="row"><label>{{ t('rightPanel.code') }}</label><div class="val-box placeholder">{{ t('common.none') }}</div></div>
            <div class="row"><label>{{ t('rightPanel.name') }}</label><div class="val-box placeholder">{{ t('common.none') }}</div></div>
            <div class="row"><label>{{ t('rightPanel.area') }}</label><div class="val-box placeholder">{{ t('common.none') }}</div></div>
            <div class="row"><label>{{ t('rightPanel.perimeter') }}</label><div class="val-box placeholder">{{ t('common.none') }}</div></div>
            <div class="row"><label>{{ t('rightPanel.level') }}</label><div class="val-box placeholder">{{ t('common.none') }}</div></div>
            <div class="row"><label>{{ t('rightPanel.spaceNumber') }}</label><div class="val-box placeholder">{{ t('common.none') }}</div></div>
            <div class="row"><label>{{ t('rightPanel.spaceDescription') }}</label><div class="val-box placeholder">{{ t('common.none') }}</div></div>
          </div>
        </div>
        <div v-if="isAssetMode" class="group-header" @click="toggleGroup('element_rel')"><span>{{ t('rightPanel.relationships') }}</span><svg class="arrow-icon" :class="{ rotated: collapsedState.element_rel }" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15" /></svg></div>
        <div v-show="isAssetMode && !collapsedState.element_rel" class="group-body">
          <!-- 资产模式 -->
          <div class="form-group">
            <div class="row"><label>{{ t('rightPanel.rooms') }}</label><div class="val-box" :class="{ placeholder: isVaries(roomProperties?.room) }">{{ formatValue(roomProperties?.room) }}</div></div>
          </div>
        </div>
        
        <!-- 二维码 - 单选时显示 -->
        <QRCodeDisplay 
          v-if="!localProperties.isMultiple"
          :code="isAssetMode ? localProperties.mcCode : localProperties.code"
        />
        
        <!-- 文档 - 二维码下方 -->
        <DocumentList 
          v-if="!localProperties.isMultiple"
          :asset-code="isAssetMode ? localProperties.mcCode : null" 
          :space-code="!isAssetMode ? localProperties.code : null"
        />
      </div>
      <div v-if="activeTab === 'TYPE'">
        <div class="group-header" @click="toggleGroup('type_asset')"><span>{{ t('rightPanel.assetProperties') }}</span><svg class="arrow-icon" :class="{ rotated: collapsedState.type_asset }" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15" /></svg></div>
        <div v-show="!collapsedState.type_asset" class="group-body">
          <!-- 资产模式 -->
          <div v-if="isAssetMode" class="form-group">
            <div class="sub-label">{{ t('rightPanel.common') }}</div>
            <div class="row"><label>{{ t('rightPanel.specCode') }}</label><EditableField :model-value="localProperties.typeComments" :field-type="getFieldType('typeComments')" :disabled="!isFieldEditable('typeComments')" :placeholder="t('common.none')" @change="handleFieldChange('typeComments', $event)" /></div>
            <div class="row"><label>{{ t('rightPanel.specName') }}</label><EditableField :model-value="localProperties.specName" :field-type="getFieldType('specName')" :disabled="!isFieldEditable('specName')" :placeholder="t('common.none')" @change="handleFieldChange('specName', $event)" /></div>
            <div class="row"><label>{{ t('rightPanel.classificationCode') }}</label><EditableField :model-value="localProperties.omniClass21Number" :field-type="getFieldType('omniClass21Number')" :disabled="!isFieldEditable('omniClass21Number')" :placeholder="t('common.none')" @change="handleFieldChange('omniClass21Number', $event)" /></div>
            <div class="row"><label>{{ t('rightPanel.classificationDesc') }}</label><EditableField :model-value="localProperties.omniClass21Description" :field-type="getFieldType('omniClass21Description')" :disabled="!isFieldEditable('omniClass21Description')" :placeholder="t('common.none')" @change="handleFieldChange('omniClass21Description', $event)" /></div>
            <div class="row"><label>{{ t('rightPanel.category') }}</label><EditableField :model-value="localProperties.category" :field-type="getFieldType('category')" :disabled="!isFieldEditable('category')" :placeholder="t('common.none')" @change="handleFieldChange('category', $event)" /></div>
            <div class="row"><label>{{ t('rightPanel.family') }}</label><EditableField :model-value="localProperties.family" :field-type="getFieldType('family')" :disabled="!isFieldEditable('family')" :placeholder="t('common.none')" @change="handleFieldChange('family', $event)" /></div>
            <div class="row"><label>{{ t('rightPanel.typeLabel') }}</label><EditableField :model-value="localProperties.type" :field-type="getFieldType('type')" :disabled="!isFieldEditable('type')" :placeholder="t('common.none')" @change="handleFieldChange('type', $event)" /></div>
            <div class="row"><label>{{ t('rightPanel.manufacturer') }}</label><EditableField :model-value="localProperties.manufacturer" :field-type="getFieldType('manufacturer')" :disabled="!isFieldEditable('manufacturer')" :placeholder="t('common.none')" @change="handleFieldChange('manufacturer', $event)" /></div>
            <div class="row"><label>{{ t('rightPanel.address') }}</label><EditableField :model-value="localProperties.address" :field-type="getFieldType('address')" :disabled="!isFieldEditable('address')" :placeholder="t('common.none')" @change="handleFieldChange('address', $event)" /></div>
            <div class="row"><label>{{ t('rightPanel.phone') }}</label><EditableField :model-value="localProperties.phone" :field-type="getFieldType('phone')" :disabled="!isFieldEditable('phone')" :placeholder="t('common.none')" @change="handleFieldChange('phone', $event)" /></div>
          </div>
        </div>
        <div class="group-header" @click="toggleGroup('type_design')"><span>{{ t('rightPanel.designProperties') }}</span><svg class="arrow-icon" :class="{ rotated: collapsedState.type_design }" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15" /></svg></div>
        <div v-show="!collapsedState.type_design" class="group-body"><div class="form-group"><div class="row"><label>{{ t('rightPanel.manufacturer') }}</label><div class="val-box placeholder">{{ t('common.none') }}</div></div><div class="row"><label>{{ t('rightPanel.model') }}</label><div class="val-box placeholder">{{ t('common.none') }}</div></div></div></div>
        
        <!-- 文档 - 设计属性下方 -->
        <!-- 单选或多选同一规格时显示 -->
        <DocumentList 
          v-if="isAssetMode && validSpecCode"
          :spec-code="validSpecCode"
        />
      </div>
    </div>

    <!-- Confirm/Alert Dialog removed, using ElMessageBox -->
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessageBox } from 'element-plus';
import EditableField from './EditableField.vue';
import DocumentList from './DocumentList.vue';
import QRCodeDisplay from './QRCodeDisplay.vue';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();

const { t } = useI18n();

const props = defineProps({
  roomProperties: {
    type: Object,
    default: null
  },
  selectedIds: {
    type: Array,
    default: () => []
  },
  viewMode: {
    type: String,
    default: 'connect' // 'connect' or 'assets'
  }
});

const emit = defineEmits(['close-properties', 'property-changed']);
const activeTab = ref('ELEMENT');
const collapsedState = reactive({ element_asset: false, element_rel: false, type_asset: false, type_design: true });
const toggleGroup = (key) => collapsedState[key] = !collapsedState[key];

// Helper to show alert using ElMessageBox
const showAlert = async (message, title = '') => {
  await ElMessageBox.alert(message, title || t('common.alert'), {
    confirmButtonText: t('common.confirm'),
    type: 'warning'
  });
};

// Helper to get auth headers
const getHeaders = (contentType = null) => {
  const headers = {};
  if (authStore.token) {
    headers['Authorization'] = `Bearer ${authStore.token}`;
  }
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  return headers;
};

// 创建本地可编辑副本
const localProperties = ref({});

// 监听 props 变化，同步到本地副本
watch(() => props.roomProperties, (newVal) => {
  if (newVal) {
    localProperties.value = { ...newVal };
  } else {
    localProperties.value = {};
  }
}, { deep: true, immediate: true });

// 判断是否为资产模式
const isAssetMode = computed(() => {
  return props.viewMode === 'assets';
});

// 获取有效的规格代码（用于文档显示）
// 多选时，如果规格代码相同（非VARIES），也返回有效值
const validSpecCode = computed(() => {
  const specCode = localProperties.value.typeComments || localProperties.value.specCode;
  // 如果规格代码存在且不是VARIES，则有效
  if (specCode && specCode !== '__VARIES__') {
    return specCode;
  }
  return null;
});

// 定义字段及其类型
// type: 'text' | 'number' | 'date' | 'readonly'
const assetFieldTypes = {
  mcCode: 'readonly',  // 资产编码不可编辑（主键）
  typeComments: 'text', // 规格编码
  specName: 'text',     // 规格名称
  name: 'text',
  level: 'text',
  room: 'text',
  omniClass21Number: 'text',
  omniClass21Description: 'text',
  category: 'text',
  family: 'text',
  type: 'text',
  manufacturer: 'text',
  address: 'text',
  phone: 'text'
};

const spaceFieldTypes = {
  code: 'readonly',  // 空间编码不可编辑（主键）
  name: 'text',
  area: 'number',
  perimeter: 'number',
  level: 'text',
  spaceNumber: 'text',
  spaceDescription: 'text'
};

// 处理字段变更
const handleFieldChange = async (fieldName, newValue) => {
  console.log(`字段 ${fieldName} 更新为:`, newValue);
  
  // 检查是否为批量编辑（多个对象选中）
  const isMultiEdit = props.selectedIds && props.selectedIds.length > 1;
  
  if (isMultiEdit) {
    console.log(`🔢 批量编辑模式: 将更新 ${props.selectedIds.length} 个对象`);
  }
  
  try {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    if (isAssetMode.value) {
      // 更新资产数据
      const assetCodes = isMultiEdit ? props.selectedIds : [props.roomProperties?.mcCode];
      
      if (!assetCodes || assetCodes.length === 0 || !assetCodes[0]) {
        console.error('无法获取资产编码');
        return;
      }
      
      // 根据字段名映射到数据库字段
      const fieldMapping = {
        mcCode: 'asset_code',
        typeComments: 'spec_code',
        specName: 'spec_name',
        name: 'name',
        level: 'floor',
        room: 'room',
        omniClass21Number: 'classification_code',
        omniClass21Description: 'classification_desc',
        category: 'category',
        family: 'family',
        type: 'type',
        manufacturer: 'manufacturer',
        address: 'address',
        phone: 'phone'
      };
      
      const dbField = fieldMapping[fieldName];
      if (!dbField) {
        console.error('未知的字段名:', fieldName);
        return;
      }
      
      // 批量更新所有选中的资产
      let successCount = 0;
      let failCount = 0;
      
      for (const assetCode of assetCodes) {
        try {
          console.log(`🔄 正在更新资产: ${assetCode}`);
          
          const response = await fetch(`${API_BASE}/api/assets/${assetCode}`, {
            method: 'PATCH',
            headers: getHeaders('application/json'),
            body: JSON.stringify({
              [dbField]: newValue
            })
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            console.error(`❌ 更新资产 ${assetCode} 失败:`, errorData);
            failCount++;
            continue;
          }
          
          await response.json();
          console.log(`✅ 资产 ${assetCode} 更新成功`);
          successCount++;
        } catch (err) {
          console.error(`❌ 更新资产 ${assetCode} 异常:`, err);
          failCount++;
        }
      }
      
      // 更新本地副本
      localProperties.value[fieldName] = newValue;
      
      console.log(`✅ 批量更新完成: 成功 ${successCount}, 失败 ${failCount}`);
      
      if (successCount > 0) {
        emit('property-changed', { fieldName, newValue });
      }
      
      if (failCount > 0) {
        await showAlert(t('rightPanel.partialUpdateFailed', { count: failCount }));
      }
      
    } else {
      // 更新空间数据
      const spaceCodes = isMultiEdit ? props.selectedIds : [props.roomProperties?.code];
      
      if (!spaceCodes || spaceCodes.length === 0 || !spaceCodes[0]) {
        console.error('无法获取空间编码');
        return;
      }
      
      const fieldMapping = {
        code: 'space_code',
        name: 'name',
        area: 'area',
        perimeter: 'perimeter',
        level: 'floor',
        spaceNumber: 'classification_code',
        spaceDescription: 'classification_desc'
      };
      
      const dbField = fieldMapping[fieldName];
      if (!dbField) {
        console.error('未知的字段名:', fieldName);
        return;
      }
      
      // 批量更新所有选中的空间
      let successCount = 0;
      let failCount = 0;
      
      for (const spaceCode of spaceCodes) {
        try {
          console.log(`🔄 正在更新空间: ${spaceCode}`);
          
          const response = await fetch(`${API_BASE}/api/spaces/${spaceCode}`, {
            method: 'PATCH',
            headers: getHeaders('application/json'),
            body: JSON.stringify({
              [dbField]: newValue
            })
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            console.error(`❌ 更新空间 ${spaceCode} 失败:`, errorData);
            failCount++;
            continue;
          }
          
          await response.json();
          console.log(`✅ 空间 ${spaceCode} 更新成功`);
          successCount++;
        } catch (err) {
          console.error(`❌ 更新空间 ${spaceCode} 异常:`, err);
          failCount++;
        }
      }
      
      // 更新本地副本
      localProperties.value[fieldName] = newValue;
      
      console.log(`✅ 批量更新完成: 成功 ${successCount}, 失败 ${failCount}`);
      
      if (successCount > 0) {
        emit('property-changed', { fieldName, newValue });
      }
      
      if (failCount > 0) {
        await showAlert(t('rightPanel.partialUpdateFailed', { count: failCount }));
      }
    }
  } catch (error) {
    console.error('保存失败:', error);
    await showAlert(t('common.saveFailed') + ': ' + error.message);
  }
};

// 格式化属性值，处理 VARIES 标记
const formatValue = (value) => {
  const v = value == null ? '' : String(value);
  if (v === '__VARIES__') {
    return t('common.varies');
  }
  return v;
};

const isVaries = (value) => String(value) === '__VARIES__';

// 判断字段是否可编辑
const isFieldEditable = (fieldName) => {
  // 允许多选状态下编辑（批量编辑）
  const fieldTypes = isAssetMode.value ? assetFieldTypes : spaceFieldTypes;
  
  // 检查权限
  if (isAssetMode.value) {
    if (!authStore.hasPermission('asset:update')) return false;
  } else {
    if (!authStore.hasPermission('space:update')) return false;
  }

  return fieldTypes[fieldName] !== 'readonly';
};

// 获取字段类型
const getFieldType = (fieldName) => {
  const fieldTypes = isAssetMode.value ? assetFieldTypes : spaceFieldTypes;
  return fieldTypes[fieldName] || 'text';
};

// 计算面包屑文本
const breadcrumbText = computed(() => {
  if (isAssetMode.value) {
    // 资产模式
    if (props.roomProperties) {
      if (props.roomProperties.isMultiple) {
        return `${t('rightPanel.asset')} : ${t('common.multiple')}`;
      }
      return `${t('rightPanel.asset')} : ${props.roomProperties.name || t('common.unnamed')}`;
    }
    return t('rightPanel.asset');
  } else {
    // 房间模式
    if (props.roomProperties) {
      if (props.roomProperties.isMultiple) {
        return `${t('rightPanel.room')} : ${t('common.multiple')}`;
      }
      return `${t('rightPanel.room')} : ${props.roomProperties.name || t('common.unnamed')}`;
    }
    return t('rightPanel.room');
  }
});
</script>

<style scoped>
.right-panel { width: 100%; height: 100%; background: #252526; border-left: 1px solid #1e1e1e; display: flex; flex-direction: column; font-size: 11px; color: #ccc; user-select: none; }
.header-row { height: 36px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; font-weight: 600; flex-shrink: 0; color: #eee; }
.header-icons { display: flex; gap: 12px; } .icon-btn { cursor: pointer; color: #ccc; } .icon-btn:hover { color: #fff; } .close-icon:hover { color: #ff6b6b; }
.breadcrumb-row { padding: 4px 12px 10px 12px; font-size: 11px; color: #fff; display: flex; align-items: center; border-bottom: 1px solid #333; }
.breadcrumb-text { margin-right: 6px; } .link-icon { cursor: pointer; }
.tabs { display: flex; border-bottom: 1px solid #333; height: 32px; flex-shrink: 0; background: #252526; }
.tab { flex: 0 0 auto; padding: 0 16px; display: flex; align-items: center; cursor: pointer; color: #888; font-weight: 600; border-bottom: 2px solid transparent; transition: color 0.2s; }
.tab:hover { color: #ccc; } .tab.active { color: #38ABDF; border-bottom-color: #38ABDF; }
.add-action { margin-left: auto; padding-right: 12px; color: #38ABDF; display: flex; align-items: center; gap: 4px; cursor: pointer; }
.scroll-content { flex: 1; overflow-y: auto; overflow-x: hidden; }
.group-header { background: #2d2d2d; padding: 8px 12px; font-weight: 600; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; border-top: 1px solid #333; margin-top: -1px; cursor: pointer; color: #fff; }
.group-header:hover { background: #333; }
.arrow-icon { transition: transform 0.2s; } .arrow-icon.rotated { transform: rotate(180deg); }
.group-body { padding-bottom: 8px; } .form-group { padding: 8px 12px; } .sub-label { color: #fff; font-weight: 600; margin-bottom: 8px; }
.row { display: flex; align-items: center; margin-bottom: 6px; height: 26px; } .row label { flex: 0 0 70px; color: #999; display: flex; align-items: center; }
.info-i { display: inline-flex; width: 12px; height: 12px; border: 1px solid #38ABDF; color: #38ABDF; border-radius: 50%; font-size: 9px; align-items: center; justify-content: center; margin-left: 4px; cursor: help; }
.val-box { flex: 1; background: #1e1e1e; border: 1px solid #3e3e42; min-height: 24px; display: flex; align-items: center; padding: 0 8px; border-radius: 2px; color: #eee; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: text; }
.val-box:hover { border-color: #555; } .val-box.placeholder { color: #777; font-style: normal; } .val-box.dropdown { justify-content: space-between; cursor: pointer; } .val-box.multiline { white-space: normal; line-height: 1.2; padding: 4px 8px; height: auto; }
.link-text { color: #38ABDF; text-decoration: underline; cursor: pointer; }
</style>
