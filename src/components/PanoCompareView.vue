<template>
  <div class="pano-compare-container">
    <!-- 顶部控制栏 -->
    <div class="compare-header">
      <div class="header-left">
        <button class="icon-btn" title="返回" @click="goBack">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <span class="title">全景比对: {{ fileName }}</span>
      </div>
      <div class="header-center">
        <!-- 模式切换 -->
        <div class="mode-group">
          <button class="mode-btn" :class="{ active: !isOverlayMode }" title="左右对比" @click="setOverlayMode(false)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="18" rx="2" />
              <line x1="12" y1="3" x2="12" y2="21" />
            </svg>
          </button>
          <button class="mode-btn" :class="{ active: isOverlayMode }" title="重叠对比" @click="setOverlayMode(true)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="4" />
              <rect x="2" y="2" width="20" height="20" rx="2" stroke-opacity="0.5" />
            </svg>
          </button>
        </div>

        <!-- 透明度滑块 (仅重叠模式显示) -->
        <div v-if="isOverlayMode" class="opacity-slider">
          <span style="flex-shrink: 0;">透明度</span>
          <el-slider 
            v-model="panoOpacity" 
            :min="0" 
            :max="1" 
            :step="0.1" 
            :show-tooltip="false"
            style="width: 100px; margin-left: 10px;"
          />
        </div>

        <div class="divider"></div>

        <button class="mode-btn" :class="{ active: isFineTuneMode }" title="微调模式" @click="toggleFineTune">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          微调
        </button>

        <div class="divider"></div>

        <button 
          class="sync-btn" 
          :class="{ active: isSyncEnabled }" 
          @click="toggleSync"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          {{ isSyncEnabled ? '同步锁定' : '自由视角' }}
        </button>
      </div>
      <div class="header-right">
        <button v-if="defaultViewState" class="icon-btn" title="应用默认视图" @click="applyDefaultView">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7Z" />
          </svg>
          重置视角
        </button>
        <button v-if="currentViewId" class="icon-btn" title="保存当前状态为默认视图" @click="saveDefaultView">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          保存默认
        </button>
      </div>
    </div>

    <!-- 主体分屏区域 -->
    <div class="split-container" :class="{ 'overlay-mode': isOverlayMode }">
      <!-- 微调控制面板 -->
      <div v-if="isFineTuneMode" class="fine-tune-panel">
        <div class="control-section">
          <span class="section-title">模型相机移动</span>
          <div class="dpad-grid">
            <div class="dpad-cell"></div>
            <button class="dpad-btn" title="前进" @click="moveModelCamera('forward')">▲</button>
            <div class="dpad-cell"></div>
                  
            <button class="dpad-btn" title="左移" @click="moveModelCamera('left')">◀</button>
            <button class="dpad-btn" title="后退" @click="moveModelCamera('backward')">▼</button>
            <button class="dpad-btn" title="右移" @click="moveModelCamera('right')">▶</button>
                  
            <div class="dpad-cell"></div>
            <div class="dpad-vertical">
              <button class="dpad-btn" title="上升" @click="moveModelCamera('up')">↑</button>
              <button class="dpad-btn" title="下降" @click="moveModelCamera('down')">↓</button>
            </div>
            <div class="dpad-cell"></div>
          </div>
        </div>
        <div class="divider-h"></div>
        <div class="control-section">
          <span class="section-title">模型滚转 ({{ modelRoll }}°)</span>
          <div class="roll-controls">
            <button class="roll-btn" title="左滚转" @click="updateModelRoll(-1)">↶ -1°</button>
            <button class="roll-btn" title="右滚转" @click="updateModelRoll(1)">↷ +1°</button>
          </div>
        </div>
        <div class="divider-h"></div>
        <div class="control-section">
          <span class="section-title">模型 FOV ({{ modelFov.toFixed(1) }}°)</span>
          <div class="fov-controls">
            <button class="roll-btn" title="减小 FOV" @click="changeModelFov(-0.1)">-</button>
            <span class="fov-display">{{ modelFov.toFixed(1) }}°</span>
            <button class="roll-btn" title="增大 FOV" @click="changeModelFov(0.1)">+</button>
          </div>
        </div>
      </div>

      <!-- 左侧：全景图 (上层) -->
      <div 
        ref="leftPane" 
        class="pane left-pane"
        :style="isOverlayMode ? { opacity: panoOpacity, pointerEvents: (isOverlayMode && !isFineTuneMode) ? 'auto' : 'none' } : {}"
      >
        <div v-if="!panoUrl" class="upload-placeholder" @click="triggerUpload">
          <div class="upload-content">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <p>点击上传全景图</p>
            <span class="sub-text">支持 .jpg, .png 格式</span>
          </div>
        </div>
        <input 
          ref="fileInput" 
          type="file" 
          accept="image/jpeg,image/png" 
          style="display: none" 
          @change="handleFileUpload"
        />
        <div v-show="panoUrl" ref="panoContainer" class="pano-viewer"></div>
      </div>

      <!-- 右侧：BIM 模型 (底层) -->
      <div 
        ref="rightPane" 
        class="pane right-pane"
      >
        <div id="compare-forge-viewer" ref="forgeContainer"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { Viewer } from '@photo-sphere-viewer/core';
import '@photo-sphere-viewer/core/index.css';
import { useAuthStore } from '../stores/auth';

const props = defineProps({
  fileId: { type: String, default: '' },
  fileName: { type: String, default: '' },
  modelPath: { type: String, default: '' }
});

defineEmits(['close']);

// 状态
const isSyncEnabled = ref(false);
const panoUrl = ref(null);
const fileInput = ref(null);
const leftPane = ref(null);
const rightPane = ref(null);
const defaultViewState = ref(null); // 存储默认视图状态供手动恢复
const yawOffset = ref(0); // 全景图与模型的水平角度偏差
const pitchOffset = ref(0); // 全景图与模型的垂直角度偏差
const currentVerticalFov = ref(90);
const currentViewId = ref(null);
const currentOtherSettings = ref({});
const currentPanoFileId = ref(null);
const pendingPanoState = ref(null); // 暂存待恢复的全景视角状态
const isOverlayMode = ref(false); // 是否为重叠对比模式
const panoOpacity = ref(0.5); // 全景图透明度 (0-1)
const isFineTuneMode = ref(false); // 是否为微调模式
const modelFov = ref(90); // 模型视场角 (FOV)，默认90
const modelRoll = ref(0); // 模型滚转角度 (累计值)
const authStore = useAuthStore();

// Helper to get auth headers
const getHeaders = () => {
  const headers = {};
  if (authStore.token) {
    headers['Authorization'] = `Bearer ${authStore.token}`;
  }
  return headers;
};

// Viewer 实例
const panoContainer = ref(null);
const forgeContainer = ref(null);
let psv = null;
let viewer = null;

// 返回上一页（或关闭标签页）
const goBack = () => {
  if (window.opener) {
    window.close();
  } else {
    // 如果是在当前页路由切换
    window.location.href = '/';
  }
};

// 触发文件上传
const triggerUpload = () => {
  console.log('🖱️ 点击上传区域');
  if (fileInput.value) {
    console.log('✅ fileInput ref 存在，触发 click');
    fileInput.value.click();
  } else {
    console.error('❌ fileInput ref 为空');
  }
};

// 处理全景图上传
const handleFileUpload = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    // 暂时使用 Data URL 进行预览，实际应上传到服务器
    // 这里为了演示直接加载
    panoUrl.value = e.target.result;
    initPanoViewer();
    // TODO: 调用上传 API 进行持久化
    uploadPanoImage(file);
  };
  reader.readAsDataURL(file);
};

// 上传全景图到服务器 (持久化)
const uploadPanoImage = async (file) => {
  if (!props.fileId) return;
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', `Pano_View_${currentViewId.value || 'temp'}`);
  
  // 使用 v2 API 的 associations 格式
  if (currentViewId.value) {
      const associations = [{ type: 'view', code: String(currentViewId.value) }];
      formData.append('associations', JSON.stringify(associations));
  } else {
      console.warn('⚠️ 当前没有 View ID，全景图可能无法正确关联');
  }
  
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  
  try {
    // 使用 v2 文档上传接口
    const res = await fetch(`${API_BASE}/api/v2/documents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      },
      body: formData
    });
    const data = await res.json();
    if (data.success && data.data && data.data.id) {
        console.log('✅ 全景图已上传, ID:', data.data.id);
        currentPanoFileId.value = data.data.id;
    }
  } catch (error) {
    console.error('上传全景图失败:', error);
  }
};

// 初始化 Photo Sphere Viewer
const initPanoViewer = () => {
  if (psv) {
    psv.destroy();
  }
  
  if (!panoUrl.value || !panoContainer.value) return;

  psv = new Viewer({
    container: panoContainer.value,
    panorama: panoUrl.value,
    defaultZoomLvl: 0, // 0对应此时的maxFov (90度)
    touchmoveTwoFingers: true,
    mousewheelCtrlKey: true,
    minFov: 30,
    maxFov: 90,
    navbar: [
      'zoom',
      'fullscreen',
    ],
  });

  psv.addEventListener('ready', () => {
       if (pendingPanoState.value) {
           console.log('⏳ 应用暂存的全景视角...');
           
            // 移除 Roll 恢复
            // if (pendingPanoState.value.roll !== undefined) { ... }

            psv.animate({
                yaw: pendingPanoState.value.yaw,
                pitch: pendingPanoState.value.pitch,
                zoom: pendingPanoState.value.zoom || 0,
                speed: 1000,
            });
            pendingPanoState.value = null;
       }
  });

  psv.addEventListener('position-updated', onPanoPositionUpdated);
  psv.addEventListener('zoom-updated', onPanoZoomUpdated);
};

// 初始化 Forge Viewer
const initForgeViewer = () => {
  console.log('🔧 [PanoView] initForgeViewer 开始');
  
  if (!window.Autodesk) {
    console.error('❌ [PanoView] window.Autodesk 不存在');
    return;
  }
  
  const options = { env: 'Local', document: null, language: 'zh-cn' };
  
  // 确保 Forge Viewer 容器清空
  if (forgeContainer.value) {
    forgeContainer.value.innerHTML = '';
    
    // 强制设置容器尺寸以防 CSS 计算问题
    const rect = forgeContainer.value.getBoundingClientRect();
    console.log(`📐 [PanoView] 容器尺寸: ${rect.width}x${rect.height}`);
    
    if (rect.width === 0 || rect.height === 0) {
      console.warn('⚠️ [PanoView] 容器尺寸为 0，尝试强制设置');
      forgeContainer.value.style.width = '100%';
      forgeContainer.value.style.height = '100%';
      forgeContainer.value.style.minHeight = '400px';
    }
  }

  window.Autodesk.Viewing.Initializer(options, () => {
    console.log('🔧 [PanoView] Autodesk.Viewing.Initializer 回调执行');
    
    // 再次检查容器是否存在，防止初始化时组件已卸载
    if (!forgeContainer.value) {
      console.error('❌ [PanoView] 容器在初始化回调中为 null');
      return;
    }
    
    // 再次检查容器尺寸
    const rect2 = forgeContainer.value.getBoundingClientRect();
    console.log(`📐 [PanoView] 初始化时容器尺寸: ${rect2.width}x${rect2.height}`);
    
    if (rect2.width === 0 || rect2.height === 0) {
      console.error('❌ [PanoView] 容器尺寸仍为 0，跳过 Viewer 创建');
      return;
    }

    try {
      console.log('🔧 [PanoView] 创建 GuiViewer3D 实例...');
      viewer = new window.Autodesk.Viewing.GuiViewer3D(forgeContainer.value);
      
      // 禁用扩展加载，只保留核心
      const config3d = {
        extensions: [] 
      };
      
      console.log('🔧 [PanoView] 调用 viewer.start()...');
      const startResult = viewer.start(undefined, undefined, undefined, undefined, config3d);
      console.log(`🔧 [PanoView] viewer.start() 返回: ${startResult}`);
      
      if (startResult > 0) {
        console.error('❌ [PanoView] viewer.start() 失败');
        return;
      }
      
      console.log('✅ [PanoView] Viewer 启动成功');
      viewer.setTheme('light-theme'); // 与比对界面风格一致
      
      // 加载模型
      if (props.modelPath) {
        loadModel(props.modelPath);
      }
    } catch (e) {
      console.error('❌ [PanoView] Viewer 初始化异常:', e);
    }
  });
};

const loadModel = (path) => {
  console.log('📦 [PanoView] 准备加载模型:', path);
  if (!viewer) {
    console.error('❌ [PanoView] Viewer 实例不存在，无法加载模型');
    return;
  }

  // 路径处理
  let finalPath = path;
  if (!path.endsWith('.svf')) {
    finalPath = `${path}/output/3d.svf`;
  }
  
  console.log('📦 [PanoView] 最终模型路径:', finalPath);
  viewer.loadModel(finalPath, {}, () => {
    console.log('✅ 模型加载请求已发送');
    
    // 默认启用第一人称模式
    const tool = viewer.toolController.getTool('firstperson');
    if (tool) {
      viewer.toolController.activateTool('firstperson');
    }

    // 定义加载完成后的回调
    const onGeometryLoaded = async () => {
      console.log('🏗️ [PanoView] 几何体加载完成 (GEOMETRY_LOADED_EVENT)');
      viewer.removeEventListener(window.Autodesk.Viewing.GEOMETRY_LOADED_EVENT, onGeometryLoaded);

      // 尝试恢复默认视图
      try {
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        // 获取默认视图元数据
        console.log('🔍 [PanoView] 尝试获取默认视图, fileId:', props.fileId);
        const defaultViewRes = await fetch(`${API_BASE}/api/views/default?fileId=${props.fileId}`, { headers: getHeaders() });
        const defaultViewData = await defaultViewRes.json();
        console.log('📄 [PanoView] 默认视图API响应:', defaultViewData);
        
        if (defaultViewData.success && defaultViewData.data) {
          // 获取完整视图状态
           console.log('📥 [PanoView] 获取完整视图详情:', defaultViewData.data.id);
           const fullViewRes = await fetch(`${API_BASE}/api/views/${defaultViewData.data.id}`, { headers: getHeaders() });
           const fullViewData = await fullViewRes.json();
           if (fullViewData.success) {
               console.log('🔄 [PanoView] 正在恢复默认视图:', defaultViewData.data.name);
               console.log('📦 [PanoView] 视图数据详情:', JSON.stringify(fullViewData.data));
               
               // 保存关键信息供保存使用
               currentViewId.value = fullViewData.data.id;
               currentOtherSettings.value = fullViewData.data.other_settings || {};

               // 恢复保存的模型 FOV (关键修复)
               if (currentOtherSettings.value.modelFov) {
                   const savedFov = currentOtherSettings.value.modelFov;
                   console.log(`📸 [PanoView] 从数据库恢复模型 FOV: ${savedFov}`);
                   modelFov.value = savedFov;
                   currentVerticalFov.value = savedFov;
                   viewer.setFOV(savedFov);
               } else {
                   // 无保存值，使用默认 90
                   console.log('📸 [PanoView] 未找到已保存的 FOV，使用默认值 90');
                   modelFov.value = 90;
                   currentVerticalFov.value = 90;
                   viewer.setFOV(90);
               }

               // 修正：API 返回的是视图对象，Forge Viewer State 在 viewer_state 字段中
               const viewState = fullViewData.data.viewer_state || fullViewData.data;
               
               // 保存到状态以便手动恢复
               defaultViewState.value = viewState;
               
               // 尝试直接恢复
               const success = viewer.restoreState(viewState);
               console.log('✨ restoreState 返回结果:', success);

               // 新逻辑：通过 View ID 加载关联的全景图
               if (currentViewId.value) {
                   loadPanoForView(currentViewId.value);
               }

               // 恢复保存的视角偏移和全景图位置 (但不负责加载文件)
               if (currentOtherSettings.value.pano) {
                   const savedPano = currentOtherSettings.value.pano;
                   console.log('🖼️ [PanoView] 发现已保存的全景视角状态:', savedPano);
                   
                   // 如果已有全景图 (或即将加载)，应用视角
                   // 使用 watcher 或 polling? 简单起见，loadPanoForView 完成后会 init，
                   // init 后应该应用视角。
                   // 这里先把状态存下来，initPanoViewer 里会用到吗？
                   // 或者在 loadPanoForView 完成后手动 animate
                   // 暂存 savedPano
                   pendingPanoState.value = savedPano;
               }

           } else {
               console.warn('⚠️ [PanoView] 获取完整视图失败');
           }
        } else {
           console.warn('⚠️ [PanoView] 未找到默认视图，使用初始设置');
           // 无默认视图，使用标准视角
           viewer.restoreState({
              viewport: {
                  eye: [0, -50, 50],
                  target: [0, 0, 0],
                  up: [0, 0, 1]
              }
          });
          // Fix: Ensure modelFov defaults to 90 if no saved view
          modelFov.value = 90;
          if (viewer) viewer.setFOV(90);
        }
      } catch (e) {
        console.warn('获取默认视图失败:', e);
      }

      // FOV 已在上方从 other_settings.modelFov 恢复，无需再次同步
      console.log('🔧 [PanoView] 视图恢复流程完成, 当前 modelFov:', modelFov.value);
    };

    // 监听几何体加载完成事件
    viewer.addEventListener(window.Autodesk.Viewing.GEOMETRY_LOADED_EVENT, onGeometryLoaded);
  });
};

const applyDefaultView = () => {
  if (viewer && defaultViewState.value) {
    console.log('👆 手动触发恢复默认视图');
    viewer.restoreState(defaultViewState.value);
    // 同步 FOV
    const fov = viewer.getFOV();
    modelFov.value = fov;
    currentVerticalFov.value = fov;
  }
  
  // 恢复全景图视角
  if (psv && currentOtherSettings.value && currentOtherSettings.value.pano) {
       const savedPano = currentOtherSettings.value.pano;
       console.log('🖼️ [PanoView] 恢复全景图视角:', savedPano);
       psv.animate({
            yaw: savedPano.yaw,
            pitch: savedPano.pitch,
            zoom: savedPano.zoom || 0,
            speed: 1000,
       });
  }
};


// 根据 View ID 加载全景图
const loadPanoForView = async (viewId) => {
    try {
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const res = await fetch(`${API_BASE}/api/documents/view/${viewId}`, { headers: getHeaders() });
        const result = await res.json();
        
        if (result.success && result.data && result.data.length > 0) {
            // 取最新的一个
            const doc = result.data[0];
            console.log('📄 [PanoView] 找到关联全景图:', doc.file_name);
            
            const path = doc.file_path.startsWith('/') ? doc.file_path : `/${doc.file_path}`;
            const url = `${API_BASE}${path}`;
            
            panoUrl.value = url;
            currentPanoFileId.value = doc.id;
            
            // 初始化
            initPanoViewer();
        } else {
            console.log('ℹ️ [PanoView] 该视图暂无关联的全景图');
        }
    } catch (e) {
        console.error('❌ 加载全景图失败:', e);
    }
};

const saveDefaultView = async () => {
  if (!viewer || !currentViewId.value) return;
  
  try {
      // 1. 获取模型当前状态
      const viewerState = viewer.getState({ viewport: true }); // 获取包含视口的完整状态
      
      // 2. 获取全景图当前状态
      let panoState = null;
      if (psv) {
          const pos = psv.getPosition();
          const zoom = psv.getZoomLevel();
          panoState = {
              yaw: pos.yaw,
              pitch: pos.pitch,
              zoom: zoom,
              // roll: panoRoll.value // 移除全景滚转保存
          };
      }
      
      // 3. 合并到 other_settings
      const newOtherSettings = {
          ...currentOtherSettings.value,
          pano: panoState,
          modelFov: modelFov.value // 保存当前模型 FOV
      };
      
      // 4. 调用 API 更新
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${API_BASE}/api/views/${currentViewId.value}`, {
          method: 'PUT',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authStore.token}`
          },
          body: JSON.stringify({
              viewer_state: viewerState,
              other_settings: newOtherSettings
          })
      });
      
      const result = await res.json();
      if (result.success) {
          console.log('✅ 默认视图保存成功!', result.data);
          alert('当前视角已保存为默认视图！');
      } else {
          console.error('保存失败:', result.error);
          alert('保存失败: ' + result.error);
      }
      
  } catch (e) {
      console.error('保存过程中出错:', e);
      alert('保存出错，请检查控制台');
  }
};

// 切换重叠模式
const setOverlayMode = (mode) => {
    if (isOverlayMode.value === mode) return;
    isOverlayMode.value = mode;
    
    // 切换模式时，若进入重叠模式，强制开启同步
    if (mode) {
        if (!isSyncEnabled.value) {
            console.log('🔄 进入重叠模式，自动开启同步');
            // 稍作延迟等待DOM更新，然后开启同步
            setTimeout(() => {
                // 手动触发一次同步开启流程
                toggleSync(); 
            }, 100);
        }
        
        // 强制 FOV
        if (viewer) updateModelFov();
    }
    
    // 无论是进入还是退出，都需要刷新 Viewer 大小
    nextTick(() => {
        if (viewer) viewer.resize();
        if (psv) {
             // PSV needs explicit resize if container changed
             psv.setOption('size', { width: '100%', height: '100%' });
        }
    });
};



// --- 微调功能逻辑 ---

const toggleFineTune = () => {
    isFineTuneMode.value = !isFineTuneMode.value;
    if (viewer) {
        if (isFineTuneMode.value) {
            // Sync Wolrd Up to current Camera Up to prevent "jump" (auto-leveling)
            const nav = viewer.navigation;
            const currentUp = viewer.impl.camera.up.clone();
            nav.setWorldUpVector(currentUp);

            // Activate First Person Tool
            viewer.toolController.activateTool('firstperson');
        } else {
            // Deactivate First Person Tool
            viewer.toolController.activateTool('orbit');
        }
    }
};

const moveModelCamera = (direction) => {
    if (!viewer) return;
    const nav = viewer.navigation;
    const pos = nav.getPosition();
    const target = nav.getTarget();
    const up = nav.getWorldUpVector(); // 通常是 Z轴 (0,0,1)

    // 计算视线方向 (Forward)
    const forward = new window.THREE.Vector3().subVectors(target, pos).normalize();
    // 计算右向 (Right) = Forward x Up
    const right = new window.THREE.Vector3().crossVectors(forward, up).normalize();
    
    // 步长
    const step = 0.5; // 根据模型尺度调整

    const delta = new window.THREE.Vector3(0, 0, 0);

    switch (direction) {
        case 'forward':
            delta.copy(forward).multiplyScalar(step);
            break;
        case 'backward':
            delta.copy(forward).multiplyScalar(-step);
            break;
        case 'left':
            delta.copy(right).multiplyScalar(-step);
            break;
        case 'right':
            delta.copy(right).multiplyScalar(step);
            break;
        case 'up':
            delta.copy(up).multiplyScalar(step);
            break;
        case 'down':
            delta.copy(up).multiplyScalar(-step);
            break;
    }

    // 更新位置和目标点 (平移)
    pos.add(delta);
    target.add(delta);

    nav.setView(pos, target);
    viewer.impl.invalidate(true);
};

const updateModelRoll = (delta) => {
    if (!viewer) return;
    const nav = viewer.navigation;
    const pos = nav.getPosition();
    const target = nav.getTarget();
    
    // 1. Calculate new Up vector
    const up = viewer.impl.camera.up.clone(); // Use camera up, not world up initially
    const forward = new window.THREE.Vector3().subVectors(target, pos).normalize();
    const rad = delta * Math.PI / 180;
    
    console.log(`🔄 [ModelRoll] Delta: ${delta}, Current Up: ${up.x.toFixed(2)}, ${up.y.toFixed(2)}, ${up.z.toFixed(2)}`);
    
    up.applyAxisAngle(forward, rad);
    
    console.log(`   [ModelRoll] New Up: ${up.x.toFixed(2)}, ${up.y.toFixed(2)}, ${up.z.toFixed(2)}`);
    
    // 2. Apply to Navigation and Camera
    nav.setWorldUpVector(up);
    viewer.impl.camera.up.copy(up);
    
    // 3. Force update view
    // setView(position, target) resets the up vector based on World Up if not handled carefully.
    // However, since we just set World Up, it should be fine.
    nav.setView(pos, target);
    
    // 4. Invalidate
    viewer.impl.invalidate(true);
    
    // 更新显示值 (简单的累计显示，不代表绝对 Roll)
    modelRoll.value += delta;
};

// ----------------------

const updateModelFov = () => {
    if (!viewer) return;
    const nav = viewer.navigation;
    const pos = nav.getPosition().clone(); // 保存当前位置
    const target = nav.getTarget().clone(); // 保存当前目标
    const up = nav.getWorldUpVector().clone(); // 保存当前 Roll

    // 设置 FOV (Forge 默认会移动相机以保持视口大小)
    console.log(`📷 [updateModelFov] Setting FOV to: ${modelFov.value}`);
    viewer.setFOV(modelFov.value);

    // 强制恢复原位置 (实现原地变焦)
    nav.setView(pos, target);
    nav.setWorldUpVector(up);
    viewer.impl.invalidate(true);
};

const changeModelFov = (delta) => {
    modelFov.value += delta;
    updateModelFov();
};

// 同步逻辑
const toggleSync = () => {
  isSyncEnabled.value = !isSyncEnabled.value;
  if (isSyncEnabled.value && viewer && psv) {
    // 1. 计算当前的 Offset，防止视角跳变
    // 获取 PSV 当前 Yaw
    const psvPos = psv.getPosition();
    const psvYaw = psvPos.yaw;

    // 获取 Forge Viewer 当前相机的 Yaw
    const nav = viewer.navigation;
    const camPos = nav.getPosition(); // Vector3
    const camTarget = nav.getTarget(); // Vector3
    
    // 计算方向向量 (Target - Eye)
    const dir = new window.THREE.Vector3().subVectors(camTarget, camPos).normalize();
    
    // 计算模型 Yaw (假设 Z 轴向上，X 为 0 度)
    // atan2(y, x) -> -PI to PI
    // Forge Viewer world coordinates often have Y as North or different based on model
    // Assuming standard: Z up.
    const modelYaw = Math.atan2(dir.y, dir.x); 
    
    // Model Yaw = -PSV Yaw + Offset
    // Offset = Model Yaw + PSV Yaw
    yawOffset.value = modelYaw + psvYaw;

    // 计算模型 Pitch (asin(z)) because dir is normalized
    // z = sin(pitch)
    const modelPitch = Math.asin(dir.z);
    
    // Model Pitch = PSV Pitch + Pitch Offset
    // Pitch Offset = Model Pitch - PSV Pitch
    pitchOffset.value = modelPitch - psvPos.pitch;

    console.log('🔗 [PanoView] 开启同步');
    console.log(`   PSV Yaw/Pitch: ${psvYaw.toFixed(2)} / ${psvPos.pitch.toFixed(2)}`);
    console.log(`   Model Yaw/Pitch: ${modelYaw.toFixed(2)} / ${modelPitch.toFixed(2)}`);
    console.log(`   Offsets (Yaw/Pitch): ${yawOffset.value.toFixed(2)} / ${pitchOffset.value.toFixed(2)}`);

    // 2. Safe FOV Update
    console.log(`🔗 [ToggleSync] Calling updateModelFov with modelFov: ${modelFov.value}`);
    updateModelFov();
    currentVerticalFov.value = modelFov.value;
    
    // 3. 立即执行一次同步
    syncViewerCamera(psvYaw, psvPos.pitch);
  }
};

// requestAnimationFrame 节流变量
let rafId = null;
let pendingSync = null;

const onPanoPositionUpdated = (e) => {
  if (!isSyncEnabled.value || !viewer) return;
  
  // 使用 requestAnimationFrame 节流，避免每个事件都触发渲染
  pendingSync = { yaw: e.position.yaw, pitch: e.position.pitch };
  
  if (!rafId) {
    rafId = requestAnimationFrame(() => {
      if (pendingSync) {
        syncViewerCameraInternal(pendingSync.yaw, pendingSync.pitch);
        pendingSync = null;
      }
      rafId = null;
    });
  }
};

const onPanoZoomUpdated = () => {
  // 可选：同步 FOV
};

// 供外部直接调用的版本（如 toggleSync 中的立即同步）
const syncViewerCamera = (yaw, pitch) => {
  syncViewerCameraInternal(yaw, pitch);
};

// 内部同步实现
const syncViewerCameraInternal = (yaw, pitch) => {
  if (!viewer || !viewer.navigation) return;
  
  const nav = viewer.navigation;
  
  // R_Yaw = -Yaw + Offset
  const rYaw = -yaw + yawOffset.value;
  
  // R_Pitch = Pitch + Pitch Offset
  // Clamp pitch to avoid gimbal lock or flipping issues
  let rPitch = pitch + pitchOffset.value;
  const MAX_PITCH = Math.PI / 2 - 0.1; // ~85 degrees
  rPitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, rPitch));

  const dirX = Math.cos(rPitch) * Math.cos(rYaw);
  const dirY = Math.cos(rPitch) * Math.sin(rYaw);
  const dirZ = Math.sin(rPitch);
  
  const pos = nav.getPosition(); // Current eye position
  const dist = 100; // LookAt distance
  
  // Calculate new target based on rotation
  const target = new window.THREE.Vector3(
    pos.x + dirX * dist,
    pos.y + dirY * dist,
    pos.z + dirZ * dist
  );
  
  // 捕获当前 Up 向量/Roll（在任何修改前）
  const up = nav.getWorldUpVector().clone();

  // 使用 setView 进行原子化更新（不再每帧检查 FOV 以减少开销）
  nav.setView(pos, target);
  
  // 恢复 Up 向量以防止 Roll 重置
  nav.setWorldUpVector(up);
  
  // 请求渲染（false = 下一帧渲染，减少立即渲染的卡顿）
  viewer.impl.invalidate(false);
};

onMounted(async () => {
  console.log('🚀 [PanoView] 组件挂载');
  console.log('📊 [PanoView] Props:', props);
  
  await nextTick();
  
  // 等待 DOM 完全渲染，确保容器存在
  const waitForContainer = (retries = 10) => {
    return new Promise((resolve, reject) => {
      const check = (attempt) => {
        if (forgeContainer.value && forgeContainer.value.offsetWidth > 0) {
          console.log('✅ [PanoView] 容器已就绪，开始初始化');
          resolve();
        } else if (attempt < retries) {
          console.log(`⏳ [PanoView] 等待容器就绪... (${attempt + 1}/${retries})`);
          setTimeout(() => check(attempt + 1), 100);
        } else {
          reject(new Error('容器初始化超时'));
        }
      };
      check(0);
    });
  };
  
  try {
    await waitForContainer();
    initForgeViewer();
  } catch (e) {
    console.error('❌ [PanoView] 容器初始化失败:', e);
  }
});

onUnmounted(() => {
  if (psv) psv.destroy();
  // Forge Viewer 销毁通常不需要手动处理，除非要清理内存
  if (viewer) {
    viewer.finish();
    viewer = null;
  }
});

// 监听 modelPath 变化，处理延迟传入的情况
watch(() => props.modelPath, (newPath, oldPath) => {
  console.log(`👀 [PanoView] modelPath 变化: "${oldPath}" -> "${newPath}"`);
  if (newPath && viewer && !oldPath) {
    // 只在 viewer 已初始化且 modelPath 从空变为有值时加载
    console.log('📦 [PanoView] 检测到延迟传入的 modelPath，开始加载模型...');
    loadModel(newPath);
  }
}, { immediate: false });
</script>

<style scoped>
.pano-compare-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: #f5f5f5;
  color: #333;
}

.compare-header {
  height: 48px;
  background: #fff;
  border-bottom: 1px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  z-index: 10;
}

.header-left, .header-center, .header-right {
  display: flex;
  align-items: center;
  flex: 1;
}

.header-center {
  justify-content: center;
}

.header-right {
  justify-content: flex-end;
}

.title {
  font-weight: 600;
  font-size: 16px;
  margin-left: 12px;
}

.icon-btn {
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  border-radius: 4px;
  color: #666;
  font-size: 14px; /* Fix for potential icon alignment */
}

.icon-btn:hover {
  background: #eee;
  color: #333;
}

.sync-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-radius: 20px;
  border: 1px solid #ccc;
  background: #fff;
  color: #666;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.sync-btn:hover {
  background: #f9f9f9;
  border-color: #bbb;
}

.sync-btn.active {
  background: #e3f2fd;
  border-color: #2196f3;
  color: #2196f3;
}

.split-container {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.pane {
  flex: 1;
  position: relative;
  background: #eee;
  border-right: 1px solid #ddd;
  min-height: 400px; /* 确保最小高度 */
}

.pane:last-child {
  border-right: none;
}

.pano-viewer, #compare-forge-viewer {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.upload-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: #f0f0f0;
  transition: background 0.2s;
}

.upload-placeholder:hover {
  background: #e0e0e0;
}

.upload-content {
  text-align: center;
  color: #888;
}

.upload-content svg {
  margin-bottom: 12px;
}

.upload-content p {
  font-size: 16px;
  font-weight: 500;
  margin: 0;
}

.sub-text {
  font-size: 12px;
  color: #aaa;
  margin-top: 4px;
  display: block;
}

/* 新增：模式控制样式 */
.mode-group {
    display: flex;
    background: #f0f0f0;
    border-radius: 6px;
    padding: 2px;
    margin-right: 12px;
}

.mode-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 10px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 4px;
    color: #666;
    transition: all 0.2s;
}

.mode-btn:hover {
    background: rgba(0,0,0,0.05);
    color: #333;
}

.mode-btn.active {
    background: #fff;
    color: #2196f3;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.divider {
    width: 1px;
    height: 20px;
    background: #e0e0e0;
    margin: 0 12px;
}

.opacity-slider {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-right: 12px;
    background: #f9f9f9;
    padding: 4px 10px;
    border-radius: 20px;
    border: 1px solid #eee;
}

.opacity-slider .label {
    font-size: 12px;
    color: #666;
}

.opacity-slider input[type=range] {
    width: 80px;
    height: 4px;
    background: #ddd;
    border-radius: 2px;
    -webkit-appearance: none;
    appearance: none;
}

.slider-container input[type=range] {
    width: 100%;
    height: 4px;
    background: rgba(255,255,255,0.3);
    border-radius: 2px;
    -webkit-appearance: none;
    appearance: none;
    cursor: pointer;
}

.slider-container input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    background: white;
    border-radius: 50%;
    cursor: pointer;
}

/* 微调面板样式 */
.fine-tune-panel {
    position: absolute;
    top: 60px; /* 避免遮挡顶部条 */
    right: 20px;
    background: rgba(30, 30, 30, 0.95); /* 深色背景，减少透明度 */
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    padding: 16px;
    z-index: 100;
    color: #fff;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    min-width: 180px;
}

.section-title {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: #eee; /* 更亮的文字 */
    margin-bottom: 12px;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.divider-h {
    height: 1px;
    background: rgba(255,255,255,0.15);
    margin: 16px 0;
}

.dpad-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    justify-items: center;
}

.dpad-btn, .roll-btn {
    width: 36px;
    height: 36px;
    border: 1px solid rgba(255,255,255,0.4); /* 增加边框亮度 */
    background: rgba(0,0,0,0.3); /* 深色背景，与文字形成对比 */
    color: #ffffff !important; /* 强制纯白文字 */
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    user-select: none;
    font-weight: bold; /* 加粗字体 */
    font-family: inherit;
    line-height: 1;
}

.dpad-btn:hover, .roll-btn:hover {
    background: rgba(255,255,255,0.1); /* hover时稍微变亮 */
    border-color: #fff;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    color: #ffffff !important;
}

.dpad-btn:active, .roll-btn:active {
    transform: translateY(0);
    background: rgba(255,255,255,0.2);
    color: #ffffff !important;
}

.roll-controls {
    display: flex;
    justify-content: center;
    gap: 12px;
}

.roll-btn {
    width: auto;
    padding: 0 12px;
    font-size: 13px;
    font-weight: 500;
}

.dpad-vertical {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.fov-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
}

.fov-display {
    font-size: 16px;
    font-weight: bold;
    color: #fff;
    width: 60px; /* 固定宽度，防止数字变化导致抖动 */
    display: inline-block;
    text-align: center;
    font-variant-numeric: tabular-nums;
}

.opacity-slider input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    background: #2196f3;
    border-radius: 50%;
    cursor: pointer;
}

.opacity-slider .value {
    font-size: 12px;
    color: #2196f3;
    min-width: 32px;
    text-align: right;
}

/* 重叠模式布局 */
.split-container.overlay-mode {
    display: block; /* 覆盖 flex */
}

.split-container.overlay-mode .pane {
    position: absolute;
    top: 0;
    left: 0;
    width: 100% !important;
    height: 100% !important;
    border-right: none;
}

.split-container.overlay-mode .right-pane {
    /* 模型在下层 */
    z-index: 1;
}

.split-container.overlay-mode .left-pane {
    /* 全景图在上层 */
    z-index: 2;
    background: transparent; /* 重要：背景设为透明 */
}
</style>
