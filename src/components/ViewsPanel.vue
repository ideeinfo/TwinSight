<template>
  <div v-if="visible" class="views-panel">
    <div class="panel-header">
      <div class="header-left">
        <h3>{{ $t('views.title') }}</h3>
        <span class="current-view-name">{{ currentViewName || $t('views.noViewSelected') }}</span>
      </div>
      <div class="header-actions">
        <button class="btn-save" :title="currentViewName ? $t('views.saveCurrentView') : $t('views.save')" @click="saveView">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          {{ $t('views.save') }}
        </button>
        <button class="btn-save-as" @click="showSaveAsDialog">
          + {{ $t('views.saveAs') }}
        </button>
      </div>
      <button class="btn-close" @click="$emit('close')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>

    <!-- Tab bar -->
    <div class="tab-bar">
      <button class="tab-btn" :class="{ active: displayMode === 'list' }" :title="$t('views.listMode')" @click="displayMode = 'list'">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      </button>
      <button class="tab-btn" :class="{ active: displayMode === 'gallery' }" :title="$t('views.galleryMode')" @click="displayMode = 'gallery'">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      </button>
    </div>

    <!-- Search and sort -->
    <div class="search-bar">
      <div class="search-input-wrapper">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input v-model="searchTerm" type="text" :placeholder="$t('views.searchPlaceholder')" @input="debouncedSearch" />
      </div>
      <button class="btn-sort" :title="$t('views.sort')" @click="toggleSort">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m3 16 4 4 4-4" />
          <path d="M7 20V4" />
          <path d="m21 8-4-4-4 4" />
          <path d="M17 4v16" />
        </svg>
        {{ sortOrder === 'asc' ? 'A-Z' : 'Z-A' }}
      </button>
    </div>

    <!-- Views content -->
    <div class="views-content">
      <div v-if="loading" class="loading">{{ $t('common.loading') }}</div>
      
      <div v-else-if="views.length === 0" class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
        <p>{{ $t('views.noViews') }}</p>
      </div>

      <!-- Gallery mode -->
      <div v-else-if="displayMode === 'gallery'" class="gallery-view">
        <div v-for="view in views" :key="view.id" class="view-card" :class="{ active: currentView?.id === view.id }" @click="selectAndRestoreView(view)">
          <div class="card-thumbnail">
            <img v-if="view.thumbnail" :src="view.thumbnail" :alt="view.name" />
            <div v-else class="no-thumbnail">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </div>
            <!-- 默认视图 Home 图标 -->
            <div v-if="view.is_default" class="default-view-badge" :title="$t('views.defaultView')">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
            </div>
          </div>
          <div class="card-info">
            <span class="card-name">{{ view.name }}</span>
            <button class="btn-menu" @click.stop="showViewMenu(view, $event)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- List mode -->
      <div v-else class="list-view">
        <div v-for="view in views" :key="view.id" class="view-item" :class="{ active: currentView?.id === view.id }" @click="selectAndRestoreView(view)">
          <div class="item-name-wrapper">
            <svg v-if="view.is_default" class="default-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" :title="$t('views.defaultView')">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
            <span class="item-name">{{ view.name }}</span>
          </div>
          <button class="btn-menu" @click.stop="showViewMenu(view, $event)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Context menu -->
    <div v-if="contextMenu.visible" class="context-menu" :style="contextMenu.style" @click.stop>
      <div class="menu-item" @click.stop="toggleDefaultView">
        {{ contextMenu.view?.is_default ? $t('views.removeDefault') : $t('views.setAsDefault') }}
      </div>
      <div class="menu-item" @click.stop="renameView">{{ $t('views.rename') }}</div>
      <div class="menu-item" @click.stop="updateView">{{ $t('views.update') }}</div>
      <div class="menu-item danger" @click.stop="deleteView">{{ $t('views.delete') }}</div>
    </div>

    <!-- General Confirm/Prompt Dialog removed, using ElMessageBox -->
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessageBox } from 'element-plus';

const { t } = useI18n();
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const props = defineProps({
  visible: { type: Boolean, default: false },
  fileId: { type: [Number, String], default: null },
  fileName: { type: String, default: '' }
});

const emit = defineEmits(['close', 'get-viewer-state', 'capture-screenshot', 'restore-view', 'current-view-changed']);

// State
const views = ref([]);
const loading = ref(false);
const displayMode = ref('gallery');
const searchTerm = ref('');
const sortBy = ref('name');
const sortOrder = ref('asc');
const currentView = ref(null);

// Helper to show dialog using ElMessageBox
const showDialog = async (options) => {
  try {
    if (options.type === 'prompt') {
      // Use ElMessageBox.prompt for input dialogs
      const { value } = await ElMessageBox.prompt(
        options.message || '',
        options.title || t('common.input'),
        {
          confirmButtonText: options.confirmText || t('common.confirm'),
          cancelButtonText: t('common.cancel'),
          inputPlaceholder: options.placeholder || '',
          inputValue: options.defaultValue || ''
        }
      );
      return value;
    } else {
      // Use ElMessageBox.confirm for confirm dialogs
      await ElMessageBox.confirm(
        options.message || '',
        options.title || t('common.confirm'),
        {
          confirmButtonText: options.confirmText || t('common.confirm'),
          cancelButtonText: t('common.cancel'),
          type: options.danger ? 'warning' : 'info',
          dangerouslyUseHTMLString: false
        }
      );
      return true;
    }
  } catch {
    return options.type === 'prompt' ? null : false;
  }
};

// Helper to show alert
const showAlert = async (message, title = '') => {
  await ElMessageBox.alert(message, title || t('common.alert'), {
    confirmButtonText: t('common.confirm'),
    type: 'warning'
  });
};

// Current view name for display
const currentViewName = computed(() => currentView.value?.name || '');

// Context menu
const contextMenu = ref({
  visible: false,
  style: {},
  view: null
});

// Load views
const loadViews = async () => {
  if (!props.fileId) return;
  
  loading.value = true;
  try {
    const params = new URLSearchParams({
      fileId: props.fileId,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value
    });
    if (searchTerm.value) {
      params.append('search', searchTerm.value);
    }
    
    const response = await fetch(`${API_BASE}/api/views?${params}`);
    const data = await response.json();
    
    if (data.success) {
      views.value = data.data;
      
      // 如果当前没有选中视图，自动选中默认视图
      if (!currentView.value) {
        const defaultView = views.value.find(v => v.is_default);
        if (defaultView) {
          currentView.value = defaultView;
          emit('current-view-changed', defaultView.name);
          console.log('🏠 自动选中默认视图:', defaultView.name);
        }
      }
    }
  } catch (error) {
    console.error('Failed to load views:', error);
  } finally {
    loading.value = false;
  }
};

// Debounced search
let searchTimeout = null;
const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadViews();
  }, 300);
};

// Toggle sort
const toggleSort = () => {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  loadViews();
};

// Save view (prefer current view, else use file name)
const saveView = async () => {
  if (!props.fileId) {
    await showAlert(t('views.activateFileFirst'));
    return;
  }
  
  if (currentView.value) {
    console.log('Saving current view:', currentView.value.name);
    await createOrUpdateView(currentView.value.name);
  } else if (props.fileName) {
    console.log('Saving with file name:', props.fileName);
    await createOrUpdateView(props.fileName);
  } else {
    await showAlert(t('views.selectViewOrFile'));
  }
};

// Select and restore view
const selectAndRestoreView = async (view) => {
  currentView.value = view;
  emit('current-view-changed', view.name);
  await restoreView(view);
};

// Show save as dialog - using ConfirmDialog
const showSaveAsDialog = async () => {
  const result = await showDialog({
    type: 'prompt',
    title: t('views.saveAs'),
    placeholder: t('views.namePlaceholder'),
    defaultValue: ''
  });
  
  if (result && result.trim()) {
    await createOrUpdateView(result.trim());
  }
};

// Create or update view
const createOrUpdateView = async (name) => {
  if (!props.fileId) return;
  
  try {
    const state = await new Promise((resolve) => {
      emit('get-viewer-state', resolve);
    });
    
    // 验证状态是否有效
    if (!state || !state.viewerState) {
      console.error('❌ Failed to get viewer state:', state);
      await showAlert(t('views.captureStateFailed'));
      return;
    }
    
    const thumbnail = await new Promise((resolve) => {
      emit('capture-screenshot', resolve);
    });
    
    const viewData = {
      fileId: props.fileId,
      name,
      thumbnail,
      viewer_state: state.viewerState, // Use snake_case for DB compatibility
      other_settings: state.otherSettings
    };
    
    const response = await fetch(`${API_BASE}/api/views`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(viewData)
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('View saved:', name);
      await loadViews();
      // Update currentView to the newly saved view
      const savedView = views.value.find(v => v.name === name);
      if (savedView) {
        currentView.value = savedView;
        emit('current-view-changed', savedView.name);
      }
    } else if (response.status === 409) {
      const confirmed = await showDialog({
        type: 'confirm',
        title: t('views.save'),
        message: t('views.confirmOverwrite', { name })
      });
      
      if (confirmed) {
        const existingView = views.value.find(v => v.name === name);
        if (existingView) {
          await updateViewById(existingView.id, viewData);
          // Get fresh view data after loadViews
          const updatedView = views.value.find(v => v.name === name);
          if (updatedView) {
            currentView.value = updatedView;
            emit('current-view-changed', updatedView.name);
          }
        }
      }
    } else {
      await showAlert(t('views.saveFailed'));
    }
  } catch (error) {
    console.error('Failed to save view:', error);
    await showAlert(t('views.saveFailed'));
  }
};

// Update view by ID
const updateViewById = async (id, viewData) => {
  try {
    const response = await fetch(`${API_BASE}/api/views/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(viewData)
    });
    
    const data = await response.json();
    if (data.success) {
      console.log('View updated');
      await loadViews();
    }
  } catch (error) {
    console.error('Failed to update view:', error);
  }
};

// Restore view
const restoreView = async (view) => {
  try {
    const response = await fetch(`${API_BASE}/api/views/${view.id}`);
    const data = await response.json();
    
    if (data.success) {
      emit('restore-view', data.data);
    }
  } catch (error) {
    console.error('Failed to restore view:', error);
  }
};

// Show view menu
// Show view menu
const showViewMenu = (view, event) => {
  const menuWidth = 100; // Estimated width
  const windowWidth = window.innerWidth;
  const x = event.clientX + menuWidth > windowWidth ? event.clientX - menuWidth : event.clientX;
  
  contextMenu.value = {
    visible: true,
    style: {
      left: `${x}px`,
      top: `${event.clientY}px`
    },
    view
  };
};

// Close context menu
const closeContextMenu = () => {
  contextMenu.value.visible = false;
};

// Rename view
const renameView = async () => {
  const view = contextMenu.value.view;
  closeContextMenu();
  
  const newName = await showDialog({
    type: 'prompt',
    title: t('views.rename'),
    placeholder: t('views.namePlaceholder'),
    defaultValue: view.name
  });
  
  if (newName && newName !== view.name) {
    await updateViewById(view.id, { name: newName });
  }
};

// Update view
const updateView = async () => {
  const view = contextMenu.value.view;
  closeContextMenu();
  
  await createOrUpdateView(view.name);
};

// Delete view - using ConfirmDialog
const deleteView = async () => {
  const view = contextMenu.value.view;
  if (!view) {
    console.log('❌ No view found in context menu');
    return;
  }
  
  console.log('🗑️ Opening delete dialog for view:', view.name, 'ID:', view.id);
  closeContextMenu();
  
  const confirmed = await showDialog({
    type: 'confirm',
    title: t('views.delete'),
    message: t('views.confirmDelete', { name: view.name }),
    danger: true,
    confirmText: t('views.delete')
  });
  
  if (!confirmed) return;
  
  console.log('🗑️ Confirmed delete view:', view.name, 'ID:', view.id);
  
  try {
    const response = await fetch(`${API_BASE}/api/views/${view.id}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    if (data.success) {
      console.log('✅ View deleted successfully');
      if (currentView.value?.id === view.id) {
        currentView.value = null;
        emit('current-view-changed', '');
      }
      await loadViews();
    } else {
      await showAlert(t('views.deleteFailed'));
    }
  } catch (error) {
    console.error('Failed to delete view:', error);
    await showAlert(t('views.deleteFailed'));
  }
};

// Toggle default view
const toggleDefaultView = async () => {
  const view = contextMenu.value.view;
  closeContextMenu();
  
  try {
    const response = await fetch(`${API_BASE}/api/views/${view.id}/set-default`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDefault: !view.is_default })
    });
    
    const data = await response.json();
    if (data.success) {
      console.log(`🏠 ${view.is_default ? '取消' : '设置'}默认视图: ${view.name}`);
      await loadViews();
    } else {
      await showAlert(t('views.updateDefaultFailed'));
    }
  } catch (error) {
    console.error('Failed to toggle default view:', error);
    await showAlert(t('views.updateDefaultFailed'));
  }
};

// Watch for visibility and fileId changes
watch(() => [props.visible, props.fileId], ([visible, fileId]) => {
  if (visible && fileId) {
    loadViews();
  }
}, { immediate: true });

onMounted(() => {
  document.addEventListener('click', closeContextMenu);
  if (props.visible && props.fileId) {
    loadViews();
  }
});

onUnmounted(() => {
  document.removeEventListener('click', closeContextMenu);
});
</script>

<style scoped>
.views-panel {
  position: fixed;
  top: 48px;
  right: 0;
  width: 419px;
  max-height: calc(100vh - 48px);
  background: #1e1e1e;
  border-left: 1px solid #444;
  display: flex;
  flex-direction: column;
  z-index: 150;
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.6), -2px 0 8px rgba(0, 0, 0, 0.4);
}

.panel-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #333;
  gap: 12px;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.panel-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.current-view-name {
  font-size: 11px;
  color: #38ABDF;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-actions {
  display: flex;
  gap: 8px;
  flex: 1;
  justify-content: flex-end;
}

.btn-save, .btn-save-as {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 11px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-save {
  background: #38ABDF;
  border: none;
  color: #fff;
  font-weight: 500;
}

.btn-save:hover {
  background: #2D9ACC;
}

.btn-save-as {
  background: transparent;
  border: 1px solid #38ABDF;
  color: #38ABDF;
}

.btn-save-as:hover {
  background: rgba(77, 208, 225, 0.1);
}

.btn-close {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 4px;
}

.btn-close:hover {
  color: #fff;
}

.tab-bar {
  display: flex;
  gap: 4px;
  padding: 8px 16px;
  border-bottom: 1px solid #333;
}

.tab-btn {
  background: transparent;
  border: none;
  color: #888;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.tab-btn:hover {
  background: #3e3e42;
  color: #fff;
}

.tab-btn.active {
  background: #38ABDF;
  color: #fff;
}

.tab-btn.active:hover {
  background: #2D9ACC;
}

.search-bar {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #333;
}

.search-input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #2d2d2d;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  padding: 0 8px;
}

.search-input-wrapper svg {
  color: #888;
  flex-shrink: 0;
}

.search-input-wrapper input {
  flex: 1;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 12px;
  padding: 6px 0;
  outline: none;
}

.search-input-wrapper input::placeholder {
  color: #666;
}

.btn-sort {
  display: flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: 1px solid #3e3e42;
  color: #888;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
}

.btn-sort:hover {
  border-color: #555;
  color: #fff;
}

.views-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.loading, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #888;
  text-align: center;
}

.empty-state p {
  margin-top: 12px;
  font-size: 12px;
}

/* Gallery mode */
.gallery-view {
  display: grid;
  grid-template-columns: repeat(3, 125px);
  gap: 10px;
  justify-content: center;
}

.view-card {
  width: 125px;
  min-width: 125px;
  max-width: 125px;
  background: #252526;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
}

.view-card:hover {
  border-color: #555;
}

.view-card.active {
  border-color: #38ABDF;
  box-shadow: 0 0 0 1px #38ABDF;
}

.card-thumbnail {
  aspect-ratio: 4/3;
  background: #1a1a1a;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-thumbnail {
  color: #444;
}

/* Default view badge - Home icon overlay */
.card-thumbnail {
  position: relative;
}

.default-view-badge {
  position: absolute;
  bottom: 6px;
  right: 6px;
  width: 28px;
  height: 28px;
  background: rgba(56, 171, 223, 0.85);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.default-view-badge svg {
  width: 16px;
  height: 16px;
}

/* List mode default icon */
.item-name-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.default-icon {
  color: #38ABDF;
  flex-shrink: 0;
}

.card-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  background: #252526;
}

.card-name {
  font-size: 11px;
  color: #ccc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.btn-menu {
  background: none;
  border: none;
  color: #888;
  padding: 2px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}

.view-card:hover .btn-menu,
.view-item:hover .btn-menu {
  opacity: 1;
}

.btn-menu:hover {
  color: #fff;
}

/* List mode */
.list-view {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.view-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #252526;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.view-item:hover {
  background: #2d2d2d;
}

.view-item.active {
  border-color: #38ABDF;
}

.item-name {
  font-size: 12px;
  color: #ccc;
}

/* Context menu */
.context-menu {
  position: fixed;
  background: #2d2d2d;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  padding: 4px 0;
  min-width: 120px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  z-index: 200;
}

.menu-item {
  padding: 8px 12px;
  font-size: 12px;
  color: #ccc;
  cursor: pointer;
}

.menu-item:hover {
  background: #3e3e42;
  color: #fff;
}

.menu-item.danger {
  color: #f44336;
}

.menu-item.danger:hover {
  background: #f44336;
  color: #fff;
}

/* Dialog */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}

.dialog {
  background: #2d2d2d;
  border: 1px solid #3e3e42;
  border-radius: 6px;
  width: 300px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #3e3e42;
}

.dialog-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #fff;
}

.btn-close-dialog {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 4px;
}

.btn-close-dialog:hover {
  color: #fff;
}

.dialog-body {
  padding: 16px;
}

.dialog-body input {
  width: 100%;
  background: #1e1e1e;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 13px;
  color: #fff;
  outline: none;
}

.dialog-body input:focus {
  border-color: #38ABDF;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #3e3e42;
}

.btn-cancel, .btn-confirm {
  padding: 6px 16px;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
}

.btn-cancel {
  background: transparent;
  border: 1px solid #3e3e42;
  color: #ccc;
}

.btn-cancel:hover {
  border-color: #555;
  color: #fff;
}

.btn-confirm {
  background: #38ABDF;
  border: none;
  color: #fff;
  font-weight: 500;
}

.btn-confirm:hover {
  background: #26C6DA;
}

.btn-confirm:disabled {
  background: #3e3e42;
  color: #666;
  cursor: not-allowed;
}

.btn-confirm.btn-danger {
  background: #dc3545;
}

.btn-confirm.btn-danger:hover {
  background: #c82333;
}

.delete-message {
  color: #ccc;
  font-size: 13px;
  margin: 0;
  line-height: 1.5;
}

.delete-dialog {
  min-width: 280px;
}
</style>
