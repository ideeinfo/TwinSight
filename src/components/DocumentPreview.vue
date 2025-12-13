<template>
  <Teleport to="body">
    <div v-if="visible" class="preview-overlay" @click.self="close">
      <div class="preview-container" :class="containerClass">
        <div class="preview-header">
          <div class="preview-title">
            {{ document?.title || document?.file_name }}
            <span v-if="isPanorama" class="panorama-badge">360°</span>
          </div>
          <div class="preview-actions">
            <!-- 图片缩放控制 (非全景图) -->
            <template v-if="isImage && !isPanorama">
              <button class="preview-btn" @click="zoomOut" :disabled="zoom <= 0.25" title="缩小">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
              </button>
              <span class="zoom-level">{{ Math.round(zoom * 100) }}%</span>
              <button class="preview-btn" @click="zoomIn" :disabled="zoom >= 4" title="放大">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  <line x1="11" y1="8" x2="11" y2="14"></line>
                  <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
              </button>
              <button class="preview-btn" @click="resetZoom" title="重置">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
              </button>
            </template>
            <!-- 下载按钮 -->
            <button class="preview-btn" @click="download" title="下载">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
            <!-- 关闭按钮 -->
            <button class="preview-btn close-btn" @click="close" title="关闭">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <!-- 内容区域 -->
        <div class="preview-content" ref="contentRef">
          <!-- PDF 预览 -->
          <div v-if="isPdf" class="pdf-wrapper">
            <iframe 
              :src="fileUrl" 
              class="pdf-viewer"
              frameborder="0"
            ></iframe>
          </div>

          <!-- 全景图预览 -->
          <div v-if="isPanorama" class="panorama-wrapper">
            <div ref="panoramaRef" class="panorama-viewer"></div>
            <!-- 自定义控制按钮 -->
            <div class="panorama-controls">
              <button class="pano-btn" @click="panoramaZoomIn" title="放大">+</button>
              <button class="pano-btn" @click="panoramaZoomOut" title="缩小">−</button>
              <button class="pano-btn" @click="panoramaFullscreen" title="全屏">⛶</button>
            </div>
            <div class="panorama-hint">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 9l-3 3 3 3"/>
                <path d="M19 9l3 3-3 3"/>
                <path d="M12 5l-3-3 3-3"/>
                <path d="M12 19l-3 3 3 3"/>
              </svg>
              <span>拖动或滑动查看 360° 全景</span>
            </div>
          </div>

          <!-- 普通图片预览 -->
          <div 
            v-else-if="isImage" 
            class="image-wrapper"
            @wheel="handleWheel"
            @mousedown="startDrag"
            @mousemove="onDrag"
            @mouseup="endDrag"
            @mouseleave="endDrag"
          >
            <img 
              :src="fileUrl" 
              class="image-viewer"
              :style="imageStyle"
              @load="onImageLoad"
              draggable="false"
            />
          </div>

          <!-- 视频预览 -->
          <div v-else-if="isVideo" class="video-wrapper">
            <video 
              ref="videoRef"
              :src="fileUrl" 
              class="video-viewer"
              controls
              autoplay
              controlsList="nodownload"
            >
              您的浏览器不支持视频播放
            </video>
          </div>

          <!-- 不支持的格式 -->
          <div v-else class="unsupported">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <p>此文件格式不支持预览</p>
            <button class="download-btn" @click="download">下载文件</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue';
import { Viewer } from '@photo-sphere-viewer/core';
import '@photo-sphere-viewer/core/index.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const props = defineProps({
  visible: { type: Boolean, default: false },
  document: { type: Object, default: null }
});

const emit = defineEmits(['close']);

// 缩放相关
const zoom = ref(1);
const imagePosition = ref({ x: 0, y: 0 });
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });
const contentRef = ref(null);
const videoRef = ref(null);
const panoramaRef = ref(null);
let panoramaViewer = null;

// 获取文件 URL
const fileUrl = computed(() => {
  if (!props.document) return '';
  return `${API_BASE}${props.document.file_path}`;
});

// 文件类型判断
const fileType = computed(() => {
  return props.document?.file_type?.toLowerCase() || '';
});

const isPdf = computed(() => fileType.value === 'pdf');
const isImage = computed(() => ['jpg', 'jpeg', 'png', 'svg', 'gif', 'webp'].includes(fileType.value));
const isVideo = computed(() => ['mp4', 'webm', 'ogg'].includes(fileType.value));

// 判断是否是全景图（长宽比接近 2:1）
const isPanorama = computed(() => {
  if (!['jpg', 'jpeg', 'png'].includes(fileType.value)) return false;
  const width = props.document?.image_width;
  const height = props.document?.image_height;
  if (!width || !height || height === 0) return false;
  const ratio = width / height;
  return ratio >= 1.9 && ratio <= 2.1;
});

// 容器样式类
const containerClass = computed(() => ({
  'is-pdf': isPdf.value,
  'is-image': isImage.value && !isPanorama.value,
  'is-panorama': isPanorama.value,
  'is-video': isVideo.value
}));

// 图片样式
const imageStyle = computed(() => ({
  transform: `translate(${imagePosition.value.x}px, ${imagePosition.value.y}px) scale(${zoom.value})`,
  cursor: isDragging.value ? 'grabbing' : (zoom.value > 1 ? 'grab' : 'default')
}));

// 重置状态
watch(() => props.visible, async (val) => {
  if (val) {
    zoom.value = 1;
    imagePosition.value = { x: 0, y: 0 };
    // 添加键盘事件监听
    document.addEventListener('keydown', handleKeydown);
    
    // 如果是全景图，初始化 Pannellum
    if (isPanorama.value) {
      await nextTick();
      initPanorama();
    }
    
    // 如果是视频，等待 DOM 更新后自动播放
    if (isVideo.value) {
      await nextTick();
      if (videoRef.value) {
        videoRef.value.play().catch(e => {
          console.log('自动播放被浏览器阻止:', e.message);
        });
      }
    }
  } else {
    document.removeEventListener('keydown', handleKeydown);
    // 停止视频播放
    if (videoRef.value) {
      videoRef.value.pause();
    }
    // 销毁全景图查看器
    destroyPanorama();
  }
});

// 初始化全景图查看器 (Photo Sphere Viewer)
const initPanorama = () => {
  if (!panoramaRef.value) return;
  
  destroyPanorama();
  
  panoramaViewer = new Viewer({
    container: panoramaRef.value,
    panorama: fileUrl.value,
    defaultZoomLvl: 0,  // 从最小缩放开始
    minFov: 30,
    maxFov: 90,
    navbar: false,
    loadingTxt: '加载中...',
  });

  // 加载完成后执行入场动画
  panoramaViewer.addEventListener('ready', () => {
    // 入场动画：缩放到正常视野，同时稍微旋转
    panoramaViewer.animate({
      yaw: Math.PI / 4,  // 旋转 45 度
      pitch: 0,
      zoom: 50,  // 缩放到 50%
      speed: 1500,  // 1.5 秒完成
    });
  });
};

// 全景图缩放控制
const panoramaZoomIn = () => {
  if (panoramaViewer) {
    const currentZoom = panoramaViewer.getZoomLevel();
    panoramaViewer.zoom(Math.min(currentZoom + 10, 100));
  }
};

const panoramaZoomOut = () => {
  if (panoramaViewer) {
    const currentZoom = panoramaViewer.getZoomLevel();
    panoramaViewer.zoom(Math.max(currentZoom - 10, 0));
  }
};

const panoramaFullscreen = () => {
  if (panoramaViewer) {
    panoramaViewer.toggleFullscreen();
  }
};

// 销毁全景图查看器
const destroyPanorama = () => {
  if (panoramaViewer) {
    panoramaViewer.destroy();
    panoramaViewer = null;
  }
};

// 组件卸载时清理
onUnmounted(() => {
  destroyPanorama();
});

// 键盘事件处理
const handleKeydown = (e) => {
  if (e.key === 'Escape') {
    close();
  } else if (isImage.value) {
    if (e.key === '+' || e.key === '=') {
      zoomIn();
    } else if (e.key === '-') {
      zoomOut();
    } else if (e.key === '0') {
      resetZoom();
    }
  }
};

// 缩放功能
const zoomIn = () => {
  zoom.value = Math.min(zoom.value * 1.25, 4);
};

const zoomOut = () => {
  zoom.value = Math.max(zoom.value / 1.25, 0.25);
};

const resetZoom = () => {
  zoom.value = 1;
  imagePosition.value = { x: 0, y: 0 };
};

// 鼠标滚轮缩放
const handleWheel = (e) => {
  e.preventDefault();
  if (e.deltaY < 0) {
    zoomIn();
  } else {
    zoomOut();
  }
};

// 拖拽功能
const startDrag = (e) => {
  if (zoom.value <= 1) return;
  isDragging.value = true;
  dragStart.value = {
    x: e.clientX - imagePosition.value.x,
    y: e.clientY - imagePosition.value.y
  };
};

const onDrag = (e) => {
  if (!isDragging.value) return;
  imagePosition.value = {
    x: e.clientX - dragStart.value.x,
    y: e.clientY - dragStart.value.y
  };
};

const endDrag = () => {
  isDragging.value = false;
};

// 图片加载完成
const onImageLoad = () => {
  // 可以在这里设置初始缩放或位置
};

// 下载
const download = () => {
  if (props.document) {
    window.open(`${API_BASE}/api/documents/${props.document.id}/download`, '_blank');
  }
};

// 关闭
const close = () => {
  emit('close');
};
</script>

<style scoped>
.preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.preview-container {
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  animation: scaleIn 0.2s ease;
}

@keyframes scaleIn {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.preview-container.is-pdf {
  width: 90vw;
  height: 90vh;
  max-width: 1200px;
}

.preview-container.is-image {
  width: 90vw;
  height: 90vh;
  max-width: 1400px;
}

.preview-container.is-video {
  width: 80vw;
  max-width: 1000px;
}

.preview-container.is-panorama {
  width: 95vw;
  height: 85vh;
  max-width: 1600px;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #252526;
  border-bottom: 1px solid #3e3e42;
  flex-shrink: 0;
}

.preview-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #eee;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 50%;
}

.panorama-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  background: linear-gradient(135deg, #16a085, #1abc9c);
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  color: white;
  flex-shrink: 0;
}

.preview-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid #444;
  border-radius: 4px;
  color: #aaa;
  cursor: pointer;
  transition: all 0.2s;
}

.preview-btn:hover:not(:disabled) {
  background: #333;
  border-color: #666;
  color: #fff;
}

.preview-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.preview-btn.close-btn:hover {
  background: rgba(231, 76, 60, 0.2);
  border-color: #e74c3c;
  color: #e74c3c;
}

.zoom-level {
  font-size: 12px;
  color: #888;
  min-width: 40px;
  text-align: center;
}

.preview-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a1a;
}

/* PDF 样式 */
.pdf-wrapper {
  width: 100%;
  height: 100%;
}

.pdf-viewer {
  width: 100%;
  height: 100%;
  border: none;
}

/* 图片样式 */
.image-wrapper {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}

.image-viewer {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transition: transform 0.1s ease;
}

/* 视频样式 */
.video-wrapper {
  width: 100%;
  padding: 20px;
}

.video-viewer {
  width: 100%;
  max-height: 80vh;
  background: #000;
  border-radius: 4px;
}

/* 不支持的格式 */
.unsupported {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #888;
  text-align: center;
}

.unsupported p {
  margin: 16px 0;
  font-size: 14px;
}

.download-btn {
  padding: 8px 16px;
  background: #0078d4;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.download-btn:hover {
  background: #106ebe;
}

/* 全景图样式 */
.panorama-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

.panorama-viewer {
  width: 100%;
  height: 100%;
}

.panorama-hint {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 20px;
  color: #aaa;
  font-size: 12px;
  pointer-events: none;
  animation: fadeInUp 0.5s ease 1s both;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

/* 自定义全景图控制按钮 */
.panorama-controls {
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 6px;
  overflow: hidden;
  z-index: 100;
}

.pano-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: white;
  font-size: 20px;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pano-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

/* Photo Sphere Viewer 样式覆盖 */
:deep(.psv-container) {
  background: #1a1a1a !important;
}

:deep(.psv-loader-container) {
  background: rgba(0, 0, 0, 0.7) !important;
}

:deep(.psv-loader) {
  color: #1abc9c !important;
}
</style>
