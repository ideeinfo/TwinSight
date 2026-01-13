<template>
  <div class="theme-debug-page" :class="currentTheme">
    <!-- 顶部工具栏 -->
    <header class="debug-header">
      <h1>🎨 主题/字体 实时编辑器</h1>
      <div class="theme-switcher">
        <button 
          :class="{ active: currentTheme === 'dark' }" 
          @click="setTheme('dark')"
        >
          🌙 深色
        </button>
        <button 
          :class="{ active: currentTheme === 'light' }" 
          @click="setTheme('light')"
        >
          ☀️ 浅色
        </button>
      </div>
      <div class="header-actions">
         <button class="action-btn" @click="exportConfig">📤 导出 CSS</button>
         <button class="back-btn" @click="goBack">← 返回</button>
      </div>
    </header>

    <div class="debug-content">
      <!-- 左侧：实时编辑面板 -->
      <aside class="color-tokens-panel">
        <h2>此面板修改实时生效</h2>

        <!-- 字体设置 -->
        <section class="token-section">
          <h3>字体 (Typography)</h3>
          <div class="token-list">
            <div v-for="token in fontTokens" :key="token.name" class="token-form-item">
              <label :title="token.var">{{ token.name }}</label>
              <input 
                type="text" 
                v-model="token.value" 
                @change="updateToken(token)"
                class="font-input"
              >
            </div>
          </div>
        </section>
        
        <!-- 表面色 -->
        <section class="token-section">
          <h3>表面色 (Surface)</h3>
          <div class="token-list">
            <div v-for="token in surfaceTokens" :key="token.name" class="token-editor-row">
              <div class="color-preview">
                 <input type="color" v-model="token.value" @input="updateToken(token)">
              </div>
              <div class="color-info">
                 <span class="token-name" :title="token.var">{{ token.name }}</span>
                 <input type="text" v-model="token.value" @change="updateToken(token)" class="hex-input">
              </div>
            </div>
          </div>
        </section>

        <!-- 文字色 -->
        <section class="token-section">
          <h3>文字色 (Text)</h3>
          <div class="token-list">
             <div v-for="token in textTokens" :key="token.name" class="token-editor-row">
              <div class="color-preview">
                 <input type="color" v-model="token.value" @input="updateToken(token)">
              </div>
              <div class="color-info">
                 <span class="token-name" :title="token.var">{{ token.name }}</span>
                 <input type="text" v-model="token.value" @change="updateToken(token)" class="hex-input">
              </div>
            </div>
          </div>
        </section>

        <!-- 强调色 -->
        <section class="token-section">
          <h3>强调色 (Accent)</h3>
          <div class="token-list">
             <div v-for="token in accentTokens" :key="token.name" class="token-editor-row">
              <div class="color-preview">
                 <input type="color" v-model="token.value" @input="updateToken(token)">
              </div>
              <div class="color-info">
                 <span class="token-name" :title="token.var">{{ token.name }}</span>
                 <input type="text" v-model="token.value" @change="updateToken(token)" class="hex-input">
              </div>
            </div>
          </div>
        </section>

        <!-- 组件级 Token -->
        <section class="token-section">
          <h3>组件级 Token (Component)</h3>
          <div class="token-list">
             <div v-for="token in componentTokens" :key="token.name" class="token-editor-row">
              <div class="color-preview">
                 <input type="color" v-model="token.value" @input="updateToken(token)">
              </div>
              <div class="color-info">
                 <span class="token-name" :title="token.var">{{ token.name }}</span>
                 <input type="text" v-model="token.value" @change="updateToken(token)" class="hex-input">
              </div>
            </div>
          </div>
        </section>
      </aside>

      <!-- 右侧：组件预览 -->
      <main class="components-preview">
        <h2>组件预览</h2>

        <!-- P0: 按钮 -->
        <section class="preview-section">
          <h3>P0: 按钮</h3>
          
          <div class="preview-group">
            <h4>工具栏按钮（无底色，图标+文字）</h4>
            <div class="toolbar-preview">
              <button class="toolbar-btn primary">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  <line x1="12" y1="11" x2="12" y2="17"/>
                  <line x1="9" y1="14" x2="15" y2="14"/>
                </svg>
                新建文件夹
              </button>
              <button class="toolbar-btn primary">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
                上传文档
              </button>
              <button class="toolbar-btn primary">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                上传模型
              </button>
              <button class="toolbar-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  <polyline points="12 11 16 15 12 19"/>
                  <path d="M16 15H8"/>
                </svg>
                移动到
              </button>
              <button class="toolbar-btn danger">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                删除
              </button>
            </div>
          </div>

          <div class="preview-group">
            <h4>Element Plus 按钮</h4>
            <div class="button-row">
              <el-button type="primary">主要按钮</el-button>
              <el-button>默认按钮</el-button>
              <el-button type="danger">危险按钮</el-button>
              <el-button type="primary" plain>朴素按钮</el-button>
              <el-button type="primary" text>文字按钮</el-button>
            </div>
          </div>

          <div class="preview-group">
            <h4>图标按钮</h4>
            <div class="button-row">
              <button class="icon-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              </button>
              <button class="icon-btn active">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              </button>
            </div>
          </div>
        </section>

        <!-- P1: 列表/树 -->
        <section class="preview-section">
          <h3>P1: 列表/树</h3>
          
          <div class="preview-group">
            <h4>自定义列表</h4>
            <div class="custom-list">
              <div class="list-item">
                <span class="item-icon">📁</span>
                <span class="item-text">项目文件夹</span>
                <span class="item-meta">12 项</span>
              </div>
              <div class="list-item hover">
                <span class="item-icon">📄</span>
                <span class="item-text">设计文档.pdf</span>
                <span class="item-meta">2.4 MB</span>
              </div>
              <div class="list-item selected">
                <span class="item-icon">🖼️</span>
                <span class="item-text">效果图.png</span>
                <span class="item-meta">1.2 MB</span>
              </div>
            </div>
          </div>

          <div class="preview-group">
            <h4>Element Plus Table</h4>
            <el-table :data="sampleTableData" style="width: 100%">
              <el-table-column prop="name" label="名称" />
              <el-table-column prop="type" label="类型" />
              <el-table-column prop="size" label="大小" />
            </el-table>
          </div>

          <div class="preview-group">
            <h4>Element Plus Tree</h4>
            <el-tree :data="sampleTreeData" default-expand-all />
          </div>
        </section>

        <!-- P2: 输入框 -->
        <section class="preview-section">
          <h3>P2: 输入框</h3>
          
          <div class="preview-group">
            <h4>自定义输入框</h4>
            <div class="input-row">
              <div class="custom-input-wrapper">
                <input type="text" class="custom-input" placeholder="搜索...">
                <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              </div>
            </div>
          </div>

          <div class="preview-group">
            <h4>Element Plus 输入框</h4>
            <div class="input-row">
              <el-input placeholder="请输入内容" style="width: 200px" />
              <el-input placeholder="禁用状态" disabled style="width: 200px" />
              <el-select placeholder="请选择" style="width: 200px">
                <el-option label="选项一" value="1" />
                <el-option label="选项二" value="2" />
              </el-select>
            </div>
          </div>
        </section>

        <!-- P3: 对话框 -->
        <section class="preview-section">
          <h3>P3: 对话框</h3>
          
          <div class="preview-group">
            <h4>自定义模态框预览</h4>
            <div class="custom-modal-preview">
              <div class="modal-header">对话框标题</div>
              <div class="modal-body">
                这是对话框的正文内容。可以包含各种信息和表单元素。
              </div>
              <div class="modal-footer">
                <button class="custom-btn secondary">取消</button>
                <button class="custom-btn primary">确认</button>
              </div>
            </div>
          </div>

          <div class="preview-group">
            <h4>Element Plus 对话框</h4>
            <el-button @click="showElDialog = true">打开对话框</el-button>
            <el-dialog v-model="showElDialog" title="Element Plus 对话框" width="400px">
              <p>这是 Element Plus 对话框的内容。</p>
              <template #footer>
                <el-button @click="showElDialog = false">取消</el-button>
                <el-button type="primary" @click="showElDialog = false">确认</el-button>
              </template>
            </el-dialog>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useThemeStore } from '../stores/theme';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();
const themeStore = useThemeStore();

const currentTheme = ref('dark'); // Default to dark for init
const showElDialog = ref(false);

// Color Tokens Definition
const surfaceTokens = ref([
  { name: 'background', var: '--md-sys-color-background', value: '' },
  { name: 'surface', var: '--md-sys-color-surface', value: '' },
  { name: 'surface-container-lowest', var: '--md-sys-color-surface-container-lowest', value: '' },
  { name: 'surface-container-low', var: '--md-sys-color-surface-container-low', value: '' },
  { name: 'surface-container', var: '--md-sys-color-surface-container', value: '' },
  { name: 'surface-container-high', var: '--md-sys-color-surface-container-high', value: '' },
  { name: 'surface-container-highest', var: '--md-sys-color-surface-container-highest', value: '' },
]);

const textTokens = ref([
  { name: 'on-surface', var: '--md-sys-color-on-surface', value: '' },
  { name: 'on-surface-variant', var: '--md-sys-color-on-surface-variant', value: '' },
  { name: 'outline', var: '--md-sys-color-outline', value: '' },
]);

const accentTokens = ref([
  { name: 'primary', var: '--md-sys-color-primary', value: '' },
  { name: 'on-primary', var: '--md-sys-color-on-primary', value: '' },
  { name: 'primary-container', var: '--md-sys-color-primary-container', value: '' },
  { name: 'secondary', var: '--md-sys-color-secondary', value: '' },
  { name: 'error', var: '--md-sys-color-error', value: '' },
]);

// Component Tokens
const componentTokens = ref([
  { name: 'input-bg', var: '--input-bg', value: '' },
  { name: 'input-border', var: '--input-border', value: '' },
  { name: 'input-text', var: '--input-text', value: '' },
  { name: 'input-placeholder', var: '--input-placeholder', value: '' },
  { name: 'input-focus-border', var: '--input-focus-border', value: '' },
  { name: 'list-bg', var: '--list-bg', value: '' },
  { name: 'dialog-bg', var: '--dialog-bg', value: '' },
]);

const fontTokens = ref([
  { name: 'font-size-base', var: '--font-size-base', value: '' },
  { name: 'font-family-base', var: '--font-family-base', value: '' },
]);

// Helper: Convert RGB/RGBA to Hex
const rgbToHex = (col) => {
  if (!col) return '#000000';
  if (col.startsWith('#')) return col;
  
  const rgb = col.match(/\d+/g);
  if (!rgb || rgb.length < 3) return '#000000';
  
  const r = parseInt(rgb[0]).toString(16).padStart(2, '0');
  const g = parseInt(rgb[1]).toString(16).padStart(2, '0');
  const b = parseInt(rgb[2]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
};

// Helper to read current computed value
const getComputedValue = (varName) => {
  if (typeof window === 'undefined') return '';
  
  // Try to resolve the variable by applying it to a temporary element
  // This handles both direct values and var(...) references
  const temp = document.createElement('div');
  
  // Use a strategy that forces the browser to calculate styles but keeps element invisible
  // 'display: none' prevents calculation. 'visibility: hidden' should work but sometimes fails with detached context issues?
  // Let's use opacity 0 and absolute positioning
  temp.style.opacity = '0';
  temp.style.position = 'fixed';
  temp.style.top = '0';
  temp.style.left = '0';
  temp.style.width = '10px';
  temp.style.height = '10px';
  temp.style.pointerEvents = 'none';
  temp.style.zIndex = '-9999';
  
  // Use 'background-color' as it supports transparent, unlike color which might inherit
  temp.style.backgroundColor = `var(${varName})`; 
  
  document.body.appendChild(temp);
  
  // Force reflow
  void temp.offsetHeight;
  
  const style = getComputedStyle(temp);
  let val = style.backgroundColor;
  
  document.body.removeChild(temp);
  
  return val ? val.trim() : '';
};
// Initialize values from current DOM
const initTokenValues = () => {
  [surfaceTokens, textTokens, accentTokens, componentTokens].forEach(group => {
    group.value.forEach(token => {
      let computed = getComputedValue(token.var);
      // Fallback for transparent
      if (computed === 'transparent' || computed === 'rgba(0, 0, 0, 0)') {
         computed = '#ffffff00'; // Or handle specially
      }
      token.value = rgbToHex(computed);
    });
  });
  fontTokens.value.forEach(token => {
    token.value = getComputedValue(token.var);
  });
};


// Update CSS Variable immediately
const updateToken = (token) => {
  document.documentElement.style.setProperty(token.var, token.value);
};

// Switch Theme
const setTheme = (theme) => {
  currentTheme.value = theme;
  themeStore.setMode(theme);
  // Re-read values after theme switch (allow slight delay for DOM update)
  setTimeout(initTokenValues, 100);
};

const goBack = () => router.back();

// Export Config
const exportConfig = () => {
  let cssOutput = `/* Generated Theme Config (${currentTheme.value}) */\n`;
  const selector = currentTheme.value === 'dark' ? 'html.dark' : 'html.light';
  cssOutput += `${selector} {\n`;
  
  [surfaceTokens, textTokens, accentTokens, componentTokens].forEach(group => {
    group.value.forEach(token => {
       cssOutput += `  ${token.var}: ${token.value};\n`;
    });
  });
  
  fontTokens.value.forEach(token => {
     cssOutput += `  ${token.var}: ${token.value};\n`;
  });
  
  cssOutput += `}\n`;

  ElMessageBox.alert(`<pre style="max-height: 300px; overflow: auto;">${cssOutput}</pre>`, 'Export CSS', {
    dangerouslyUseHTMLString: true,
    confirmButtonText: 'Copy',
    callback: (action) => {
      if (action === 'confirm') {
        navigator.clipboard.writeText(cssOutput);
        ElMessage.success('Copied to clipboard!');
      }
    }
  });
};

onMounted(() => {
  currentTheme.value = themeStore.isDark ? 'dark' : 'light';
  // Delay initialization to ensure styles are fully applied and computed by the browser
  setTimeout(() => {
    initTokenValues();
  }, 200);
});
</script>

<style scoped>
.theme-debug-page {
  min-height: 100vh;
  background: var(--md-sys-color-background);
  color: var(--md-sys-color-on-background);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}


/* 顶部工具栏 */
.debug-header {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px 24px;
  background: var(--md-sys-color-surface-container);
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  justify-content: space-between;
}

.debug-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.theme-switcher {
  display: flex;
  gap: 8px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.theme-switcher button,
.back-btn,
.action-btn {
  padding: 8px 16px;
  border: 1px solid var(--md-sys-color-outline);
  border-radius: 8px;
  background: transparent;
  color: var(--md-sys-color-on-surface);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
}

.theme-switcher button:hover,
.back-btn:hover,
.action-btn:hover {
  background: var(--md-sys-color-surface-container-high);
}

.theme-switcher button.active {
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border-color: var(--md-sys-color-primary);
}

.action-btn {
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  border-color: transparent;
}
.action-btn:hover {
  background: color-mix(in srgb, var(--md-sys-color-primary-container) 90%, black);
}


/* 主内容区 */
.debug-content {
  display: flex;
  gap: 24px;
  padding: 24px;
  max-width: 1600px;
  margin: 0 auto;
}

/* 左侧实时编辑面板 */
.color-tokens-panel {
  width: 360px;
  flex-shrink: 0;
  background: var(--md-sys-color-surface-container-low);
  border-radius: 12px;
  padding: 20px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  border: 1px solid var(--md-sys-color-outline-variant);
}

.color-tokens-panel h2 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--md-sys-color-primary);
}

.token-section {
  margin-bottom: 24px;
  background: var(--md-sys-color-surface);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--md-sys-color-outline-variant);
}

.token-section h3 {
  margin: 0 0 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.token-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 颜色编辑器行 */
.token-editor-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-preview input[type="color"] {
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 4px;
}


.color-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0; /* Enable flex-shrink for children */
}

.token-name {
  font-size: 11px;
  color: var(--md-sys-color-on-surface-variant);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  /* max-width: 200px; removed specific width to rely on parent */
  width: 100%;
}

.hex-input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 4px;
  background: var(--md-sys-color-surface-container-highest);
  color: var(--md-sys-color-on-surface);
  font-family: monospace;
  font-size: 12px;
  box-sizing: border-box; /* Fix overflow */
}

.hex-input:focus {
  outline: none;
  border-color: var(--md-sys-color-primary);
}

/* 字体编辑器 */
.token-form-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.token-form-item label {
  font-size: 11px;
  color: var(--md-sys-color-on-surface-variant);
}

.font-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 4px;
  background: var(--md-sys-color-surface-container-highest);
  color: var(--md-sys-color-on-surface);
  font-size: 12px;
  box-sizing: border-box; /* Fix overflow */
}


/* 右侧组件预览 */
.components-preview {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  max-height: calc(100vh - 120px);
}

.components-preview h2 {
  margin: 0 0 24px;
  font-size: 18px;
  font-weight: 600;
}

.preview-section {
  margin-bottom: 32px;
  padding: 20px;
  background: var(--md-sys-color-surface-container-low);
  border-radius: 12px;
  border: 1px solid var(--md-sys-color-outline-variant);
}
/* ... existing component preview styles ... */
.preview-section h3 {
  margin: 0 0 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--md-sys-color-primary);
}

.preview-group {
  margin-bottom: 20px;
}

.preview-group h4 {
  margin: 0 0 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--md-sys-color-on-surface-variant);
}

/* 样式复用之前定义的 .toolbar-btn, .button-row, .icon-btn 等 */
/* ... (保留原有组件样式，此处不再重复全部，仅确保容器样式正确) ... */

/* 重新补全被截断的组件样式，确保预览正常 */
.toolbar-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  padding: 8px 12px;
  background: var(--md-sys-color-surface-container);
  border-radius: 6px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  font-size: 11px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;
  transition: all 0.15s;
}

.toolbar-btn:hover {
  background: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface);
}

.toolbar-btn.primary {
  color: var(--md-sys-color-primary);
}

.toolbar-btn.primary:hover {
  background: color-mix(in srgb, var(--md-sys-color-primary) 15%, transparent);
}

.toolbar-btn.danger {
  color: var(--md-sys-color-error);
}

.toolbar-btn.danger:hover {
  background: color-mix(in srgb, var(--md-sys-color-error) 15%, transparent);
}

.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--icon-btn-color);
  cursor: pointer;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: var(--icon-btn-hover-bg);
  color: var(--icon-btn-hover-color);
}

.icon-btn.active {
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}


/* 列表样式 */
.custom-list {
  background: var(--list-bg);
  border: 1px solid var(--list-border);
  border-radius: 8px;
  overflow: hidden;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--list-border);
  color: var(--list-item-text);
}

.list-item:last-child {
  border-bottom: none;
}

.list-item.hover {
  background: var(--list-item-bg-hover);
}

.list-item.selected {
  background: var(--list-item-bg-selected);
  color: var(--list-item-text-selected);
}

.item-text {
  flex: 1;
  font-size: 13px;
}

.item-meta {
  font-size: 11px;
  color: var(--list-item-text-secondary);
}

/* 输入框样式 */
.input-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}

.custom-input-wrapper {
  position: relative;
  width: 200px;
}

.custom-input {
  width: 100%;
  padding: 10px 12px 10px 36px;
  border: 1px solid var(--input-border);
  border-radius: var(--input-radius);
  background: var(--input-bg);
  color: var(--input-text);
  font-size: 13px;
}

.custom-input:focus {
  outline: none;
  border-color: var(--input-focus-border);
}

.custom-input::placeholder {
  color: var(--input-placeholder);
}

.input-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--md-sys-color-on-surface-variant);
}

/* 模态框预览 */
.custom-modal-preview {
  max-width: 400px;
  background: var(--dialog-bg);
  border: 1px solid var(--dialog-border);
  border-radius: var(--dialog-radius);
  overflow: hidden;
}

.modal-header {
  padding: 16px 20px;
  font-size: 16px;
  font-weight: 600;
  border-bottom: 1px solid var(--dialog-border);
  color: var(--dialog-title);
}

.modal-body {
  padding: 20px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--dialog-text);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--dialog-border);
}
</style>
