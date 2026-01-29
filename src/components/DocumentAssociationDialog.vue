<template>
  <el-dialog
    :model-value="visible"
    :title="t('documents.smartAssociation')"
    width="800px"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="$emit('update:visible', $event)"
    @close="handleClose"
  >
    <div class="association-dialog">
      <!-- 左侧：文件列表 -->
      <div class="file-list-panel">
        <div class="panel-header">
          <span>{{ t('documents.fileList') }} ({{ files.length }})</span>
        </div>
        <div class="file-list">
          <div
            v-for="(file, index) in files"
            :key="index"
            class="file-item"
            :class="{ active: currentFileIndex === index }"
            @click="selectFile(index)"
          >
            <span class="file-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </span>
            <span class="file-name" :title="file.name">{{ file.name }}</span>
            <span v-if="getFileMatches(index).length > 0" class="match-count">
              {{ getFileMatches(index).length }}
            </span>
          </div>
        </div>
      </div>

      <!-- 右侧：匹配结果 -->
      <div class="match-panel">
        <div class="panel-header">
          <span>{{ t('documents.associatedObjects') }}</span>
        </div>

        <!-- 匹配结果列表 -->
        <div class="match-list">
          <template v-if="currentMatches.length > 0">
            <div
              v-for="(match, idx) in currentMatches"
              :key="`${match.type}-${match.code}`"
              class="match-item"
            >
              <span class="type-icon" :class="match.type">
                {{ getTypeIcon(match.type) }}
              </span>
              <div class="match-info">
                <span class="match-type">[{{ getTypeLabel(match.type) }}]</span>
                <span class="match-code">{{ match.code }}</span>
                <span class="match-name">{{ match.name }}</span>
              </div>
              <span class="confidence" :style="{ color: getConfidenceColor(match.confidence) }">
                {{ match.confidence }}%
              </span>
              <button class="btn-remove" @click="removeMatch(idx)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </template>
          <div v-else class="empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p>{{ t('documents.noMatchFound') }}</p>
          </div>
        </div>

        <!-- 手动添加 -->
        <div class="add-section">
          <div class="add-header">{{ t('documents.manualAdd') }}</div>
          <div class="add-form">
            <el-select v-model="addForm.type" size="small" style="width: 100px">
              <el-option value="asset" :label="t('documents.objectTypeAsset')" />
              <el-option value="space" :label="t('documents.objectTypeSpace')" />
              <el-option value="spec" :label="t('documents.objectTypeSpec')" />
            </el-select>
            <el-select
              v-model="addForm.selected"
              size="small"
              filterable
              remote
              :remote-method="searchObjects"
              :loading="isSearching"
              :placeholder="t('documents.searchObject')"
              style="flex: 1"
              value-key="code"
            >
              <el-option
                v-for="item in searchResults"
                :key="`${item.type}-${item.code}`"
                :value="item"
                :label="`${item.code} - ${item.name}`"
              />
            </el-select>
            <el-button size="small" type="primary" :disabled="!addForm.selected" @click="addManualMatch">
              {{ t('common.add') }}
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部提示和按钮 -->
    <template #footer>
      <div class="dialog-footer">
        <span v-if="hasLowConfidence" class="warning-text">
          {{ t('documents.lowConfidenceWarning') }}
        </span>
        <div class="footer-buttons">
          <el-button @click="handleSkip">{{ t('documents.skipAssociation') }}</el-button>
          <el-button type="primary" :loading="isUploading" @click="handleConfirm">
            {{ t('documents.confirmAndUpload') }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../stores/auth';

const { t } = useI18n();
const authStore = useAuthStore();

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

const props = defineProps({
  visible: Boolean,
  files: {
    type: Array,
    default: () => []
  },
  folderId: {
    type: [Number, String],
    default: null
  }
});

const emit = defineEmits(['update:visible', 'success', 'skip']);

// 状态
const currentFileIndex = ref(0);
const matchesMap = ref({}); // { fileName: [matches] }
const isLoading = ref(false);
const isUploading = ref(false);
const isSearching = ref(false);
const searchResults = ref([]);

const addForm = ref({
  type: 'asset',
  selected: null
});

// 计算属性
const currentFile = computed(() => props.files[currentFileIndex.value]);
const currentMatches = computed(() => {
  if (!currentFile.value) return [];
  return matchesMap.value[currentFile.value.name] || [];
});

const hasLowConfidence = computed(() => {
  for (const matches of Object.values(matchesMap.value)) {
    if (matches.some(m => m.confidence < 60)) {
      return true;
    }
  }
  return false;
});

// 获取文件的匹配结果
function getFileMatches(index) {
  const file = props.files[index];
  return file ? (matchesMap.value[file.name] || []) : [];
}

// 选择文件
function selectFile(index) {
  currentFileIndex.value = index;
  addForm.value.selected = null;
}

// 获取类型图标
function getTypeIcon(type) {
  const icons = {
    asset: '🔧',
    space: '🏢',
    spec: '📋'
  };
  return icons[type] || '📄';
}

// 获取类型标签
function getTypeLabel(type) {
  const labels = {
    asset: t('documents.objectTypeAsset'),
    space: t('documents.objectTypeSpace'),
    spec: t('documents.objectTypeSpec')
  };
  return labels[type] || type;
}

// 获取置信度颜色
function getConfidenceColor(confidence) {
  if (confidence >= 80) return '#52c41a';
  if (confidence >= 60) return '#1890ff';
  if (confidence >= 50) return '#faad14';
  return '#8c8c8c';
}

// 移除匹配
function removeMatch(index) {
  if (!currentFile.value) return;
  const matches = matchesMap.value[currentFile.value.name];
  if (matches) {
    matches.splice(index, 1);
  }
}

// 搜索对象
async function searchObjects(query) {
  if (!query || query.length < 1) {
    searchResults.value = [];
    return;
  }

  isSearching.value = true;
  try {
    const url = `${API_BASE}/api/v2/documents/search-objects?q=${encodeURIComponent(query)}&types=${addForm.value.type}`;
    console.log('[SearchObjects] Fetching:', url);
    
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    });
    const data = await res.json();
    console.log('[SearchObjects] Response:', data);
    
    if (data.success) {
      searchResults.value = data.data || [];
    } else {
      console.error('[SearchObjects] API error:', data.error);
      searchResults.value = [];
    }
  } catch (error) {
    console.error('[SearchObjects] Fetch error:', error);
    searchResults.value = [];
  } finally {
    isSearching.value = false;
  }
}

// 手动添加匹配
function addManualMatch() {
  if (!addForm.value.selected || !currentFile.value) return;

  const item = addForm.value.selected;
  const matches = matchesMap.value[currentFile.value.name] || [];

  // 检查是否已存在
  const exists = matches.some(m => m.type === item.type && m.code === item.code);
  if (exists) return;

  matches.push({
    type: item.type,
    code: item.code,
    name: item.name,
    confidence: 100,
    matchType: 'manual'
  });

  matchesMap.value[currentFile.value.name] = matches;
  addForm.value.selected = null;
  searchResults.value = [];
}

// 获取匹配结果
async function fetchMatches() {
  if (props.files.length === 0) return;

  isLoading.value = true;
  try {
    const fileNames = props.files.map(f => f.name);
    const res = await fetch(`${API_BASE}/api/v2/documents/match-associations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        fileNames,
        options: { minConfidence: 50, maxResults: 10 }
      })
    });

    const data = await res.json();
    if (data.success) {
      // 构建 matchesMap
      const newMap = {};
      for (const item of data.data) {
        newMap[item.fileName] = item.matches || [];
      }
      matchesMap.value = newMap;
    }
  } catch (error) {
    console.error('Fetch matches error:', error);
  } finally {
    isLoading.value = false;
  }
}

// 跳过关联
function handleSkip() {
  emit('skip', props.files);
}

// 确认上传
async function handleConfirm() {
  isUploading.value = true;
  try {
    // 1. 上传文件
    const formData = new FormData();
    if (props.folderId) {
      formData.append('folderId', props.folderId);
    }
    for (const file of props.files) {
      // 支持 Element Plus Upload 的 file 对象 (有 raw 属性) 或原生 File 对象
      const fileObj = file.raw || file;
      if (fileObj instanceof File) {
        formData.append('files', fileObj);
      } else {
        console.error('Invalid file object:', file);
      }
    }

    const uploadRes = await fetch(`${API_BASE}/api/v2/documents/batch`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authStore.token}` },
      body: formData
    });

    const uploadData = await uploadRes.json();
    if (!uploadData.success) {
      throw new Error(uploadData.error || '上传失败');
    }

    const uploadedDocs = uploadData.data;

    // 2. 构建关联数据
    const associations = [];
    for (let i = 0; i < uploadedDocs.length; i++) {
      const doc = uploadedDocs[i];
      const fileName = props.files[i]?.name;
      const matches = fileName ? (matchesMap.value[fileName] || []) : [];

      if (matches.length > 0) {
        associations.push({
          documentId: doc.id,
          items: matches.map(m => ({ type: m.type, code: m.code }))
        });
      }
    }

    // 3. 批量创建关联
    if (associations.length > 0) {
      await fetch(`${API_BASE}/api/v2/documents/batch-associations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.token}`
        },
        body: JSON.stringify({ associations })
      });
    }

    emit('success');
    emit('update:visible', false);
  } catch (error) {
    console.error('Upload error:', error);
    ElMessage.error(error.message || t('common.error'));
  } finally {
    isUploading.value = false;
  }
}

// 关闭对话框
function handleClose() {
  currentFileIndex.value = 0;
  matchesMap.value = {};
  searchResults.value = [];
  addForm.value = { type: 'asset', selected: null };
}

// 监听 visible 变化，加载匹配结果
watch(() => props.visible, (val) => {
  if (val && props.files.length > 0) {
    currentFileIndex.value = 0;
    fetchMatches();
  }
});
</script>

<style scoped>
.association-dialog {
  display: flex;
  gap: 16px;
  min-height: 400px;
}

.file-list-panel {
  width: 240px;
  flex-shrink: 0;
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.match-panel {
  flex: 1;
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.panel-header {
  padding: 10px 12px;
  font-weight: 500;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

.file-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
  color: var(--el-text-color-primary);
}

.file-item:hover {
  background: var(--el-fill-color-light);
}

.file-item.active {
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
}

.file-icon {
  flex-shrink: 0;
  opacity: 0.6;
}

.file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.match-count {
  background: var(--el-color-primary);
  color: #fff;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
}

.match-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.match-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
  margin-bottom: 8px;
}

.type-icon {
  font-size: 18px;
}

.match-info {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: baseline;
}

.match-type {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.match-code {
  font-weight: 500;
  font-family: monospace;
  color: var(--el-text-color-primary);
}

.match-name {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.confidence {
  font-weight: 600;
  font-size: 13px;
}

.btn-remove {
  padding: 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.2s, background 0.2s;
  border-radius: 4px;
  color: var(--el-text-color-primary);
}

.btn-remove:hover {
  opacity: 1;
  background: var(--el-fill-color-light);
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--el-text-color-secondary);
}

.empty-state p {
  margin-top: 12px;
  font-size: 14px;
}

.add-section {
  border-top: 1px solid var(--el-border-color-light);
  padding: 12px;
}

.add-header {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 10px;
}

.add-form {
  display: flex;
  gap: 8px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
}

.warning-text {
  color: var(--el-color-warning);
  font-size: 13px;
  margin-right: auto;
}

.footer-buttons {
  display: flex;
  gap: 10px;
}
</style>
