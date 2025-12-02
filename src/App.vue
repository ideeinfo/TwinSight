<template>
  <div class="app-layout" @mouseup="stopResize" @mouseleave="stopResize">
    <TopBar />
    
    <div class="main-body" ref="mainBody" @mousemove="onResize">
      
      <!-- 左侧面板 -->
      <div class="panel-wrapper" :style="{ width: leftWidth + 'px' }">
        <LeftPanel :rooms="roomList" @open-properties="openRightPanel" />
      </div>

      <div class="resizer" @mousedown="startResize($event, 'left')"></div>

      <!-- 中间主视图 -->
      <div class="main-content">
        <MainView @rooms-loaded="onRoomsLoaded" />
      </div>

      <!-- 右侧拖拽条 -->
      <div 
        v-if="isRightPanelOpen" 
        class="resizer" 
        @mousedown="startResize($event, 'right')"
      ></div>

      <!-- 右侧面板 -->
      <div 
        v-if="isRightPanelOpen" 
        class="panel-wrapper" 
        :style="{ width: rightWidth + 'px' }"
      >
        <RightPanel @close-properties="closeRightPanel" />
      </div>
      
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted, nextTick } from 'vue';
import TopBar from './components/TopBar.vue';
import LeftPanel from './components/LeftPanel.vue';
import RightPanel from './components/RightPanel.vue';
import MainView from './components/MainView.vue';

const leftWidth = ref(300);
const rightWidth = ref(320);
const isRightPanelOpen = ref(true);
const roomList = ref([]);

const onRoomsLoaded = (rooms) => {
  roomList.value = rooms;
};

const openRightPanel = () => {
  isRightPanelOpen.value = true;
  triggerResize(); // 面板出现时，强制刷新布局
};

const closeRightPanel = () => {
  isRightPanelOpen.value = false;
  triggerResize(); // 面板关闭时，强制刷新布局
};

// === 核心修复：强制触发 Resize 事件 ===
// Autodesk Viewer 监听 window resize，这样可以间接让 Viewer 适应新容器大小
const triggerResize = () => {
  nextTick(() => {
    window.dispatchEvent(new Event('resize'));
  });
};

let startX = 0;
let startWidth = 0;
let currentResizeSide = '';

const startResize = (event, side) => {
  currentResizeSide = side;
  startX = event.clientX;
  startWidth = side === 'left' ? leftWidth.value : rightWidth.value;
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', stopResize);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
};

const onMouseMove = (event) => {
  const dx = event.clientX - startX;
  if (currentResizeSide === 'left') {
    const newWidth = startWidth + dx;
    if (newWidth > 200 && newWidth < 600) {
      leftWidth.value = newWidth;
      triggerResize(); // 实时拖拽时触发
    }
  } else {
    const newWidth = startWidth - dx;
    if (newWidth > 250 && newWidth < 800) {
      rightWidth.value = newWidth;
      triggerResize(); // 实时拖拽时触发
    }
  }
};

const stopResize = () => {
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', stopResize);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  currentResizeSide = '';
  triggerResize(); // 结束时再次确认
};

onUnmounted(() => {
  stopResize();
});
</script>

<style>
/* 保持原有样式不变 */
* { box-sizing: border-box; }
body, html { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; background: #1e1e1e; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
#app { height: 100vh; width: 100vw; display: flex; flex-direction: column; max-width: none !important; margin: 0 !important; padding: 0 !important; }
.app-layout { display: flex; flex-direction: column; height: 100%; width: 100%; }
.main-body { display: flex; flex: 1; overflow: hidden; position: relative; width: 100%; }
.panel-wrapper { flex-shrink: 0; height: 100%; overflow: hidden; position: relative; z-index: 20; transition: width 0.05s ease-out; }
.main-content { flex: 1; min-width: 0; height: 100%; position: relative; z-index: 10; display: flex; flex-direction: column; }
.resizer { width: 5px; background: #111; cursor: col-resize; flex-shrink: 0; z-index: 50; transition: background 0.2s; }
.resizer:hover, .resizer:active { background: #0078d4; }
</style>