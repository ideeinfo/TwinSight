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
        <el-input
          v-model="searchText"
          :placeholder="t('common.search')"
          :prefix-icon="Search"
          size="small"
          clearable
          style="flex: 1"
        />
        <div class="filter-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
    <el-dialog
      v-model="isUploadDialogOpen"
      :title="t('filePanel.uploadModel')"
      width="500px"
      :close-on-click-modal="false"
      destroy-on-close
      class="custom-dialog"
    >
      <div class="form-group">
        <label style="display: block; margin-bottom: 8px;">{{ t('filePanel.fileTitle') }} *</label>
        <el-input 
          v-model="uploadForm.title" 
          type="text" 
          :placeholder="t('filePanel.fileTitlePlaceholder')" 
        />
      </div>
      <div class="form-group" style="margin-top: 16px;">
        <label style="display: block; margin-bottom: 8px;">{{ t('filePanel.selectFile') }}</label>
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
            <el-icon :size="48" color="#666"><UploadFilled /></el-icon>
            <p>{{ t('filePanel.dropHint') }}</p>
          </div>
          <div v-else class="selected-file">
            <el-icon :size="24" color="#38ABDF"><Document /></el-icon>
            <span>{{ uploadForm.file.name }}</span>
            <el-button link type="danger" @click.stop="uploadForm.file = null">
              <el-icon><Close /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
      <div v-if="uploadProgress > 0" class="upload-progress">
        <el-progress :percentage="uploadProgress" :status="uploadProgress === 100 ? 'success' : ''" />
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="closeUploadDialog">{{ t('common.cancel') }}</el-button>
          <el-button type="primary" :disabled="!uploadForm.title || !uploadForm.file || isUploading" :loading="isUploading" @click="uploadFile">
            {{ isUploading ? t('filePanel.uploading') : t('filePanel.upload') }}
          </el-button>
        </span>
      </template>
    </el-dialog>

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
        <div v-if="authStore.hasPermission('model:upload')" class="context-menu-item" @click="handleCreateKB">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          {{ t('filePanel.createKB') }}
        </div>
        <div v-if="authStore.hasPermission('model:upload')" class="context-menu-item" @click="handleSyncDocs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          {{ t('filePanel.syncKB') }}
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
    <el-dialog
      v-model="isEditDialogOpen"
      :title="t('filePanel.editTitle')"
      width="400px"
      :close-on-click-modal="false"
      class="custom-dialog"
    >
      <div class="form-group">
        <label style="display: block; margin-bottom: 8px;">{{ t('filePanel.fileTitle') }} *</label>
        <el-input v-model="editForm.title" :placeholder="t('filePanel.fileTitlePlaceholder')" />
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="closeEditDialog">{{ t('common.cancel') }}</el-button>
          <el-button type="primary" :disabled="!editForm.title || isSaving" :loading="isSaving" @click="saveEdit">
            {{ isSaving ? t('common.saving') : t('common.apply') }}
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 解压进度对话框 -->
    <el-dialog
      v-model="isExtracting"
      :title="t('filePanel.extracting')"
      width="300px"
      :close-on-click-modal="false"
      :show-close="false"
      class="custom-dialog"
    >
      <div class="extract-progress" style="text-align: center; padding: 20px;">
        <div class="spinner"></div>
        <p style="margin-top: 10px;">{{ t('filePanel.extractingHint') }}</p>
      </div>
    </el-dialog>

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
      :visible="dialogState.visible"
      :type="dialogState.type"
      :title="dialogState.title"
      :message="dialogState.message"
      :danger="dialogState.danger"
      :confirm-text="dialogState.confirmText"
      @update:visible="dialogState.visible = $event"
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
import { Search, UploadFilled, Document, Close } from '@element-plus/icons-vue';
import { ElMessageBox } from 'element-plus';
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
  console.log('[FilePanel] showDialog called', options);
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
        console.log('[FilePanel] onConfirm callback, resolving true');
        resolve(true);
      },
      onCancel: () => {
        console.log('[FilePanel] onCancel callback, resolving false');
        resolve(false);
      }
    };
    console.log('[FilePanel] dialogState.visible set to', dialogState.value.visible);
  });
};

// Helper to show alert - 使用 Element Plus 的 MessageBox
const showAlert = (message, title = '') => {
  console.log('[FilePanel] showAlert called with message:', message);
  return ElMessageBox.alert(message, title || t('common.alert'), {
    confirmButtonText: t('common.confirm'),
    customClass: 'custom-dialog'
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

// 创建知识库
const handleCreateKB = async () => {
  const file = contextMenu.value.file;
  hideContextMenu();

  try {
    // 第一次调用，不带force参数
    const response = await fetch(`${API_BASE}/api/files/${file.id}/create-kb`, {
      method: 'POST',
      headers: getHeaders()
    });

    const data = await response.json();

    // 检查是否返回 KB_EXISTS（已有知识库）
    if (data.code === 'KB_EXISTS') {
      // 显示确认对话框
      const confirmed = await showDialog({
        type: 'confirm',
        title: t('filePanel.createKB'),
        message: `该模型已关联知识库 "${data.data.kbName}"。\n\n删除现有知识库将丢失所有已上传的文件，是否继续？`,
        danger: true,
        confirmText: t('filePanel.confirmRecreateKB')
      });

      if (confirmed) {
        // 用户确认，带force=true重新调用
        await recreateKnowledgeBase(file);
      }
    } else if (data.success) {
      await showAlert(t('filePanel.kbCreateSuccess'));

    } else {
      await showAlert(data.error || t('filePanel.kbCreateFailed'));
    }
  } catch (error) {
    console.error('创建知识库错误:', error);
    await showAlert(t('filePanel.kbCreateFailed') + ': ' + error.message);
  }
};

// 重建知识库（force=true）
const recreateKnowledgeBase = async (file) => {
  try {
    const response = await fetch(`${API_BASE}/api/files/${file.id}/create-kb?force=true`, {
      method: 'POST',
      headers: getHeaders()
    });

    const data = await response.json();

    if (data.success) {
      await showAlert(t('filePanel.kbRecreateSuccess'));

    } else {
      await showAlert(data.error || t('filePanel.kbCreateFailed'));
    }
  } catch (error) {
    console.error('重建知识库错误:', error);
    await showAlert(t('filePanel.kbCreateFailed') + ': ' + error.message);
  }
};

// 同步文档到知识库
const handleSyncDocs = async () => {
  const file = contextMenu.value.file;
  hideContextMenu();

  try {
    const response = await fetch(`${API_BASE}/api/files/${file.id}/sync-docs`, {
      method: 'POST',
      headers: getHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      await showAlert(data.error || t('filePanel.syncKBFailed'));
      return;
    }

    if (data.success) {
      await showAlert(data.message);
      await loadFiles();
    }
  } catch (error) {
    console.error('同步文档错误:', error);
    await showAlert(t('filePanel.syncKBFailed') + ': ' + error.message);
  }
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
.left-container { display: flex; height: 100%; width: 100%; background: var(--md-sys-color-surface); border-right: 1px solid var(--md-sys-color-outline-variant); }
.icon-bar { width: 48px; flex-shrink: 0; background: var(--md-sys-color-surface-container-low); border-right: 1px solid var(--md-sys-color-outline-variant); display: flex; flex-direction: column; align-items: center; justify-content: space-between; }
.nav-group-top { width: 100%; display: flex; flex-direction: column; align-items: center; padding-top: 8px; }
.nav-group-bottom { width: 100%; display: flex; flex-direction: column; align-items: center; padding-bottom: 8px; }
.nav-item { width: 100%; height: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #999; cursor: pointer; margin-bottom: 4px; }
.nav-item:hover { background: #333; }
.nav-item.active-blue { border-left: 2px solid var(--md-sys-color-primary); background: var(--md-sys-color-surface-container); color: var(--md-sys-color-primary); }
.nav-item.active-blue svg { stroke: var(--md-sys-color-primary); }
.nav-item.disabled { opacity: 0.3; cursor: not-allowed; pointer-events: none; }
.nav-item svg { margin-bottom: 4px; }
.nav-item .label { font-size: 10px; text-align: center; }
.list-panel { flex: 1; display: flex; flex-direction: column; background: var(--list-bg); }
.panel-header { height: 40px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; border-bottom: 1px solid var(--md-sys-color-outline-variant); }
.title { font-size: 11px; font-weight: 600; color: var(--md-sys-color-on-surface); text-transform: uppercase; }
.actions { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--md-sys-color-secondary); cursor: pointer; }
.actions:hover { color: var(--md-sys-color-primary); }
.plus { font-size: 14px; font-weight: bold; }
.search-row { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--md-sys-color-outline-variant); }
/* .search-input-wrapper removed in template refactor */
/* .search-icon-sm removed */
.filter-icon { cursor: pointer; padding: 4px; color: var(--md-sys-color-secondary); }
.filter-icon:hover { color: var(--md-sys-color-primary); }
.filter-icon svg { stroke: currentColor; }
/* Status Row Removed */

.list-content { flex: 1; overflow-y: auto; }
.empty-state { padding: 40px 20px; text-align: center; color: #666; font-size: 12px; }

/* 文件列表项 */
.list-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--list-border); transition: background-color 0.2s; }
.list-item:hover { background: var(--list-item-bg-hover); }
.list-item.active { background: var(--list-item-bg-selected); border-left: 2px solid var(--md-sys-color-primary); }
.file-icon { flex-shrink: 0; color: var(--md-sys-color-secondary); }
.item-content { flex: 1; min-width: 0; }
.item-name { font-size: 12px; color: var(--list-item-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-meta { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.file-code { font-size: 10px; color: var(--list-item-text-secondary); }
.active-badge { font-size: 9px; background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); padding: 1px 4px; border-radius: 2px; }
.status-badge { font-size: 9px; padding: 1px 4px; border-radius: 2px; }
.status-badge.uploaded { background: var(--md-sys-color-surface-container-high); color: var(--md-sys-color-on-surface); }
.status-badge.extracting { background: var(--color-warning, #ffc107); color: #000; }
.status-badge.ready { background: var(--color-success, #4caf50); color: #fff; }
.status-badge.error { background: var(--md-sys-color-error); color: var(--md-sys-color-on-error); }
.item-actions { flex-shrink: 0; }
.more-btn { background: none; border: none; color: var(--md-sys-color-on-surface-variant); cursor: pointer; padding: 4px; border-radius: 4px; }
.more-btn:hover { background: var(--md-sys-color-surface-container-high); color: var(--md-sys-color-on-surface); }

/* 模态框样式 */
/* 模态框样式已移除，使用 el-dialog */
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 12px; color: var(--md-sys-color-on-surface-variant); margin-bottom: 6px; }
/* Removed legacy input styles */

/* 文件拖放区域 */
/* 文件拖放区域 */
.file-drop-zone { border: 2px dashed var(--md-sys-color-outline); border-radius: 8px; padding: 32px; text-align: center; cursor: pointer; transition: all 0.2s; background: var(--md-sys-color-surface-container-low); }
.file-drop-zone:hover, .file-drop-zone.dragging { border-color: var(--md-sys-color-primary); background: var(--md-sys-color-surface-container); }
.drop-hint { color: var(--md-sys-color-on-surface-variant); }
.drop-hint p { margin: 8px 0 0 0; font-size: 12px; }
.selected-file { display: flex; align-items: center; gap: 8px; color: var(--md-sys-color-on-surface); }
.selected-file span { flex: 1; text-align: left; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.remove-file { background: none; border: none; color: var(--md-sys-color-error); font-size: 18px; cursor: pointer; }

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
/* 上下文菜单 */
.context-menu { position: fixed; background: var(--md-sys-color-surface-container-high); border: 1px solid var(--md-sys-color-outline-variant); border-radius: 6px; min-width: 160px; box-shadow: var(--md-sys-color-shadow); z-index: 10000; overflow: hidden; }
.context-menu-item { display: flex; align-items: center; gap: 8px; padding: 10px 14px; font-size: 12px; color: var(--md-sys-color-on-surface); cursor: pointer; }
.context-menu-item:hover { background: var(--md-sys-color-surface-container-highest); }
.context-menu-item.danger { color: var(--md-sys-color-error); }
.context-menu-item.danger:hover { background: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container); }
.context-menu-divider { height: 1px; background: var(--md-sys-color-outline-variant); margin: 4px 0; }

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
