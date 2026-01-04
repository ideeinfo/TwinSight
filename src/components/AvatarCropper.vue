<template>
  <el-dialog
    v-model="visible"
    :title="$t('account.cropAvatar')"
    width="400px"
    :close-on-click-modal="false"
    class="cropper-dialog"
  >
    <div class="cropper-container">
      <div ref="cropperArea" class="cropper-area" @mousedown="startDrag" @wheel.prevent="handleWheel">
        <img
          ref="imageEl"
          :src="imageSrc"
          :style="imageStyle"
          alt="crop"
          draggable="false"
        />
        <div class="circle-mask"></div>
      </div>
      <div class="zoom-controls">
        <el-button :icon="ZoomOut" circle size="small" @click="zoomOut" />
        <el-slider v-model="scale" :min="0.5" :max="3" :step="0.1" :show-tooltip="false" />
        <el-button :icon="ZoomIn" circle size="small" @click="zoomIn" />
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">{{ $t('common.cancel') }}</el-button>
      <el-button type="primary" @click="handleConfirm">{{ $t('common.confirm') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { ZoomIn, ZoomOut } from '@element-plus/icons-vue';

const props = defineProps<{
  modelValue: boolean;
  imageSrc: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirm', dataUrl: string): void;
}>();

const cropperArea = ref<HTMLElement | null>(null);
const imageEl = ref<HTMLImageElement | null>(null);

const scale = ref(1);
const offsetX = ref(0);
const offsetY = ref(0);
const isDragging = ref(false);
const dragStartX = ref(0);
const dragStartY = ref(0);
const initialOffsetX = ref(0);
const initialOffsetY = ref(0);

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

// 重置
watch(() => props.modelValue, (val) => {
  if (val) {
    scale.value = 1;
    offsetX.value = 0;
    offsetY.value = 0;
  }
});

const imageStyle = computed(() => ({
  transform: `translate(${offsetX.value}px, ${offsetY.value}px) scale(${scale.value})`,
  transformOrigin: 'center center'
}));

// 缩放
const zoomIn = () => {
  scale.value = Math.min(3, scale.value + 0.2);
};

const zoomOut = () => {
  scale.value = Math.max(0.5, scale.value - 0.2);
};

const handleWheel = (e: WheelEvent) => {
  if (e.deltaY < 0) {
    zoomIn();
  } else {
    zoomOut();
  }
};

// 拖拽
const startDrag = (e: MouseEvent) => {
  isDragging.value = true;
  dragStartX.value = e.clientX;
  dragStartY.value = e.clientY;
  initialOffsetX.value = offsetX.value;
  initialOffsetY.value = offsetY.value;
  
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', stopDrag);
};

const handleDrag = (e: MouseEvent) => {
  if (!isDragging.value) return;
  offsetX.value = initialOffsetX.value + (e.clientX - dragStartX.value);
  offsetY.value = initialOffsetY.value + (e.clientY - dragStartY.value);
};

const stopDrag = () => {
  isDragging.value = false;
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', stopDrag);
};

// 确认裁剪
const handleConfirm = async () => {
  await nextTick();
  
  const canvas = document.createElement('canvas');
  const size = 200; // 输出尺寸
  canvas.width = size;
  canvas.height = size;
  
  const ctx = canvas.getContext('2d');
  if (!ctx || !imageEl.value || !cropperArea.value) return;

  const img = imageEl.value;
  const area = cropperArea.value;
  const areaRect = area.getBoundingClientRect();
  const imgRect = img.getBoundingClientRect();
  
  // 计算裁剪区域
  const circleSize = 200; // 圆形蒙版大小
  const centerX = areaRect.width / 2;
  const centerY = areaRect.height / 2;
  
  // 图片相对于裁剪区域的位置
  const imgOffsetX = imgRect.left - areaRect.left;
  const imgOffsetY = imgRect.top - areaRect.top;
  
  // 计算源图像的裁剪区域
  const sourceScale = img.naturalWidth / imgRect.width;
  const sx = (centerX - circleSize / 2 - imgOffsetX) * sourceScale;
  const sy = (centerY - circleSize / 2 - imgOffsetY) * sourceScale;
  const sWidth = circleSize * sourceScale;
  const sHeight = circleSize * sourceScale;

  // 创建圆形裁剪
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // 绘制图片
  ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, size, size);

  const dataUrl = canvas.toDataURL('image/png');
  emit('confirm', dataUrl);
  visible.value = false;
};
</script>

<style scoped>
.cropper-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.cropper-area {
  position: relative;
  width: 300px;
  height: 300px;
  background: #1a1a1a;
  overflow: hidden;
  cursor: grab;
  border-radius: 8px;
}

.cropper-area:active {
  cursor: grabbing;
}

.cropper-area img {
  position: absolute;
  top: 50%;
  left: 50%;
  max-width: none;
  transform-origin: center center;
  margin-left: -50%;
  margin-top: -50%;
  user-select: none;
  pointer-events: none;
}

.circle-mask {
  position: absolute;
  inset: 0;
  pointer-events: none;
  /* 圆形镂空蒙版 */
  background: radial-gradient(circle 100px at center, transparent 99px, rgba(0, 0, 0, 0.7) 100px);
}

.circle-mask::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 200px;
  height: 200px;
  border: 2px dashed rgba(255, 255, 255, 0.5);
  border-radius: 50%;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  max-width: 280px;
}

.zoom-controls .el-slider {
  flex: 1;
}
</style>
