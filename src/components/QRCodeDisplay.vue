<template>
  <div v-if="code" class="qrcode-section">
    <div class="section-header">
      <span class="section-title">{{ $t('qrcode.title') }}</span>
      <button class="btn-download" :title="$t('qrcode.download')" @click="downloadQRCode">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>
    </div>
    <div class="qrcode-container">
      <canvas ref="qrcodeCanvas" class="qrcode-canvas"></canvas>
      <div class="qrcode-label">{{ code }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue';
import QRCode from 'qrcode';

const props = defineProps({
  code: {
    type: String,
    default: null
  },
  size: {
    type: Number,
    default: 120
  }
});

const qrcodeCanvas = ref(null);

// 生成二维码
const generateQRCode = async () => {
  if (!props.code) return;
  
  // 等待DOM更新
  await nextTick();
  
  if (!qrcodeCanvas.value) {
    console.error('QR code canvas not found');
    return;
  }
  
  try {
    await QRCode.toCanvas(qrcodeCanvas.value, props.code, {
      width: props.size,
      margin: 2,
      color: {
        dark: '#e0e0e0',  // 浅灰色前景
        light: '#333333'  // 深色背景
      }
    });
    console.log('QR code generated for:', props.code);
  } catch (error) {
    console.error('生成二维码失败:', error);
  }
};

// 下载二维码
const downloadQRCode = async () => {
  if (!props.code) return;
  
  try {
    const dataUrl = await QRCode.toDataURL(props.code, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    
    const link = document.createElement('a');
    link.download = `qrcode_${props.code}.png`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error('下载二维码失败:', error);
  }
};

// 监听code变化
watch(() => props.code, () => {
  generateQRCode();
}, { immediate: false });

// 组件挂载后生成
onMounted(() => {
  if (props.code) {
    generateQRCode();
  }
});
</script>

<style scoped>
.qrcode-section {
  margin-top: 16px;
  padding: 12px;
  background: #252526;
  border-radius: 4px;
  border: 1px solid #3e3e42;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #ccc;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-download {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  background: transparent;
  border: 1px solid #555;
  border-radius: 3px;
  color: #aaa;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-download:hover {
  background: #333;
  border-color: #777;
  color: #fff;
}

.qrcode-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.qrcode-canvas {
  background: transparent;
  border-radius: 4px;
}

.qrcode-label {
  font-size: 10px;
  color: #888;
  font-family: monospace;
  word-break: break-all;
  text-align: center;
  max-width: 100%;
}
</style>
