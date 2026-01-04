<template>
  <div class="left-container">
    <!-- List Panel -->
    <div class="list-panel">
      <div class="panel-header">
        <span class="title">{{ t('filePanel.files') }}</span>
        <div v-if="authStore.hasPermission('model:upload')" class="actions" @click="openUploadDialog">
          <span class="plus">+</span> {{ t('filePanel.uploadModel') }}
        </div>
      </div>
      
      <div class="search-row">
        <div class="search-input-wrapper">
          <svg class="search-icon-sm" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input v-model="searchText" type="text" :placeholder="t('common.search')" />
        </div>
        <div class="filter-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
        </div>
      </div>



      <div class="list-content">
        <!-- 加载提示 -->
        <div v-if="isLoading" class="empty-state">
          <p>{{ t('filePanel.loading') }}</p>
        </div>

        <!-- 文件列表 -->
        <div v-else-if="filteredFiles.length > 0">
          <div
            v-for="file in filteredFiles"
            :key="file.id"
            class="list-item"
            :class="{ active: file.is_active }"
          >
            <div class="file-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div class="item-content">
              <div class="item-name">{{ file.title }}</div>
              <div class="item-meta">
                <span class="file-code">{{ file.file_code }}</span>
                <span v-if="file.is_active" class="active-badge">{{ t('filePanel.active') }}</span>
                <span :class="['status-badge', file.status]">{{ getStatusText(file.status) }}</span>
              </div>
            </div>
            <div class="item-actions">
              <button class="more-btn" @click.stop="showContextMenu($event, file)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="empty-state">
          <p>{{ t('filePanel.noFiles') }}</p>
        </div>
      </div>
    </div>

    <!-- 上传对话框 -->
    <Teleport to="body">
      <div v-if="isUploadDialogOpen" class="modal-overlay" @click="closeUploadDialog">
        <div class="modal-container upload-dialog" @click.stop>
          <div class="modal-header">
            <h3>{{ t('filePanel.uploadModel') }}</h3>
            <button class="modal-close-btn" @click="closeUploadDialog">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>{{ t('filePanel.fileTitle') }} *</label>
              <input v-model="uploadForm.title" type="text" :placeholder="t('filePanel.fileTitlePlaceholder')" />
            </div>
            <div class="form-group">
              <label>{{ t('filePanel.selectFile') }}</label>
              <div
                class="file-drop-zone" 
                :class="{ dragging: isDragging }"
                @click="triggerFileInput"
                @dragover.prevent="onDragOver"
                @dragleave="onDragLeave"
                @drop.prevent="onFileDrop"
              >
                <input ref="fileInput" type="file" accept=".zip,.svfzip" hidden @change="onFileSelect" />
                <div v-if="!uploadForm.file" class="drop-hint">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <p>{{ t('filePanel.dropHint') }}</p>
                </div>
                <div v-else class="selected-file">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38ABDF" stroke-width="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span>{{ uploadForm.file.name }}</span>
                  <button class="remove-file" @click.stop="uploadForm.file = null">×</button>
                </div>
              </div>
            </div>
            <div v-if="uploadProgress > 0" class="upload-progress">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
              </div>
              <span class="progress-text">{{ uploadProgress }}%</span>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="closeUploadDialog">{{ t('common.cancel') }}</button>
            <button class="btn btn-primary" :disabled="!uploadForm.title || !uploadForm.file || isUploading" @click="uploadFile">
              {{ isUploading ? t('filePanel.uploading') : t('filePanel.upload') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 上下文菜单 -->
    <Teleport to="body">
      <div v-if="contextMenu.visible" class="context-menu" :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }" @click.stop>
        <div v-if="authStore.hasPermission('model:upload')" class="context-menu-item" @click="handleEdit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          {{ t('filePanel.edit') }}
        </div>
        <div v-if="authStore.hasPermission('model:activate')" class="context-menu-item" @click="handleActivate">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          {{ t('filePanel.activate') }}
        </div>
        <div v-if="authStore.hasPermission('model:upload')" class="context-menu-item" @click="handleExtract">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {{ t('filePanel.extractData') }}
        </div>
        <div v-if="authStore.hasPermission('influx:read')" class="context-menu-item" @click="handleInfluxConfig">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          {{ t('filePanel.influxConfig') }}
        </div>
        <div class="context-menu-item" @click="handlePanoCompare">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7" />
            <circle cx="12" cy="12" r="3" />
            <path d="M16 16l4 4" />
            <path d="M16 20l4-4" />
          </svg>
          {{ t('filePanel.panoCompare') }}
        </div>
        <div v-if="authStore.hasPermission('model:delete')" class="context-menu-divider"></div>
        <div v-if="authStore.hasPermission('model:delete')" class="context-menu-item danger" @click="handleDelete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          {{ t('filePanel.delete') }}
        </div>
      </div>
    </Teleport>

    <!-- 编辑对话框 -->
    <Teleport to="body">
      <div v-if="isEditDialogOpen" class="modal-overlay" @click="closeEditDialog">
        <div class="modal-container" @click.stop>
          <div class="modal-header">
            <h3>{{ t('filePanel.editTitle') }}</h3>
            <button class="modal-close-btn" @click="closeEditDialog">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>{{ t('filePanel.fileTitle') }} *</label>
              <input v-model="editForm.title" type="text" :placeholder="t('filePanel.fileTitlePlaceholder')" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="closeEditDialog">{{ t('common.cancel') }}</button>
            <button class="btn btn-primary" :disabled="!editForm.title || isSaving" @click="saveEdit">
              {{ isSaving ? t('common.saving') : t('common.apply') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 解压进度对话框 -->
    <Teleport to="body">
      <div v-if="isExtracting" class="modal-overlay">
        <div class="modal-container extract-dialog">
          <div class="modal-header">
            <h3>{{ t('filePanel.extracting') }}</h3>
          </div>
          <div class="modal-body">
            <div class="extract-progress">
              <div class="spinner"></div>
              <p>{{ t('filePanel.extractingHint') }}</p>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- InfluxDB 配置弹窗 -->
    <Teleport to="body">
      <InfluxConfigPanel
        v-if="isInfluxConfigOpen"
        :file-id="influxConfigFileId"
        @close="closeInfluxConfig"
        @saved="onInfluxConfigSaved"
      />
    </Teleport>

    <!-- Confirm Dialog with slot support -->
    <ConfirmDialog
      v-model:visible="dialogState.visible"
      :type="dialogState.type"
      :title="dialogState.title"
      :message="dialogState.message"
      :danger="dialogState.danger"
      :confirm-text="dialogState.confirmText"
      @confirm="dialogState.onConfirm"
      @cancel="dialogState.onCancel"
    >
      <!-- 删除模型时显示知识库选项 -->
      <template v-if="dialogState.showDeleteKBOption" #extra>
        <div class="delete-kb-option">
          <label class="checkbox-label">
            <input v-model="deleteKnowledgeBase" type="checkbox" />
            <span>{{ t('filePanel.deleteKnowledgeBase') }}</span>
          </label>
          <p class="option-hint">{{ t('filePanel.deleteKnowledgeBaseHint') }}</p>
        </div>
      </template>
    </ConfirmDialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import InfluxConfigPanel from './InfluxConfigPanel.vue';
import ConfirmDialog from './ConfirmDialog.vue';


import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const { t } = useI18n();

// Helper to get auth headers
const getHeaders = () => {
  const headers = {};
  if (authStore.token) {
    headers['Authorization'] = `Bearer ${authStore.token}`;
  }
  return headers;
};

const emit = defineEmits(['file-activated', 'open-data-export']);

// 状态
const files = ref([]);
const isLoading = ref(true);
const searchText = ref('');
const isUploadDialogOpen = ref(false);
const isUploading = ref(false);
const currentXHR = ref(null); // 保存当前上传请求的引用，用于取消
const uploadProgress = ref(0);
const isDragging = ref(false);
const isExtracting = ref(false);
const fileInput = ref(null);
const isEditDialogOpen = ref(false);
const isSaving = ref(false);
const isInfluxConfigOpen = ref(false);
const influxConfigFileId = ref(null);
const deleteKnowledgeBase = ref(true);

const uploadForm = ref({
  title: '',
  file: null
});

const editForm = ref({
  id: null,
  title: ''
});

const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  file: null
});

// Dialog state for ConfirmDialog
const dialogState = ref({
  visible: false,
  type: 'confirm',
  title: '',
  message: '',
  danger: false,
  confirmText: '',
  showDeleteKBOption: false,
  onConfirm: () => {},
  onCancel: () => {}
});

// Helper to show dialog
const showDialog = (options) => {
  return new Promise((resolve) => {
    dialogState.value = {
      visible: true,
      type: options.type || 'confirm',
      title: options.title || '',
      message: options.message || '',
      danger: options.danger || false,
      confirmText: options.confirmText || '',
      showDeleteKBOption: options.showDeleteKBOption || false,
      onConfirm: () => {
        dialogState.value.visible = false;
        resolve(true);
      },
      onCancel: () => {
        dialogState.value.visible = false;
        resolve(false);
      }
    };
  });
};

// Helper to show alert
const showAlert = (message, title = '') => {
  return showDialog({
    type: 'alert',
    title: title || t('common.alert'),
    message
  });
};

// API 基础 URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// 计算属性
const filteredFiles = computed(() => {
  if (!searchText.value) return files.value;
  const search = searchText.value.toLowerCase();
  return files.value.filter(f => 
    f.title.toLowerCase().includes(search) || 
    f.file_code.toLowerCase().includes(search)
  );
});

// 获取状态文本
const getStatusText = (status) => {
  const map = {
    uploaded: t('filePanel.statusUploaded'),
    extracting: t('filePanel.statusExtracting'),
    ready: t('filePanel.statusReady'),
    error: t('filePanel.statusError')
  };
  return map[status] || status;
};

// 加载文件列表
const loadFiles = async () => {
  isLoading.value = true;
  try {
    const response = await fetch(`${API_BASE}/api/files`, {
      headers: getHeaders()
    });
    const data = await response.json();
    if (data.success) {
      files.value = data.data;
    }
  } catch (error) {
    console.error('加载文件列表失败:', error);
  } finally {
    isLoading.value = false;
  }
};

// 上传对话框
const openUploadDialog = () => {
  uploadForm.value = { title: '', file: null };
  uploadProgress.value = 0;
  isUploadDialogOpen.value = true;
};

const closeUploadDialog = () => {
  // 如果正在上传，先取消请求
  if (currentXHR.value) {
    currentXHR.value.abort();
    currentXHR.value = null;
    isUploading.value = false;
    uploadProgress.value = 0;
  }
  isUploadDialogOpen.value = false;
};

const triggerFileInput = () => {
  fileInput.value?.click();
};

const onFileSelect = (e) => {
  const file = e.target.files[0];
  if (file) {
    uploadForm.value.file = file;
  }
};

const onDragOver = () => {
  isDragging.value = true;
};

const onDragLeave = () => {
  isDragging.value = false;
};

const onFileDrop = (e) => {
  isDragging.value = false;
  const file = e.dataTransfer.files[0];
  if (file && (file.name.endsWith('.zip') || file.name.endsWith('.svfzip'))) {
    uploadForm.value.file = file;
  }
};

// 上传文件
const uploadFile = async () => {
  if (!uploadForm.value.title || !uploadForm.value.file) return;

  isUploading.value = true;
  uploadProgress.value = 0;

  try {
    const formData = new FormData();
    formData.append('title', uploadForm.value.title);
    formData.append('file', uploadForm.value.file);

    const xhr = new XMLHttpRequest();
    
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        uploadProgress.value = Math.round((e.loaded / e.total) * 100);
      }
    };

    xhr.onload = async () => {
      if (xhr.status === 200) {
        const result = JSON.parse(xhr.responseText);
        if (result.success) {
          closeUploadDialog();
          loadFiles();
        } else {
          await showAlert(result.error || t('filePanel.uploadFailed'));
        }
      } else {
        await showAlert(t('filePanel.uploadFailed'));
      }
      currentXHR.value = null;
      isUploading.value = false;
    };

    xhr.onerror = async () => {
      await showAlert(t('filePanel.uploadFailed'));
      currentXHR.value = null;
      isUploading.value = false;
    };

    xhr.open('POST', `${API_BASE}/api/files/upload`);
    
    // Add auth header
    if (authStore.token) {
      xhr.setRequestHeader('Authorization', `Bearer ${authStore.token}`);
    }
    
    currentXHR.value = xhr; // 保存引用以便取消
    xhr.send(formData);

  } catch (error) {
    console.error('上传失败:', error);
    await showAlert(t('filePanel.uploadFailed') + ': ' + error.message);
    isUploading.value = false;
  }
};

// 上下文菜单
const showContextMenu = (e, file) => {
  contextMenu.value = {
    visible: true,
    x: e.clientX,
    y: e.clientY,
    file
  };
};

const hideContextMenu = () => {
  contextMenu.value.visible = false;
};

// 激活文件
const handleActivate = async () => {
  const file = contextMenu.value.file;
  hideContextMenu();

  if (file.status !== 'ready') {
    await showAlert(t('filePanel.needExtractFirst'));
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/files/${file.id}/activate`, { 
      method: 'POST',
      headers: getHeaders()
    });
    const data = await response.json();
    if (data.success) {
      await loadFiles();
      emit('file-activated', data.data);
    } else {
      await showAlert(data.error);
    }
  } catch (error) {
    await showAlert(t('filePanel.activateFailed') + ': ' + error.message);
  }
};

// 编辑文件
const handleEdit = () => {
  const file = contextMenu.value.file;
  hideContextMenu();
  editForm.value = {
    id: file.id,
    title: file.title
  };
  isEditDialogOpen.value = true;
};

const closeEditDialog = () => {
  isEditDialogOpen.value = false;
};

const saveEdit = async () => {
  if (!editForm.value.title) return;
  
  isSaving.value = true;
  try {
    const response = await fetch(`${API_BASE}/api/files/${editForm.value.id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        ...getHeaders()
      },
      body: JSON.stringify({ title: editForm.value.title })
    });
    const data = await response.json();
    if (data.success) {
      closeEditDialog();
      await loadFiles();
    } else {
      await showAlert(data.error);
    }
  } catch (error) {
    await showAlert(t('filePanel.saveFailed') + ': ' + error.message);
  } finally {
    isSaving.value = false;
  }
};

// 解压文件
const handleExtract = async () => {
  const file = contextMenu.value.file;
  hideContextMenu();

  // 检查是否已经提取过数据
  if (file.status === 'ready') {
    // 如果已就绪，直接打开导出面板，不再重复解压
    emit('open-data-export', file);
    return;
  }

  isExtracting.value = true;

  try {
    const response = await fetch(`${API_BASE}/api/files/${file.id}/extract`, { 
      method: 'POST',
      headers: getHeaders()
    });
    const data = await response.json();
    
    isExtracting.value = false;
    
    if (data.success) {
      await loadFiles();
      // 打开数据导出面板
      emit('open-data-export', file);
    } else {
      await showAlert(data.error);
    }
  } catch (error) {
    isExtracting.value = false;
    await showAlert(t('filePanel.extractFailed') + ': ' + error.message);
  }
};

// 删除文件
const handleDelete = async () => {
  const file = contextMenu.value.file;
  hideContextMenu();
  
  // 重置删除知识库选项为默认值
  deleteKnowledgeBase.value = true;

  const confirmed = await showDialog({
    type: 'confirm',
    title: t('filePanel.delete'),
    message: t('filePanel.confirmDelete', { title: file.title }),
    danger: true,
    confirmText: t('filePanel.delete'),
    showDeleteKBOption: true  // 显示删除知识库选项
  });

  if (!confirmed) return;

  try {
    // 构建删除 URL，包含是否删除知识库的参数
    const url = `${API_BASE}/api/files/${file.id}?deleteKB=${deleteKnowledgeBase.value}`;
    const response = await fetch(url, { 
      method: 'DELETE',
      headers: getHeaders()
    });
    const data = await response.json();
    if (data.success) {
      await loadFiles();
    } else {
      await showAlert(data.error);
    }
  } catch (error) {
    await showAlert(t('filePanel.deleteFailed') + ': ' + error.message);
  }
};

// 全局点击关闭上下文菜单
const onGlobalClick = () => {
  hideContextMenu();
};

// InfluxDB 配置
const handleInfluxConfig = () => {
  const file = contextMenu.value.file;
  hideContextMenu();
  influxConfigFileId.value = file.id;
  isInfluxConfigOpen.value = true;
};

const closeInfluxConfig = () => {
  isInfluxConfigOpen.value = false;
  influxConfigFileId.value = null;
};

const onInfluxConfigSaved = (config) => {
  console.log('InfluxDB 配置已保存:', config);
  // 可以在这里添加保存成功的提示
};

const handlePanoCompare = () => {
  const file = contextMenu.value.file;
  hideContextMenu();
  // 在新标签页打开全景比对视图
  const url = `/viewer?mode=pano-compare&fileId=${file.id}`;
  window.open(url, '_blank');
};

onMounted(() => {
  loadFiles();
  document.addEventListener('click', onGlobalClick);
});

onUnmounted(() => {
  document.removeEventListener('click', onGlobalClick);
});
</script>

<style scoped>
.left-container { display: flex; height: 100%; width: 100%; background: #252526; border-right: 1px solid #1e1e1e; }
.icon-bar { width: 48px; flex-shrink: 0; background: #2b2b2b; border-right: 1px solid #1e1e1e; display: flex; flex-direction: column; align-items: center; justify-content: space-between; }
.nav-group-top { width: 100%; display: flex; flex-direction: column; align-items: center; padding-top: 8px; }
.nav-group-bottom { width: 100%; display: flex; flex-direction: column; align-items: center; padding-bottom: 8px; }
.nav-item { width: 100%; height: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #999; cursor: pointer; margin-bottom: 4px; }
.nav-item:hover { background: #333; }
.nav-item.active-blue { border-left: 2px solid #38ABDF; background: #2a2d2e; color: #38ABDF; }
.nav-item.active-blue svg { stroke: #38ABDF; }
.nav-item.disabled { opacity: 0.3; cursor: not-allowed; pointer-events: none; }
.nav-item svg { margin-bottom: 4px; }
.nav-item .label { font-size: 10px; text-align: center; }
.list-panel { flex: 1; display: flex; flex-direction: column; background: #252526; }
.panel-header { height: 40px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; border-bottom: 1px solid #1e1e1e; }
.title { font-size: 11px; font-weight: 600; color: #ccc; text-transform: uppercase; }
.actions { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #888; cursor: pointer; }
.actions:hover { color: #38ABDF; }
.plus { font-size: 14px; font-weight: bold; }
.search-row { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid #1e1e1e; }
.search-input-wrapper { flex: 1; position: relative; }
.search-input-wrapper input { width: 100%; background: #1e1e1e; border: 1px solid #333; border-radius: 3px; padding: 4px 8px 4px 24px; color: #ccc; font-size: 11px; }
.search-input-wrapper input:focus { outline: none; border-color: #38ABDF; }
.search-icon-sm { position: absolute; left: 6px; top: 50%; transform: translateY(-50%); }
.filter-icon { cursor: pointer; padding: 4px; }
.filter-icon:hover svg { stroke: #38ABDF; }
/* Status Row Removed */

.list-content { flex: 1; overflow-y: auto; }
.empty-state { padding: 40px 20px; text-align: center; color: #666; font-size: 12px; }

/* 文件列表项 */
.list-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #1e1e1e; }
.list-item:hover { background: #2a2a2a; }
.list-item.active { background: #2a2d2e; border-left: 2px solid #38ABDF; }
.file-icon { flex-shrink: 0; color: #888; }
.item-content { flex: 1; min-width: 0; }
.item-name { font-size: 12px; color: #ccc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-meta { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.file-code { font-size: 10px; color: #666; }
.active-badge { font-size: 9px; background: #38ABDF; color: #fff; padding: 1px 4px; border-radius: 2px; }
.status-badge { font-size: 9px; padding: 1px 4px; border-radius: 2px; }
.status-badge.uploaded { background: #555; color: #ccc; }
.status-badge.extracting { background: #ffc107; color: #000; }
.status-badge.ready { background: #4caf50; color: #fff; }
.status-badge.error { background: #f44336; color: #fff; }
.item-actions { flex-shrink: 0; }
.more-btn { background: none; border: none; color: #888; cursor: pointer; padding: 4px; border-radius: 4px; }
.more-btn:hover { background: #333; color: #fff; }

/* 模态框 */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.modal-container { background: #252526; border-radius: 8px; max-width: 480px; width: 90%; max-height: 80vh; overflow: hidden; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid #333; }
.modal-header h3 { margin: 0; font-size: 16px; color: #fff; }
.modal-close-btn { background: none; border: none; color: #888; font-size: 24px; cursor: pointer; line-height: 1; }
.modal-close-btn:hover { color: #fff; }
.modal-body { padding: 16px; }
.modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 16px; border-top: 1px solid #333; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 12px; color: #aaa; margin-bottom: 6px; }
.form-group input[type="text"] { width: 100%; background: #1e1e1e; border: 1px solid #444; border-radius: 4px; padding: 8px 12px; color: #fff; font-size: 13px; }
.form-group input:focus { outline: none; border-color: #38ABDF; }

/* 文件拖放区域 */
.file-drop-zone { border: 2px dashed #444; border-radius: 8px; padding: 32px; text-align: center; cursor: pointer; transition: all 0.2s; }
.file-drop-zone:hover, .file-drop-zone.dragging { border-color: #38ABDF; background: rgba(0, 176, 255, 0.05); }
.drop-hint { color: #666; }
.drop-hint p { margin: 8px 0 0 0; font-size: 12px; }
.selected-file { display: flex; align-items: center; gap: 8px; color: #ccc; }
.selected-file span { flex: 1; text-align: left; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.remove-file { background: none; border: none; color: #f44336; font-size: 18px; cursor: pointer; }

/* 上传进度 */
.upload-progress { margin-top: 16px; }
.progress-bar { height: 4px; background: #333; border-radius: 2px; overflow: hidden; }
.progress-fill { height: 100%; background: #38ABDF; transition: width 0.2s; }
.progress-text { display: block; text-align: right; font-size: 11px; color: #888; margin-top: 4px; }

/* 按钮 */
.btn { padding: 8px 16px; border: none; border-radius: 4px; font-size: 13px; cursor: pointer; transition: all 0.2s; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: #38ABDF; color: #fff; }
.btn-primary:hover:not(:disabled) { background: #0091ea; }
.btn-secondary { background: #444; color: #ccc; }
.btn-secondary:hover:not(:disabled) { background: #555; }

/* 上下文菜单 */
.context-menu { position: fixed; background: #2d2d2d; border: 1px solid #444; border-radius: 6px; min-width: 160px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10000; overflow: hidden; }
.context-menu-item { display: flex; align-items: center; gap: 8px; padding: 10px 14px; font-size: 12px; color: #ccc; cursor: pointer; }
.context-menu-item:hover { background: #3e3e3e; }
.context-menu-item.danger { color: #f44336; }
.context-menu-item.danger:hover { background: rgba(244, 67, 54, 0.15); }
.context-menu-divider { height: 1px; background: #444; margin: 4px 0; }

/* 解压进度 */
.extract-progress { text-align: center; padding: 20px; }
.spinner { width: 40px; height: 40px; border: 3px solid #333; border-top-color: #38ABDF; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px; }
@keyframes spin { to { transform: rotate(360deg); } }
.extract-progress p { color: #aaa; font-size: 13px; margin: 0; }

/* 滚动条 */
.list-content::-webkit-scrollbar { width: 10px; }
.list-content::-webkit-scrollbar-track { background: #1e1e1e; }
.list-content::-webkit-scrollbar-thumb { background: #3e3e42; border-radius: 5px; }
.list-content::-webkit-scrollbar-thumb:hover { background: #4e4e52; }

/* 删除知识库选项 */
.delete-kb-option { margin-top: 16px; padding-top: 12px; border-top: 1px solid #3e3e42; }
.checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; color: #ccc; font-size: 13px; }
.checkbox-label input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; accent-color: #38ABDF; }
.option-hint { margin: 6px 0 0 24px; font-size: 11px; color: #888; }
</style>
