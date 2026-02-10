<template>
  <div class="document-manager">
    <!-- 左侧文件夹树 -->
    <div class="folder-sidebar">
      <div class="sidebar-header">
        <span class="title">{{ t('documents.folders') }}</span>
        <el-button :icon="Plus" size="small" type="primary" text class="action-btn" @click="openFolderDialog">
          {{ t('documents.createFolder') }}
        </el-button>
      </div>
      <el-tree
        ref="folderTreeRef"
        :data="folderTreeData"
        :props="{ label: 'name', children: 'children' }"
        node-key="id"
        :current-node-key="currentFolderId"
        :expand-on-click-node="false"
        highlight-current
        default-expand-all
        @node-click="handleFolderClick"
      >
        <template #default="{ node, data }">
          <span class="folder-node">
            <el-icon class="folder-icon-filled"><Folder /></el-icon>
            <span>{{ data.name }}</span>
            <span v-if="data.document_count" class="folder-count">{{ data.document_count }}</span>
          </span>
        </template>
      </el-tree>
    </div>

    <!-- 右侧文档列表 -->
    <div class="document-list-area">
      <!-- 工具栏 -->
      <div class="toolbar">
        <div class="toolbar-left">
          <span class="title">{{ t('documents.title') }}</span>
          <!-- 选中工具栏 -->
          <template v-if="selectedIds.length > 0">
            <el-divider direction="vertical" />
            <span class="selection-count">{{ t('documents.selectedCount', { count: selectedIds.length }) }}</span>
            <el-button :icon="CollectionTag" size="small" text class="action-btn" style="margin-left: 16px;" @click="openBatchTagDialog">
              {{ t('documents.tags') }}
            </el-button>
            <el-button :icon="FolderOpened" size="small" text class="action-btn" @click="openMoveDialog">
              {{ t('documents.moveTo') }}
            </el-button>
            <el-button :icon="Delete" size="small" type="danger" text class="action-btn-danger" @click="handleBatchDelete">
              {{ t('documents.delete') }}
            </el-button>
          </template>
        </div>
        <div class="toolbar-right">
          <!-- 已选中的标签展示 -->
          <div class="selected-tags" v-if="filterTagIds.length > 0">
            <el-tag 
              v-for="tagId in filterTagIds" 
              :key="tagId" 
              size="small"
              closable
              :style="{ backgroundColor: tags.find(t => t.id === tagId)?.color, borderColor: tags.find(t => t.id === tagId)?.color }"
              @close="removeFilterTag(tagId)"
            >
              {{ tags.find(t => t.id === tagId)?.name }}
            </el-tag>
          </div>
          <!-- 标签筛选 -->
          <el-dropdown trigger="click" :hide-on-click="false" @command="handleTagFilter">
            <el-button size="small" text class="action-btn">
              <el-icon><CollectionTag /></el-icon>
              {{ t('documents.tags') }}
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item 
                  :command="'clear'" 
                  :disabled="filterTagIds.length === 0"
                >
                  {{ t('documents.clearFilter') }}
                </el-dropdown-item>
                <el-dropdown-item divided disabled v-if="tags.length === 0">
                  {{ t('documents.noTags') }}
                </el-dropdown-item>
                <el-dropdown-item 
                  v-for="tag in tags" 
                  :key="tag.id" 
                  :command="tag.id"
                  :class="{ 'is-active': filterTagIds.includes(tag.id) }"
                >
                  <el-checkbox :model-value="filterTagIds.includes(tag.id)" style="pointer-events: none; margin-right: 8px;" />
                  <span class="tag-dot" :style="{ backgroundColor: tag.color }"></span>
                  {{ tag.name }}
                  <span class="tag-count">({{ tag.document_count || 0 }})</span>
                </el-dropdown-item>
                <el-dropdown-item divided @click.stop="openTagManageDialog">
                  <el-icon><Edit /></el-icon>
                  {{ t('documents.manageTag') }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-input
            v-model="searchText"
            :placeholder="t('common.search')"
            :prefix-icon="Search"
            size="small"
            clearable
            style="width: 200px"
            autocomplete="off"
            name="document-search"
          />
          <el-button-group class="view-toggle">
            <el-button :type="viewMode === 'list' ? 'primary' : ''" size="small" :title="t('documents.listView')" @click="viewMode = 'list'">
              <el-icon><List /></el-icon>
            </el-button>
            <el-button :type="viewMode === 'grid' ? 'primary' : ''" size="small" :title="t('documents.gridView')" @click="viewMode = 'grid'">
              <el-icon><Grid /></el-icon>
            </el-button>
          </el-button-group>
          <el-button :icon="Upload" size="small" text class="action-btn" @click="openUploadDialog">
            {{ t('documents.upload') }}
          </el-button>
        </div>
      </div>

      <!-- 内容区域 -->
      <div ref="contentRef" class="content-area" @scroll="handleScroll">
        <!-- 列表视图 -->
        <el-table
          ref="tableRef"
          :key="tableKey"
          v-if="viewMode === 'list'"
          v-loading="isLoading"
          :data="combinedItems"
          :row-key="row => row.id"
          :default-sort="{ prop: sortBy, order: sortOrder }"
          highlight-current-row
          @sort-change="handleSortChange"
          @row-click="handleRowClick"
          @row-dblclick="handleRowDblClick"
          @selection-change="handleSelectionChange"
          :row-class-name="getRowClassName"
        >
          <template #empty>
            <div class="empty-state">
              <el-icon :size="48" color="var(--md-sys-color-outline)"><FolderOpened /></el-icon>
            </div>
          </template>
          <el-table-column type="selection" width="40" />
          <el-table-column prop="file_name" :label="t('documents.fileName')" sortable="custom" min-width="200">
            <template #default="{ row }">
              <div class="file-name-cell">
                <el-icon v-if="row._isFolder" class="folder-icon-filled"><Folder /></el-icon>
                <el-icon v-else :style="{ color: getFileIconColor(row.file_type) }">
                  <component :is="getFileIconComponent(row.file_type)" />
                </el-icon>
                <span>{{ row._isFolder ? row.name : (row.title || row.file_name) }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="file_type" :label="t('documents.fileType')" sortable="custom" width="100">
            <template #default="{ row }">
              <el-tag v-if="row._isFolder" size="small" type="warning">{{ t('documents.folder') }}</el-tag>
              <el-tag v-else size="small" type="info">{{ row.file_type?.toUpperCase() }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="tags" :label="t('documents.tags')" width="180">
            <template #default="{ row }">
              <template v-if="!row._isFolder && row.tags?.length > 0">
                <el-tag 
                  v-for="tag in row.tags.slice(0, 2)" 
                  :key="tag.id" 
                  size="small" 
                  :style="{ backgroundColor: tag.color, borderColor: tag.color, color: '#fff', marginRight: '4px' }"
                >
                  {{ tag.name }}
                </el-tag>
                <el-tag v-if="row.tags.length > 2" size="small" type="info">+{{ row.tags.length - 2 }}</el-tag>
              </template>
              <span v-else-if="!row._isFolder" class="no-tags">--</span>
            </template>
          </el-table-column>
          <el-table-column prop="file_size" :label="t('documents.fileSize')" sortable="custom" width="120">
            <template #default="{ row }">{{ formatFileSize(row.file_size) }}</template>
          </el-table-column>
          <el-table-column prop="created_at" :label="t('documents.createdAt')" sortable="custom" width="150">
            <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
          </el-table-column>
          <el-table-column width="60" fixed="right">
            <template #default="{ row }">
              <el-dropdown trigger="click" @command="cmd => handleCommand(cmd, row)">
                <el-button :icon="MoreFilled" size="small" text />
                <template #dropdown>
                  <el-dropdown-menu>
                    <template v-if="row._isFolder">
                      <el-dropdown-item command="enterFolder"><el-icon><FolderOpened /></el-icon>{{ t('documents.open') }}</el-dropdown-item>
                      <el-dropdown-item command="rename"><el-icon><Edit /></el-icon>{{ t('documents.rename') }}</el-dropdown-item>
                      <el-dropdown-item command="move"><el-icon><FolderOpened /></el-icon>{{ t('documents.moveTo') }}</el-dropdown-item>
                      <el-dropdown-item divided command="deleteFolder" style="color: var(--el-color-danger)">
                        <el-icon><Delete /></el-icon>{{ t('documents.delete') }}
                      </el-dropdown-item>
                    </template>
                    <template v-else>
                      <el-dropdown-item command="preview"><el-icon><View /></el-icon>{{ t('documents.preview') }}</el-dropdown-item>
                      <el-dropdown-item command="download"><el-icon><Download /></el-icon>{{ t('documents.download') }}</el-dropdown-item>
                      <el-dropdown-item command="rename"><el-icon><Edit /></el-icon>{{ t('documents.rename') }}</el-dropdown-item>
                      <el-dropdown-item command="move"><el-icon><FolderOpened /></el-icon>{{ t('documents.moveTo') }}</el-dropdown-item>
                      <el-dropdown-item command="tags"><el-icon><CollectionTag /></el-icon>{{ t('documents.tags') }}</el-dropdown-item>
                      <el-dropdown-item divided command="delete" style="color: var(--el-color-danger)">
                        <el-icon><Delete /></el-icon>{{ t('documents.delete') }}
                      </el-dropdown-item>
                    </template>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </template>
          </el-table-column>
        </el-table>

        <!-- 网格视图 -->
        <div v-else-if="viewMode === 'grid'" class="grid-view">
          <div v-if="isLoading && documents.length === 0" class="loading-state">
            <el-icon class="is-loading"><Loading /></el-icon>
          </div>
          <template v-else-if="filteredDocuments.length > 0">
            <div
              v-for="doc in filteredDocuments"
              :key="doc.id"
              class="grid-card"
              :class="{ selected: selectedIds.includes(doc.id) }"
              @click="handleCardClick($event, doc)"
              @dblclick="handlePreview(doc)"
            >
              <el-dropdown class="card-menu" trigger="click" @command="cmd => handleCommand(cmd, doc)">
                <el-button :icon="MoreFilled" size="small" text />
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="preview"><el-icon><View /></el-icon>{{ t('documents.preview') }}</el-dropdown-item>
                    <el-dropdown-item command="download"><el-icon><Download /></el-icon>{{ t('documents.download') }}</el-dropdown-item>
                    <el-dropdown-item command="rename"><el-icon><Edit /></el-icon>{{ t('documents.rename') }}</el-dropdown-item>
                    <el-dropdown-item command="move"><el-icon><FolderOpened /></el-icon>{{ t('documents.moveTo') }}</el-dropdown-item>
                    <el-dropdown-item command="tags"><el-icon><CollectionTag /></el-icon>{{ t('documents.tags') }}</el-dropdown-item>
                    <el-dropdown-item divided command="delete" style="color: var(--el-color-danger)">
                      <el-icon><Delete /></el-icon>{{ t('documents.delete') }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <div class="card-thumbnail">
                <img v-if="isImageType(doc.file_type)" :src="getThumbnailUrl(doc)" :alt="doc.file_name" />
                <el-icon v-else :style="{ color: getFileIconColor(doc.file_type) }" class="file-icon-large">
                  <component :is="getFileIconComponent(doc.file_type)" />
                </el-icon>
              </div>
              <div class="card-info">
                <el-icon :style="{ color: getFileIconColor(doc.file_type) }" class="file-icon-small">
                  <component :is="getFileIconComponent(doc.file_type)" />
                </el-icon>
                <span class="card-name" :title="doc.title || doc.file_name">{{ doc.title || doc.file_name }}</span>
              </div>
              <div v-if="doc.tags?.length > 0" class="card-tags">
                <span 
                  v-for="tag in doc.tags.slice(0, 3)" 
                  :key="tag.id" 
                  class="card-tag"
                  :style="{ backgroundColor: tag.color }"
                  :title="tag.name"
                >
                  {{ tag.name }}
                </span>
                <span v-if="doc.tags.length > 3" class="card-tag-more">+{{ doc.tags.length - 3 }}</span>
              </div>
            </div>
          </template>
          <el-empty v-else :description="t('documents.noDocuments')" />
        </div>

        <!-- 加载更多 -->
        <div v-if="hasMore && !isLoading" class="load-more">
          <el-button v-if="isLoadingMore" loading size="small">{{ t('common.loading') }}</el-button>
          <span v-else class="load-hint">{{ t('documents.scrollToLoadMore', { loaded: documents.length, total: totalCount }) }}</span>
        </div>
      </div>
    </div>

    <!-- 上传对话框 -->
    <el-dialog 
      v-model="isUploadDialogOpen" 
      :title="t('documents.upload')" 
      width="480px"
      class="custom-upload-dialog"
      :close-on-click-modal="false"
    >
      <div class="upload-dialog-body">
        <el-upload
          ref="uploadRef"
          drag
          multiple
          :auto-upload="false"
          :on-change="handleUploadChange"
          :on-remove="handleUploadChange"
          :file-list="uploadForm.files"
          class="custom-upload-dragger"
        >
          <el-icon class="el-icon--upload"><Upload /></el-icon>
          <div class="el-upload__text">{{ t('documents.dropHint') }}</div>
        </el-upload>
        
        <div v-if="uploadProgress > 0" class="upload-progress-bar">
          <el-progress :percentage="uploadProgress" :status="uploadProgress === 100 ? 'success' : ''" />
        </div>
      </div>
      <template #footer>
        <el-button @click="isUploadDialogOpen = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="isUploading" :disabled="uploadForm.files.length === 0" @click="uploadFiles">
          {{ t('documents.upload') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 新建文件夹对话框 -->
    <el-dialog v-model="isFolderDialogOpen" :title="t('documents.newFolder')" width="400px">
      <el-form>
        <el-form-item :label="t('documents.folderName')">
          <el-input v-model="newFolderName" :placeholder="t('documents.folderNamePlaceholder')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="isFolderDialogOpen = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :disabled="!newFolderName" @click="confirmCreateFolder">{{ t('common.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- 移动对话框 -->
    <el-dialog v-model="isMoveDialogOpen" :title="t('documents.moveTo')" width="400px">
      <el-tree
        ref="moveTreeRef"
        :data="folderTreeData"
        :props="{ label: 'name', children: 'children' }"
        node-key="id"
        highlight-current
        default-expand-all
        @node-click="handleMoveTargetSelect"
      >
        <template #default="{ data }">
          <span class="folder-node">
            <el-icon><Folder /></el-icon>
            <span>{{ data.name }}</span>
          </span>
        </template>
      </el-tree>
      <template #footer>
        <el-button @click="isMoveDialogOpen = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :disabled="moveTargetFolderId === undefined" @click="confirmMove">
          {{ t('documents.moveTo') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 重命名对话框 -->
    <el-dialog v-model="isRenameDialogOpen" :title="t('documents.rename')" width="400px">
      <el-form @submit.prevent="confirmRename">
        <el-form-item :label="t('documents.name')">
          <el-input 
            v-model="renameForm.name" 
            :placeholder="t('documents.renamePlaceholder')" 
            ref="renameInputRef"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="isRenameDialogOpen = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :disabled="!renameForm.name" @click="confirmRename">{{ t('common.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- 文档标签对话框 -->
    <el-dialog v-model="isTagDialogOpen" :title="t('documents.tags')" width="400px">
      <div class="tag-select-list">
        <el-checkbox-group v-model="selectedTagIds">
          <div v-for="tag in tags" :key="tag.id" class="tag-select-item">
            <el-checkbox :label="tag.id">
              <span class="tag-dot" :style="{ backgroundColor: tag.color }"></span>
              {{ tag.name }}
            </el-checkbox>
          </div>
        </el-checkbox-group>
        <el-empty v-if="tags.length === 0" :description="t('documents.noTags')" :image-size="60" />
      </div>
      <template #footer>
        <el-button @click="isTagDialogOpen = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="saveDocumentTags">{{ t('common.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- 批量标签对话框 -->
    <el-dialog v-model="isBatchTagDialogOpen" :title="t('documents.batchTagTitle', { count: selectedIds.length })" width="400px">
      <div class="tag-select-list">
        <el-checkbox-group v-model="batchSelectedTagIds">
          <div v-for="tag in tags" :key="tag.id" class="tag-select-item">
            <el-checkbox :label="tag.id">
              <span class="tag-dot" :style="{ backgroundColor: tag.color }"></span>
              {{ tag.name }}
            </el-checkbox>
          </div>
        </el-checkbox-group>
        <el-empty v-if="tags.length === 0" :description="t('documents.noTags')" :image-size="60" />
      </div>
      <template #footer>
        <el-button @click="isBatchTagDialogOpen = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="saveBatchTags">{{ t('common.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- 标签管理对话框 -->
    <el-dialog v-model="isTagManageDialogOpen" :title="t('documents.manageTag')" width="500px">
      <div class="tag-manage-form">
        <el-form :model="tagForm" label-width="80px" size="small">
          <el-form-item :label="t('documents.tagName')">
            <el-input v-model="tagForm.name" :placeholder="t('documents.tagNamePlaceholder')" />
          </el-form-item>
          <el-form-item :label="t('documents.tagColor')">
            <el-color-picker v-model="tagForm.color" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :disabled="!tagForm.name" @click="saveTag">
              {{ tagForm.id ? t('common.save') : t('documents.createTag') }}
            </el-button>
            <el-button v-if="tagForm.id" @click="tagForm = { id: null, name: '', color: '#409EFF', description: '' }">
              {{ t('common.cancel') }}
            </el-button>
          </el-form-item>
        </el-form>
      </div>
      <el-divider />
      <div class="tag-list">
        <div v-for="tag in tags" :key="tag.id" class="tag-list-item">
          <span class="tag-info">
            <span class="tag-dot" :style="{ backgroundColor: tag.color }"></span>
            <span class="tag-name">{{ tag.name }}</span>
            <span class="tag-count">({{ tag.document_count || 0 }})</span>
          </span>
          <span class="tag-actions">
            <el-button size="small" text @click="editTag(tag)">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button size="small" text type="danger" @click="deleteTag(tag)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </span>
        </div>
        <el-empty v-if="tags.length === 0" :description="t('documents.noTags')" :image-size="60" />
      </div>
      <template #footer>
        <div class="tag-dialog-footer">
          <el-button :disabled="tags.length === 0" @click="autoAssignColors">
            {{ t('documents.autoAssignColors') }}
          </el-button>
          <el-button @click="isTagManageDialogOpen = false">{{ t('common.close') }}</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 文档预览 -->
    <DocumentPreview
      :visible="isPreviewOpen"
      :document="previewDocument"
      @close="isPreviewOpen = false"
    />

    <!-- 智能关联对话框 -->
    <DocumentAssociationDialog
      v-model:visible="isAssociationDialogOpen"
      :files="associationFiles"
      :folder-id="currentFolderId"
      @success="handleAssociationSuccess"
      @skip="handleAssociationSkip"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Plus, Folder, FolderOpened, Search, List, Grid, Upload, Download,
  Delete, View, MoreFilled, Loading, Document, Picture, VideoPlay, Headset, Edit, CollectionTag
} from '@element-plus/icons-vue';
import DocumentPreview from './DocumentPreview.vue';
import DocumentAssociationDialog from './DocumentAssociationDialog.vue';

const { t } = useI18n();
const authStore = useAuthStore();
const themeStore = useThemeStore();
const tableKey = ref(0);

// 监听主题变化，强制刷新表格
watch(() => themeStore.isDark, () => {
  tableKey.value++;
});

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

// Headers
const getHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  if (authStore.token) headers['Authorization'] = `Bearer ${authStore.token}`;
  return headers;
};

// ========================================
// 状态
// ========================================
const documents = ref([]);
const subfolders = ref([]);
const folders = ref([]);
const isLoading = ref(true);
const isLoadingMore = ref(false);
const searchText = ref('');
const viewMode = ref('list');
const currentFolderId = ref('root');
const selectedIds = ref([]);

// 分页
const currentPage = ref(1);
const pageSize = 50;
const hasMore = ref(true);
const totalCount = ref(0);
const contentRef = ref(null);

// 排序
const sortBy = ref('created_at');
const sortOrder = ref('descending');

// 对话框
const isUploadDialogOpen = ref(false);
const isFolderDialogOpen = ref(false);
const isMoveDialogOpen = ref(false);
const isPreviewOpen = ref(false);
const previewDocument = ref(null);

// 上传
const uploadRef = ref(null);
const isUploading = ref(false);
const uploadProgress = ref(0);
const uploadForm = ref({ title: '', folderId: null, files: [] });

// 智能关联对话框
const isAssociationDialogOpen = ref(false);
const associationFiles = ref([]);

// 文件夹
const newFolderName = ref('');
const folderTreeRef = ref(null);
const tableRef = ref(null);

// 移动
const moveTargetFolderId = ref(undefined);
const moveTreeRef = ref(null);
const itemsToMove = ref([]);

// 重命名
const isRenameDialogOpen = ref(false);
const renameForm = ref({ id: null, name: '', type: 'file' });
const renameInputRef = ref(null);

// 标签
const tags = ref([]);
const filterTagIds = ref([]);  // 标签筛选（多选）
const isTagDialogOpen = ref(false);
const isTagManageDialogOpen = ref(false);
const tagForm = ref({ id: null, name: '', color: '#409EFF', description: '' });
const documentForTagging = ref(null);
const selectedTagIds = ref([]);  // 单文档标签编辑用
const isBatchTagDialogOpen = ref(false);
const batchSelectedTagIds = ref([]);

// ========================================
// 计算属性
// ========================================
const folderTreeData = computed(() => {
  return [
    { id: 'root', name: t('documents.rootDirectory'), children: buildFolderTree(folders.value) }
  ];
});

const filteredDocuments = computed(() => {
  let result = documents.value;
  if (searchText.value) {
    const s = searchText.value.toLowerCase();
    result = result.filter(d => 
      (d.title || '').toLowerCase().includes(s) ||
      (d.file_name || '').toLowerCase().includes(s)
    );
  }
  return result;
});

// 合并文件夹和文件(文件夹排前面)
const combinedItems = computed(() => {
  const folderItems = subfolders.value.map(f => ({
    ...f,
    _isFolder: true,
    file_type: 'folder'
  }));
  const docItems = filteredDocuments.value.map(d => ({
    ...d,
    _isFolder: false
  }));
  return [...folderItems, ...docItems];
});

// ========================================
// 方法
// ========================================
const buildFolderTree = (list, parentId = null) => {
  return list
    .filter(f => f.parent_id === parentId)
    .map(f => ({ ...f, children: buildFolderTree(list, f.id) }));
};

const loadDocuments = async (append = false) => {
  console.log('[loadDocuments] Called with append:', append, 'currentFolderId:', currentFolderId.value);
  
  if (append) {
    if (!hasMore.value || isLoadingMore.value) {
      console.log('[loadDocuments] Skipping append - hasMore:', hasMore.value, 'isLoadingMore:', isLoadingMore.value);
      return;
    }
    isLoadingMore.value = true;
  } else {
    isLoading.value = true;
    currentPage.value = 1;
    documents.value = [];
    hasMore.value = true;
  }
  
  try {
    const params = new URLSearchParams();
    if (currentFolderId.value) params.set('folderId', currentFolderId.value);
    // 多标签筛选
    if (filterTagIds.value.length > 0) {
      params.set('tagIds', filterTagIds.value.join(','));
    }
    params.set('page', currentPage.value.toString());
    params.set('pageSize', pageSize.toString());
    
    console.log('[loadDocuments] Fetching with params:', params.toString());
    const res = await fetch(`${API_BASE}/api/v2/documents?${params}`, { headers: getHeaders() });
    const data = await res.json();
    console.log('[loadDocuments] Response:', { success: data.success, docsCount: data.data?.length, subfoldersCount: data.subfolders?.length });
    
    if (data.success) {
      const newDocs = data.data || [];
      if (append) {
        // 去重：只添加不存在的文档
        const existingIds = new Set(documents.value.map(d => d.id));
        const uniqueNewDocs = newDocs.filter(d => !existingIds.has(d.id));
        documents.value = [...documents.value, ...uniqueNewDocs];
      } else {
        documents.value = newDocs;
      }
      // 保存子文件夹
      if (!append) {
        subfolders.value = data.subfolders || [];
      }
      totalCount.value = data.pagination?.total || 0;
      hasMore.value = newDocs.length >= pageSize;
      currentPage.value++;
      console.log('[loadDocuments] Updated - documents:', documents.value.length, 'subfolders:', subfolders.value.length);
    }
  } catch (e) {
    console.error('加载文档失败:', e);
  } finally {
    isLoading.value = false;
    isLoadingMore.value = false;
  }
};

const loadFolders = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/v2/documents/folders/tree`, { headers: getHeaders() });
    const data = await res.json();
    if (data.success) {
      folders.value = flattenTree(data.data);
    }
  } catch (e) {
    console.error('加载文件夹失败:', e);
  }
};

const flattenTree = (tree, level = 1, result = []) => {
  for (const item of tree) {
    result.push({ ...item, level });
    if (item.children?.length) flattenTree(item.children, level + 1, result);
  }
  return result;
};

const handleFolderClick = (data) => {
  // 点击文件夹时清除标签筛选，恢复文件夹层级模式
  if (filterTagIds.value.length > 0) {
    filterTagIds.value = [];
  }
  currentFolderId.value = data.id;
  loadDocuments();
};

const handleScroll = (e) => {
  const el = e.target;
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
    loadDocuments(true);
  }
};

// 排序
const handleSortChange = ({ prop, order }) => {
  sortBy.value = prop;
  sortOrder.value = order;
  // 前端排序(数据量小时)或重新请求后端
  documents.value = [...documents.value].sort((a, b) => {
    const aVal = a[prop] || '';
    const bVal = b[prop] || '';
    const cmp = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    return order === 'ascending' ? cmp : -cmp;
  });
};

// 行样式类名 - 用于复选框选中行的高亮
const getRowClassName = ({ row }) => {
  return selectedIds.value.includes(row.id) ? 'selected-row' : '';
};

// 选择
const handleRowClick = (row, column, event) => {
  // 跳过checkbox列的点击
  if (column?.type === 'selection') return;
  
  if (event.ctrlKey || event.metaKey) {
    // Ctrl+点击: 切换选中状态
    tableRef.value?.toggleRowSelection(row);
  } else {
    // 普通点击: 清除其他选中,只选中当前行
    tableRef.value?.clearSelection();
    tableRef.value?.toggleRowSelection(row, true);
  }
};

const handleRowDblClick = (row) => {
  if (row._isFolder) {
    // 双击文件夹:进入该文件夹
    enterFolder(row);
  } else {
    // 双击文件:预览
    handlePreview(row);
  }
};

const handleSelectionChange = (selection) => {
  selectedIds.value = selection.map(r => r.id);
};

const handleCardClick = (e, doc) => {
  if (e.ctrlKey || e.metaKey) {
    toggleSelection(doc.id);
  } else {
    selectedIds.value = [doc.id];
  }
};

const toggleSelection = (id) => {
  const idx = selectedIds.value.indexOf(id);
  if (idx >= 0) {
    selectedIds.value.splice(idx, 1);
  } else {
    selectedIds.value.push(id);
  }
};

// 命令处理
const handleCommand = (cmd, item) => {
  switch (cmd) {
    case 'preview': handlePreview(item); break;
    case 'download': handleDownload(item); break;
    case 'move': openMoveDialogForDoc(item); break;
    case 'delete': handleDelete(item); break;
    case 'enterFolder': enterFolder(item); break;
    case 'deleteFolder': handleDeleteFolder(item); break;
    case 'rename': openRenameDialog(item); break;
    case 'tags': openTagDialog(item); break;
  }
};

// 进入文件夹
const enterFolder = (folder) => {
  currentFolderId.value = folder.id;
  loadDocuments();
};

const handlePreview = (doc) => {
  previewDocument.value = doc;
  isPreviewOpen.value = true;
};

const handleDownload = (doc) => {
  window.open(`${API_BASE}/api/documents/${doc.id}/download`, '_blank');
};

const handleDelete = async (doc) => {
  try {
    await ElMessageBox.confirm(
      t('documents.confirmDelete', { title: doc.title || doc.file_name }), 
      t('common.confirm'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    );
    const res = await fetch(`${API_BASE}/api/v2/documents/${doc.id}`, { method: 'DELETE', headers: getHeaders() });
    const data = await res.json();
    if (data.success) {
      ElMessage.success(t('common.success'));
      loadDocuments();
    }
  } catch (e) {
    if (e !== 'cancel') console.error(e);
  }
};

const handleBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(
      t('documents.confirmBatchDelete', { count: selectedIds.value.length }), 
      t('common.confirm'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    );
    for (const id of selectedIds.value) {
      await fetch(`${API_BASE}/api/v2/documents/${id}`, { method: 'DELETE', headers: getHeaders() });
    }
    ElMessage.success(t('common.success'));
    selectedIds.value = [];
    loadDocuments();
  } catch (e) {
    if (e !== 'cancel') console.error(e);
  }
};

// 删除文件夹
const handleDeleteFolder = async (folder) => {
  try {
    await ElMessageBox.confirm(
      t('documents.confirmDeleteFolder', { name: folder.name }), 
      t('common.confirm'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    );
    const res = await fetch(`${API_BASE}/api/v2/documents/folders/${folder.id}`, { method: 'DELETE', headers: getHeaders() });
    const data = await res.json();
    if (data.success) {
      ElMessage.success(t('common.success'));
      loadDocuments();
      loadFolders();
    }
  } catch (e) {
    if (e !== 'cancel') console.error(e);
  }
};

// 移动
const openMoveDialog = () => {
  // 从 combinedItems 中查找选中项的完整信息（包括 _isFolder）
  const selectedItems = selectedIds.value.map(id => {
    const item = combinedItems.value.find(i => i.id === id);
    if (item) {
      // 使用多重检测判断是否为文件夹
      const isFolder = item._isFolder === true || 
                       item.file_type === 'folder' || 
                       (item.name !== undefined && item.file_path === undefined);
      return { id, _isFolder: isFolder };
    }
    // 如果找不到，默认当作文档处理
    return { id, _isFolder: false };
  });
  console.log('[openMoveDialog] selectedItems:', selectedItems);
  itemsToMove.value = selectedItems;
  moveTargetFolderId.value = undefined;
  isMoveDialogOpen.value = true;
};

const openMoveDialogForDoc = (item) => {
  // 多重判断是否为文件夹:
  // 1. _isFolder 属性为 true
  // 2. file_type 为 'folder'
  // 3. 有 name 属性但没有 file_path 属性 (文件夹结构特征)
  const isFolder = item._isFolder === true || 
                   item.file_type === 'folder' || 
                   (item.name !== undefined && item.file_path === undefined);
  console.log('[openMoveDialogForDoc] Full item:', JSON.stringify(item));
  console.log('[openMoveDialogForDoc] Detection - _isFolder:', item._isFolder, 'file_type:', item.file_type, 'name:', item.name, 'file_path:', item.file_path);
  console.log('[openMoveDialogForDoc] Detected as folder:', isFolder);
  itemsToMove.value = [{ id: item.id, _isFolder: isFolder }];
  moveTargetFolderId.value = undefined;
  isMoveDialogOpen.value = true;
};

const handleMoveTargetSelect = (data) => {
  moveTargetFolderId.value = data.id;
};

const confirmMove = async () => {
  try {
    // 将 'root' 转换为 null，后端期望整数或 null
    const targetFolderId = moveTargetFolderId.value === 'root' ? null : moveTargetFolderId.value;
    
    console.log('[confirmMove] itemsToMove:', itemsToMove.value);
    console.log('[confirmMove] targetFolderId:', targetFolderId);
    
    for (const item of itemsToMove.value) {
      console.log('[confirmMove] Processing item:', item, 'isFolder:', item._isFolder);
      let res;
      if (item._isFolder) {
        // 移动文件夹
        res = await fetch(`${API_BASE}/api/v2/documents/folders/${item.id}`, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ parentId: targetFolderId })
        });
      } else {
        // 移动文档
        res = await fetch(`${API_BASE}/api/v2/documents/${item.id}`, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ folderId: targetFolderId })
        });
      }
      
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `移动失败: ${res.status}`);
      }
    }
    ElMessage.success(t('common.success'));
    isMoveDialogOpen.value = false;
    selectedIds.value = [];
    loadDocuments();
    loadFolders(); // 刷新左侧文件夹树
  } catch (e) {
    console.error('Move error:', e);
    ElMessage.error(e.message || t('common.error'));
  }
};

// 上传
const openUploadDialog = () => {
  uploadForm.value = { title: '', folderId: currentFolderId.value, files: [] };
  uploadProgress.value = 0;
  isUploadDialogOpen.value = true;
};

const handleUploadChange = (file, fileList) => {
  uploadForm.value.files = fileList;
};

const uploadFiles = async () => {
  if (uploadForm.value.files.length === 0) return;
  
  // 打开智能关联对话框
  associationFiles.value = uploadForm.value.files.map(f => ({
    name: f.name,
    raw: f.raw
  }));
  isUploadDialogOpen.value = false;
  isAssociationDialogOpen.value = true;
};

// 关联对话框 - 跳过关联直接上传
const handleAssociationSkip = async (files) => {
  isAssociationDialogOpen.value = false;
  await directUploadFiles(files);
};

// 关联对话框 - 上传成功
const handleAssociationSuccess = () => {
  isAssociationDialogOpen.value = false;
  ElMessage.success(t('common.success'));
  loadDocuments();
};

// 直接上传文件（不经过关联对话框）
const directUploadFiles = async (files) => {
  if (!files || files.length === 0) return;
  isUploading.value = true;
  uploadProgress.value = 0;
  
  try {
    const formData = new FormData();
    if (currentFolderId.value) formData.append('folderId', currentFolderId.value);
    
    for (const f of files) formData.append('files', f.raw || f);
    
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) uploadProgress.value = Math.round((e.loaded / e.total) * 100);
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        const result = JSON.parse(xhr.responseText);
        if (result.success) {
          ElMessage.success(t('common.success'));
          loadDocuments();
        }
      }
      isUploading.value = false;
    };
    xhr.onerror = () => { isUploading.value = false; };
    xhr.open('POST', `${API_BASE}/api/v2/documents/batch`);
    if (authStore.token) xhr.setRequestHeader('Authorization', `Bearer ${authStore.token}`);
    xhr.send(formData);
  } catch (e) {
    console.error(e);
    isUploading.value = false;
  }
};

// 文件夹
const openFolderDialog = () => {
  newFolderName.value = '';
  isFolderDialogOpen.value = true;
};

const confirmCreateFolder = async () => {
  if (!newFolderName.value) return;
  try {
    // 将 'root' 转换为 null，后端期望 parentId 是整数或 null
    const parentId = currentFolderId.value === 'root' ? null : currentFolderId.value;
    const res = await fetch(`${API_BASE}/api/v2/documents/folders`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name: newFolderName.value, parentId })
    });
    const data = await res.json();
    if (data.success) {
      ElMessage.success(t('common.success'));
      isFolderDialogOpen.value = false;
      loadFolders();
    }
  } catch (e) {
    console.error(e);
  }
};

// 重命名
const openRenameDialog = (item) => {
  renameForm.value = {
    id: item.id,
    name: item._isFolder ? item.name : (item.title || item.file_name),
    type: item._isFolder ? 'folder' : 'file'
  };
  isRenameDialogOpen.value = true;
  // 聚焦输入框
  setTimeout(() => {
    renameInputRef.value?.focus();
  }, 100);
};

const confirmRename = async () => {
  if (!renameForm.value.name) return;
  
  try {
    const { id, name, type } = renameForm.value;
    const url = type === 'folder' 
      ? `${API_BASE}/api/v2/documents/folders/${id}`
      : `${API_BASE}/api/v2/documents/${id}`;
      
    const body = type === 'folder' ? { name } : { title: name };

    const res = await fetch(url, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (data.success) {
      ElMessage.success(t('common.success'));
      isRenameDialogOpen.value = false;
      loadDocuments();
      if (type === 'folder') loadFolders();
    }
  } catch (e) {
    console.error(e);
  }
};

// 工具函数
const formatFileSize = (bytes) => {
  if (!bytes) return '--';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return bytes.toFixed(1) + ' ' + units[i];
};

const formatDate = (dateStr) => {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString();
};

const getFileIconColor = (type) => {
  const map = { pdf: '#e53935', doc: '#1565c0', docx: '#1565c0', xls: '#2e7d32', xlsx: '#2e7d32', jpg: '#ff7043', jpeg: '#ff7043', png: '#7e57c2', mp4: '#ab47bc' };
  return map[type?.toLowerCase()] || '#888';
};

const getFileIconComponent = (type) => {
  const t = type?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(t)) return Picture;
  if (['mp4', 'webm', 'ogg'].includes(t)) return VideoPlay;
  if (['mp3', 'wav', 'ogg'].includes(t)) return Headset;
  return Document;
};

const isImageType = (type) => ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(type?.toLowerCase());

const getThumbnailUrl = (doc) => {
  // 优先使用缩略图，如果没有则使用原图
  if (doc.thumbnail_path) {
    return `${API_BASE}${doc.thumbnail_path}`;
  }
  return `${API_BASE}${doc.file_path}`;
};

// ========================================
// 标签管理
// ========================================
const loadTags = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/v2/documents/tags/list`, { headers: getHeaders() });
    const data = await res.json();
    if (data.success) {
      tags.value = data.data || [];
    }
  } catch (e) {
    console.error('加载标签失败:', e);
  }
};

const handleTagFilter = (command) => {
  if (command === 'clear') {
    // 清除所有筛选
    filterTagIds.value = [];
  } else {
    // 切换标签选中状态
    const idx = filterTagIds.value.indexOf(command);
    if (idx === -1) {
      filterTagIds.value.push(command);
    } else {
      filterTagIds.value.splice(idx, 1);
    }
  }
  loadDocuments();
};

const removeFilterTag = (tagId) => {
  const idx = filterTagIds.value.indexOf(tagId);
  if (idx !== -1) {
    filterTagIds.value.splice(idx, 1);
    loadDocuments();
  }
};

const openTagDialog = (doc) => {
  documentForTagging.value = doc;
  selectedTagIds.value = (doc.tags || []).map(t => t.id);
  isTagDialogOpen.value = true;
};

const saveDocumentTags = async () => {
  if (!documentForTagging.value) return;
  
  try {
    const res = await fetch(`${API_BASE}/api/v2/documents/${documentForTagging.value.id}/tags`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ tagIds: selectedTagIds.value })
    });
    const data = await res.json();
    if (data.success) {
      ElMessage.success(t('common.success'));
      isTagDialogOpen.value = false;
      loadDocuments();
      loadTags(); // 刷新标签统计
    }
  } catch (e) {
    console.error(e);
  }
};

const openBatchTagDialog = () => {
  // 过滤掉文件夹，只保留文档
  const docs = selectedIds.value
    .map(id => combinedItems.value.find(i => i.id === id))
    .filter(item => item && !item._isFolder);
  
  if (docs.length === 0) {
    ElMessage.warning(t('documents.selectDocumentsOnly'));
    return;
  }
  
  // 如果只选中一个文档，预选其已有标签
  // 如果选中多个文档，显示它们共同拥有的标签（交集）
  if (docs.length === 1) {
    batchSelectedTagIds.value = (docs[0].tags || []).map(t => t.id);
  } else {
    // 计算所有选中文档标签的交集
    const tagSets = docs.map(doc => new Set((doc.tags || []).map(t => t.id)));
    const intersection = tagSets.reduce((acc, set) => 
      new Set([...acc].filter(id => set.has(id))), tagSets[0] || new Set());
    batchSelectedTagIds.value = [...intersection];
  }
  
  isBatchTagDialogOpen.value = true;
};

const saveBatchTags = async () => {
  // 过滤掉文件夹
  const docIds = selectedIds.value.filter(id => {
    const item = combinedItems.value.find(i => i.id === id);
    return item && !item._isFolder;
  });
  
  if (docIds.length === 0) return;
  
  try {
    const res = await fetch(`${API_BASE}/api/v2/documents/batch/tags`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ 
        documentIds: docIds, 
        tagIds: batchSelectedTagIds.value 
      })
    });
    const data = await res.json();
    if (data.success) {
      ElMessage.success(data.message || t('common.success'));
      isBatchTagDialogOpen.value = false;
      loadDocuments();
      loadTags();
    }
  } catch (e) {
    console.error(e);
  }
};

const openTagManageDialog = () => {
  tagForm.value = { id: null, name: '', color: '#409EFF', description: '' };
  isTagManageDialogOpen.value = true;
};

const editTag = (tag) => {
  tagForm.value = { ...tag };
};

const saveTag = async () => {
  if (!tagForm.value.name) return;
  
  try {
    const isEdit = !!tagForm.value.id;
    const url = isEdit 
      ? `${API_BASE}/api/v2/documents/tags/${tagForm.value.id}`
      : `${API_BASE}/api/v2/documents/tags`;
    
    const res = await fetch(url, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        name: tagForm.value.name,
        color: tagForm.value.color,
        description: tagForm.value.description
      })
    });
    const data = await res.json();
    if (data.success) {
      ElMessage.success(t('common.success'));
      tagForm.value = { id: null, name: '', color: '#409EFF', description: '' };
      loadTags();
    }
  } catch (e) {
    console.error(e);
  }
};

const deleteTag = async (tag) => {
  try {
    await ElMessageBox.confirm(
      t('documents.confirmDeleteTag', { name: tag.name }),
      t('common.confirm'),
      { type: 'warning' }
    );
    const res = await fetch(`${API_BASE}/api/v2/documents/tags/${tag.id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const data = await res.json();
    if (data.success) {
      ElMessage.success(t('common.success'));
      loadTags();
    }
  } catch (e) {
    if (e !== 'cancel') console.error(e);
  }
};

const autoAssignColors = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/v2/documents/tags/auto-color`, {
      method: 'POST',
      headers: getHeaders()
    });
    const data = await res.json();
    if (data.success) {
      ElMessage.success(data.message || t('common.success'));
      loadTags();
    }
  } catch (e) {
    console.error(e);
  }
};

// 初始化
onMounted(() => {
  loadDocuments();
  loadFolders();
  loadTags();
});
</script>

<style scoped>
.document-manager {
  display: flex;
  height: 100%;
  width: 100%;
  background: var(--md-sys-color-surface);
  font-size: 11px;
}

/* 左侧文件夹树 */
.folder-sidebar {
  width: 240px;
  border-right: 1px solid var(--md-sys-color-outline-variant);
  display: flex;
  flex-direction: column;
  background: var(--list-bg);
}

.sidebar-header {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.title {
  font-size: 11px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  text-transform: uppercase;
}

/* 树节点样式重写 */
:deep(.el-tree) {
  background: transparent;
  color: var(--list-item-text);
  font-size: 12px;
}

:deep(.el-tree-node__content) {
  height: 32px;
}

:deep(.el-tree-node__content:hover) {
  background-color: var(--list-item-bg-hover);
}

:deep(.el-tree-node.is-current > .el-tree-node__content) {
  background-color: #2a2d2e;
  color: #38ABDF;
}

.sidebar-header .title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--el-text-color-secondary);
}

.folder-node {
  display: flex;
  align-items: center;
  gap: 6px;
}

.folder-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

/* 实心文件夹图标 */
.folder-icon-filled {
  color: #f0b429;
  font-size: 16px;
}

.folder-icon-filled svg {
  fill: currentColor;
}

/* 文档列表区域 */
.document-list-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background: var(--md-sys-color-surface);
}

.toolbar {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  flex-shrink: 0;
}

/* 覆盖表格样式 */
:deep(.el-table) {
  --el-table-bg-color: var(--md-sys-color-surface);
  --el-table-tr-bg-color: var(--md-sys-color-surface);
  --el-table-header-bg-color: var(--md-sys-color-surface-container-low);
  --el-table-border-color: var(--md-sys-color-outline-variant);
  --el-table-text-color: var(--md-sys-color-on-surface);
  --el-table-header-text-color: var(--md-sys-color-on-surface);
  --el-table-row-hover-bg-color: var(--md-sys-color-surface-container-high);
}

:deep(.el-table th.el-table__cell) {
  background-color: var(--md-sys-color-surface-container-low);
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  font-size: 11px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  height: 32px;
  padding: 0;
}

:deep(.el-table td.el-table__cell) {
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  font-size: 12px;
  padding: 4px 0;
}

:deep(.el-table__inner-wrapper::before) {
  background-color: var(--md-sys-color-outline-variant);
}

/* 强制覆盖 Element Plus Checkbox 样式 */
:deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background-color: #38ABDF !important;
  border-color: #38ABDF !important;
}

:deep(.el-checkbox__input.is-indeterminate .el-checkbox__inner) {
  background-color: #38ABDF !important;
  border-color: #38ABDF !important;
}

:deep(.el-checkbox__inner:hover) {
  border-color: #38ABDF;
}

:deep(.el-checkbox__input.is-focus .el-checkbox__inner) {
  border-color: #38ABDF;
}

.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 选中的筛选标签 */
.selected-tags {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.selected-tags .el-tag {
  color: #fff;
  border: none;
}

/* 视图切换按钮组 */




.selection-count {
  font-size: 12px;
  color: var(--el-color-primary);
}

.content-area {
  overflow: auto;
}

/* 滚动条 - 使用主题变量 */
.content-area::-webkit-scrollbar { width: 10px; }
.content-area::-webkit-scrollbar-track { background: var(--md-sys-color-surface-container-low); }
.content-area::-webkit-scrollbar-thumb { background: var(--md-sys-color-outline-variant); border-radius: 5px; }
.content-area::-webkit-scrollbar-thumb:hover { background: var(--md-sys-color-outline); }

/* 操作按钮样式 - 使用语义变量确保深浅模式可见性 */
.action-btn,
.action-btn :deep(.el-button__text),
.action-btn :deep(span),
.action-btn :deep(.el-icon) {
  color: var(--md-sys-color-primary) !important;
  font-size: 11px !important;
  font-weight: 600 !important;
}

.action-btn:hover {
  background-color: color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent) !important;
}

.action-btn-danger,
.action-btn-danger :deep(.el-button__text),
.action-btn-danger :deep(span),
.action-btn-danger :deep(.el-icon) {
  color: var(--md-sys-color-error) !important;
  font-size: 11px !important;
  font-weight: 600 !important;
}

.action-btn-danger:hover {
  background-color: color-mix(in srgb, var(--md-sys-color-error) 10%, transparent) !important;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
  opacity: 0.5;
}

/* 列表单元格 */
.file-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 复选框选中行的高亮 */
:deep(.el-table .selected-row),
:deep(.el-table .selected-row > td),
:deep(.el-table .selected-row > td.el-table__cell) {
  background-color: var(--list-item-bg-selected) !important;
}

/* 网格视图 */
.grid-view {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  padding: 16px;
}

.grid-card {
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
}

.grid-card:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}

.grid-card.selected {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.card-menu {
  position: absolute;
  top: 4px;
  right: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.grid-card:hover .card-menu {
  opacity: 1;
}

.card-thumbnail {
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color-lighter);
}

.card-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.file-icon-large {
  font-size: 48px;
}

.card-info {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.file-icon-small {
  font-size: 14px;
  flex-shrink: 0;
}

.card-name {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 加载更多 */
.load-more {
  display: flex;
  justify-content: center;
  padding: 16px;
}

.load-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  font-size: 32px;
  color: var(--el-color-primary);
}

/* Upload Dialog Custom Styles */
/* 匹配 FilePanel 对话框样式 */
:deep(.custom-upload-dialog) {
  border-radius: 8px;
  overflow: hidden;
}

:deep(.custom-upload-dialog .el-dialog__header) {
  padding: 16px;
  margin: 0;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

:deep(.custom-upload-dialog .el-dialog__title) {
  font-size: 16px;
  font-weight: normal;
}

:deep(.custom-upload-dialog .el-dialog__headerbtn) {
  top: 16px;
  right: 16px;
}

:deep(.custom-upload-dialog .el-dialog__body) {
  padding: 16px;
}

:deep(.custom-upload-dialog .el-dialog__footer) {
  padding: 16px;
  border-top: 1px solid var(--md-sys-color-outline-variant);
}

/* 覆盖 el-upload 拖拽区样式 */
:deep(.custom-upload-dragger .el-upload-dragger) {
  background-color: transparent !important;
  border: 2px dashed var(--md-sys-color-outline) !important;
  border-radius: 8px;
  padding: 40px 0;
  height: auto;
  transition: all 0.2s;
}

:deep(.custom-upload-dragger .el-upload-dragger:hover) {
  border-color: var(--el-color-primary) !important;
  background-color: var(--md-sys-color-surface-container-high) !important;
}

:deep(.custom-upload-dragger .el-icon--upload) {
  color: var(--md-sys-color-on-surface-variant);
  font-size: 48px;
  margin-bottom: 10px;
}

:deep(.custom-upload-dragger .el-upload__text) {
  color: var(--md-sys-color-on-surface-variant) !important;
  font-size: 12px;
}

/* 文件列表 */
:deep(.custom-upload-dragger .el-upload-list__item) {
  background-color: transparent;
  border: none;
  margin-top: 8px;
}

:deep(.custom-upload-dragger .el-upload-list__item:hover) {
  background-color: var(--md-sys-color-surface-container-high);
}

:deep(.custom-upload-dragger .el-upload-list__item-name) {
  color: var(--md-sys-color-on-surface-variant) !important;
}

:deep(.custom-upload-dragger .el-icon--close) {
  color: var(--md-sys-color-outline);
}

/* 标签样式 */
.tag-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}

.tag-count {
  color: var(--el-text-color-secondary);
  font-size: 11px;
  margin-left: 4px;
}

.tag-select-list {
  max-height: 300px;
  overflow-y: auto;
}

.tag-select-item {
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.tag-select-item:last-child {
  border-bottom: none;
}

.tag-manage-form {
  margin-bottom: 16px;
}

.tag-list {
  max-height: 250px;
  overflow-y: auto;
}

.tag-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.tag-list-item:last-child {
  border-bottom: none;
}

.tag-info {
  display: flex;
  align-items: center;
}

.tag-name {
  font-size: 13px;
}

.tag-actions {
  display: flex;
  gap: 4px;
}

.tag-dialog-footer {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

/* 网格视图卡片标签 */
.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 10px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}

.card-tag {
  display: inline-block;
  padding: 2px 6px;
  font-size: 10px;
  color: #fff;
  border-radius: 3px;
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-tag-more {
  font-size: 10px;
  color: var(--el-text-color-secondary);
}

/* 列表视图无标签 */
.no-tags {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

/* 下拉菜单中的标签项 */
:deep(.el-dropdown-menu__item) .tag-dot {
  vertical-align: middle;
}

:deep(.el-dropdown-menu__item.is-active) {
  color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
}

/* 按钮样式 - 已移除自定义类，使用 EP 默认 */
</style>
