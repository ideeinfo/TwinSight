<template>
  <div class="right-panel">
    <div class="header-row">
      <span>PROPERTIES</span>
      <div class="header-icons">
        <svg class="icon-btn" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
        <svg class="icon-btn" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        <svg class="icon-btn close-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" @click="$emit('close-properties')"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </div>
    </div>
    <div class="breadcrumb-row"><span class="breadcrumb-text">{{ breadcrumbText }}</span><svg class="link-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg></div>
    <div class="tabs">
      <div class="tab" :class="{ active: activeTab === 'ELEMENT' }" @click="activeTab = 'ELEMENT'">ELEMENT</div>
      <div class="tab" :class="{ active: activeTab === 'TYPE' }" @click="activeTab = 'TYPE'">TYPE</div>
      <div class="add-action">+ Add <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></div>
    </div>
    <div class="scroll-content">
      <div v-if="activeTab === 'ELEMENT'">
        <div class="group-header" @click="toggleGroup('element_asset')"><span>ASSET PROPERTIES</span><svg class="arrow-icon" :class="{ rotated: collapsedState.element_asset }" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg></div>
        <div class="group-body" v-show="!collapsedState.element_asset">
          <div class="form-group" v-if="roomProperties">
            <div class="sub-label">Common</div>
            <div class="row"><label>编号</label><div class="val-box">{{ roomProperties.code || '--' }}</div></div>
            <div class="row"><label>名称</label><div class="val-box">{{ roomProperties.name || '--' }}</div></div>
            <div class="row"><label>面积</label><div class="val-box">{{ roomProperties.area || '--' }}</div></div>
            <div class="row"><label>周长</label><div class="val-box">{{ roomProperties.perimeter || '--' }}</div></div>
          </div>
          <div class="form-group" v-else>
            <div class="sub-label">Common</div>
            <div class="row"><label>Name</label><div class="val-box">系统面板 1</div></div>
            <div class="row"><label>Level</label><div class="val-box">Q-1F</div></div>
            <div class="row"><label>Assembly Code</label><div class="val-box placeholder">Select Uniformat</div></div>
            <div class="row"><label>Tandem Category</label><div class="val-box">Panel</div></div>
          </div>
        </div>
        <div class="group-header" @click="toggleGroup('element_rel')"><span>RELATIONSHIPS</span><svg class="arrow-icon" :class="{ rotated: collapsedState.element_rel }" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg></div>
        <div class="group-body" v-show="!collapsedState.element_rel">
          <div class="form-group"><div class="row"><label>Rooms</label><div class="val-box placeholder">Select Room(s)</div></div><div class="row"><label>Parent</label><div class="link-text">幕墙</div></div></div>
        </div>
      </div>
      <div v-if="activeTab === 'TYPE'">
        <div class="group-header" @click="toggleGroup('type_asset')"><span>ASSET PROPERTIES</span><svg class="arrow-icon" :class="{ rotated: collapsedState.type_asset }" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg></div>
        <div class="group-body" v-show="!collapsedState.type_asset">
          <div class="form-group"><div class="sub-label">Common</div><div class="row"><label>Name</label><div class="val-box">玻璃</div></div><div class="row"><label>Assembly Code <span class="info-i">i</span></label><div class="val-box placeholder dropdown">Select Uniformat<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></div></div><div class="row"><label>Tandem Category</label><div class="val-box dropdown">Panel<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></div></div><div class="row" style="height: auto; align-items: flex-start; margin-top: 6px;"><label style="margin-top: 4px;">Classification <span class="info-i">i</span></label><div class="val-box placeholder dropdown multiline">Select CAClass-20241024<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></div></div></div>
        </div>
        <div class="group-header" @click="toggleGroup('type_design')"><span>DESIGN PROPERTIES</span><svg class="arrow-icon" :class="{ rotated: collapsedState.type_design }" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg></div>
        <div class="group-body" v-show="!collapsedState.type_design"><div class="form-group"><div class="row"><label>Manufacturer</label><div class="val-box placeholder">--</div></div><div class="row"><label>Model</label><div class="val-box placeholder">--</div></div></div></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';

const props = defineProps({
  roomProperties: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close-properties']);
const activeTab = ref('ELEMENT');
const collapsedState = reactive({ element_asset: false, element_rel: false, type_asset: false, type_design: true });
const toggleGroup = (key) => collapsedState[key] = !collapsedState[key];

// 计算面包屑文本
const breadcrumbText = computed(() => {
  if (props.roomProperties) {
    if (props.roomProperties.isMultiple) {
      return '房间 : 多个';
    }
    return `房间 : ${props.roomProperties.name || '未命名'}`;
  }
  return '幕墙嵌板 : 系统面板 1 : 玻璃';
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