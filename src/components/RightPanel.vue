<template>
  <div class="right-panel">
    <div class="header-row">
      <span>{{ t('rightPanel.properties') }}</span>
      <div class="header-icons">
        <svg class="icon-btn" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
        <svg class="icon-btn" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        <svg class="icon-btn close-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" @click="$emit('close-properties')"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </div>
    </div>
    <div class="breadcrumb-row"><span class="breadcrumb-text">{{ breadcrumbText }}</span><svg class="link-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg></div>
    <div class="tabs">
      <div class="tab" :class="{ active: activeTab === 'ELEMENT' }" @click="activeTab = 'ELEMENT'">{{ t('rightPanel.element') }}</div>
      <div class="tab" :class="{ active: activeTab === 'TYPE' }" @click="activeTab = 'TYPE'">{{ t('rightPanel.type') }}</div>
      <div class="add-action">+ {{ t('common.add') }} <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></div>
    </div>
    <div class="scroll-content">
      <div v-if="activeTab === 'ELEMENT'">
        <div class="group-header" @click="toggleGroup('element_asset')"><span>{{ t('rightPanel.assetProperties') }}</span><svg class="arrow-icon" :class="{ rotated: collapsedState.element_asset }" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg></div>
        <div class="group-body" v-show="!collapsedState.element_asset">
          <!-- 资产模式 -->
          <div class="form-group" v-if="isAssetMode">
            <div class="sub-label">{{ t('rightPanel.common') }}</div>
            <div class="row"><label>{{ t('rightPanel.name') }}</label><div class="val-box">{{ formatValue(roomProperties?.name) }}</div></div>
            <div class="row"><label>{{ t('rightPanel.mcCode') }}</label><div class="val-box">{{ formatValue(roomProperties?.mcCode) }}</div></div>
            <div class="row"><label>{{ t('rightPanel.level') }}</label><div class="val-box">{{ formatValue(roomProperties?.level) }}</div></div>
          </div>
          <!-- 房间模式 -->
          <div class="form-group" v-else-if="roomProperties">
            <div class="sub-label">{{ t('rightPanel.common') }}</div>
            <div class="row"><label>{{ t('rightPanel.code') }}</label><div class="val-box">{{ roomProperties.code || t('common.none') }}</div></div>
            <div class="row"><label>{{ t('rightPanel.name') }}</label><div class="val-box">{{ roomProperties.name || t('common.none') }}</div></div>
            <div class="row"><label>{{ t('rightPanel.area') }}</label><div class="val-box">{{ roomProperties.area || t('common.none') }}</div></div>
            <div class="row"><label>{{ t('rightPanel.perimeter') }}</label><div class="val-box">{{ roomProperties.perimeter || t('common.none') }}</div></div>
          </div>
          <!-- 默认属性 -->
          <div class="form-group" v-else>
            <div class="sub-label">{{ t('rightPanel.common') }}</div>
            <div class="row"><label>{{ t('rightPanel.name') }}</label><div class="val-box">{{ t('rightPanel.systemPanel') }} 1</div></div>
            <div class="row"><label>{{ t('rightPanel.level') }}</label><div class="val-box">Q-1F</div></div>
            <div class="row"><label>{{ t('rightPanel.assemblyCode') }}</label><div class="val-box placeholder">{{ t('rightPanel.selectUniformat') }}</div></div>
            <div class="row"><label>{{ t('rightPanel.tandemCategory') }}</label><div class="val-box">{{ t('rightPanel.panel') }}</div></div>
          </div>
        </div>
        <div class="group-header" @click="toggleGroup('element_rel')"><span>{{ t('rightPanel.relationships') }}</span><svg class="arrow-icon" :class="{ rotated: collapsedState.element_rel }" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg></div>
        <div class="group-body" v-show="!collapsedState.element_rel">
          <div class="form-group"><div class="row"><label>{{ t('rightPanel.rooms') }}</label><div class="val-box placeholder">{{ t('rightPanel.selectRooms') }}</div></div><div class="row"><label>{{ t('rightPanel.parent') }}</label><div class="link-text">{{ t('rightPanel.curtainWall') }}</div></div></div>
        </div>
      </div>
      <div v-if="activeTab === 'TYPE'">
        <div class="group-header" @click="toggleGroup('type_asset')"><span>{{ t('rightPanel.assetProperties') }}</span><svg class="arrow-icon" :class="{ rotated: collapsedState.type_asset }" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg></div>
        <div class="group-body" v-show="!collapsedState.type_asset">
          <!-- 资产模式 -->
          <div class="form-group" v-if="isAssetMode">
            <div class="sub-label">{{ t('rightPanel.common') }}</div>
            <div class="row"><label>{{ t('rightPanel.omniClass21Number') }}</label><div class="val-box">{{ formatValue(roomProperties?.omniClass21Number) }}</div></div>
            <div class="row"><label>{{ t('rightPanel.omniClass21Description') }}</label><div class="val-box">{{ formatValue(roomProperties?.omniClass21Description) }}</div></div>
            <div class="row"><label>{{ t('rightPanel.category') }}</label><div class="val-box">{{ formatValue(roomProperties?.category) }}</div></div>
            <div class="row"><label>{{ t('rightPanel.family') }}</label><div class="val-box">{{ formatValue(roomProperties?.family) }}</div></div>
            <div class="row"><label>{{ t('rightPanel.typeLabel') }}</label><div class="val-box">{{ formatValue(roomProperties?.type) }}</div></div>
            <div class="row"><label>{{ t('rightPanel.typeComments') }}</label><div class="val-box">{{ formatValue(roomProperties?.typeComments) }}</div></div>
            <div class="row"><label>{{ t('rightPanel.manufacturer') }}</label><div class="val-box">{{ formatValue(roomProperties?.manufacturer) }}</div></div>
          </div>
          <!-- 默认类型属性 -->
          <div class="form-group" v-else>
            <div class="sub-label">{{ t('rightPanel.common') }}</div>
            <div class="row"><label>{{ t('rightPanel.name') }}</label><div class="val-box">{{ t('rightPanel.glass') }}</div></div>
            <div class="row"><label>{{ t('rightPanel.assemblyCode') }} <span class="info-i">i</span></label><div class="val-box placeholder dropdown">{{ t('rightPanel.selectUniformat') }}<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></div></div>
            <div class="row"><label>{{ t('rightPanel.tandemCategory') }}</label><div class="val-box dropdown">{{ t('rightPanel.panel') }}<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></div></div>
            <div class="row" style="height: auto; align-items: flex-start; margin-top: 6px;"><label style="margin-top: 4px;">{{ t('rightPanel.classification') }} <span class="info-i">i</span></label><div class="val-box placeholder dropdown multiline">{{ t('rightPanel.selectClassification') }}<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></div></div>
          </div>
        </div>
        <div class="group-header" @click="toggleGroup('type_design')"><span>{{ t('rightPanel.designProperties') }}</span><svg class="arrow-icon" :class="{ rotated: collapsedState.type_design }" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg></div>
        <div class="group-body" v-show="!collapsedState.type_design"><div class="form-group"><div class="row"><label>{{ t('rightPanel.manufacturer') }}</label><div class="val-box placeholder">{{ t('common.none') }}</div></div><div class="row"><label>{{ t('rightPanel.model') }}</label><div class="val-box placeholder">{{ t('common.none') }}</div></div></div></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  roomProperties: {
    type: Object,
    default: null
  },
  viewMode: {
    type: String,
    default: 'connect' // 'connect' or 'assets'
  }
});

const emit = defineEmits(['close-properties']);
const activeTab = ref('ELEMENT');
const collapsedState = reactive({ element_asset: false, element_rel: false, type_asset: false, type_design: true });
const toggleGroup = (key) => collapsedState[key] = !collapsedState[key];

// 判断是否为资产模式
const isAssetMode = computed(() => {
  return props.viewMode === 'assets';
});

// 格式化属性值，处理 VARIES 标记
const formatValue = (value) => {
  if (value === '__VARIES__') {
    return t('common.varies');
  }
  return value || '';
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
    return `${t('rightPanel.curtainWallPanel')} : ${t('rightPanel.systemPanel')} 1 : ${t('rightPanel.glass')}`;
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
.tab:hover { color: #ccc; } .tab.active { color: #00b0ff; border-bottom-color: #00b0ff; }
.add-action { margin-left: auto; padding-right: 12px; color: #00b0ff; display: flex; align-items: center; gap: 4px; cursor: pointer; }
.scroll-content { flex: 1; overflow-y: auto; overflow-x: hidden; }
.group-header { background: #2d2d2d; padding: 8px 12px; font-weight: 600; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; border-top: 1px solid #333; margin-top: -1px; cursor: pointer; color: #fff; }
.group-header:hover { background: #333; }
.arrow-icon { transition: transform 0.2s; } .arrow-icon.rotated { transform: rotate(180deg); }
.group-body { padding-bottom: 8px; } .form-group { padding: 8px 12px; } .sub-label { color: #fff; font-weight: 600; margin-bottom: 8px; }
.row { display: flex; align-items: center; margin-bottom: 6px; height: 26px; } .row label { flex: 0 0 110px; color: #999; display: flex; align-items: center; }
.info-i { display: inline-flex; width: 12px; height: 12px; border: 1px solid #00b0ff; color: #00b0ff; border-radius: 50%; font-size: 9px; align-items: center; justify-content: center; margin-left: 4px; cursor: help; }
.val-box { flex: 1; background: #1e1e1e; border: 1px solid #3e3e42; min-height: 24px; display: flex; align-items: center; padding: 0 8px; border-radius: 2px; color: #eee; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: text; }
.val-box:hover { border-color: #555; } .val-box.placeholder { color: #777; font-style: normal; } .val-box.dropdown { justify-content: space-between; cursor: pointer; } .val-box.multiline { white-space: normal; line-height: 1.2; padding: 4px 8px; height: auto; }
.link-text { color: #00b0ff; text-decoration: underline; cursor: pointer; }
</style>