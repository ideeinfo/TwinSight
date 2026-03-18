<template>
  <ConsoleShell active-nav="facilities" :context-label="t('facilities.navContext')">
    <section class="facilities-page">
      <header class="page-header">
        <div>
          <h1>{{ t('facilities.pageTitle') }}</h1>
          <p class="page-description">{{ t('facilities.pageDescription') }}</p>
        </div>
        <el-button
          type="primary"
          class="create-button"
          :icon="Plus"
          :disabled="!canCreateFacility"
          @click="openCreateDialog"
        >
          {{ t('facilities.create') }}
        </el-button>
      </header>

      <section class="content-grid">
        <div class="facilities-column section-card">
          <div class="section-toolbar">
            <el-input
              v-model="searchQuery"
              class="search-input"
              :placeholder="t('facilities.searchPlaceholder')"
              :prefix-icon="Search"
              clearable
            />

            <div class="view-toggle" role="tablist" aria-label="Facility display mode">
              <button
                type="button"
                class="toggle-btn"
                :class="{ active: listMode === 'list' }"
                @click="listMode = 'list'"
              >
                <el-icon><Tickets /></el-icon>
              </button>
              <button
                type="button"
                class="toggle-btn"
                :class="{ active: listMode === 'grid' }"
                @click="listMode = 'grid'"
              >
                <el-icon><Grid /></el-icon>
              </button>
            </div>
          </div>

          <div v-if="loadingList" class="state-card">
            <el-skeleton :rows="5" animated />
          </div>

          <div v-else-if="filteredFacilities.length === 0" class="state-card">
            <el-empty :description="t('facilities.empty')" />
          </div>

          <div v-else class="facility-list" :class="`mode-${listMode}`">
            <article
              v-for="facility in filteredFacilities"
              :key="facility.id"
              class="facility-card"
              :class="{ selected: facility.id === selectedFacilityId, grid: listMode === 'grid' }"
              @click="selectFacility(facility.id)"
              @dblclick="openFacility(facility.id)"
            >
              <div class="facility-copy">
                <div class="facility-topline">
                  <div class="facility-title-group">
                    <h2>{{ facility.name }}</h2>
                    <span class="facility-code">{{ facility.facilityCode }}</span>
                    <span class="meta-chip" :class="facility.status">{{ getStatusLabel(facility.status) }}</span>
                  </div>
                  <el-dropdown trigger="click" popper-class="facility-action-menu" @command="handleFacilityCommand($event, facility)">
                    <button class="menu-btn" type="button" @click.stop>
                      <el-icon><MoreFilled /></el-icon>
                    </button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="open">
                          <span class="dropdown-item-content">
                            <el-icon><FolderOpened /></el-icon>
                            <span>{{ t('facilities.openWorkspace') }}</span>
                          </span>
                        </el-dropdown-item>
                        <el-dropdown-item command="edit" :disabled="!canUpdateFacility">
                          <span class="dropdown-item-content">
                            <el-icon><EditPen /></el-icon>
                            <span>{{ t('facilities.editInfo') }}</span>
                          </span>
                        </el-dropdown-item>
                        <el-dropdown-item command="delete" divided :disabled="!canDeleteFacility" class="danger-item">
                          <span class="dropdown-item-content">
                            <el-icon><Delete /></el-icon>
                            <span>{{ t('facilities.deleteFacility') }}</span>
                          </span>
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>

                <p class="facility-description">
                  {{ facility.description || facility.address || t('facilities.noDescription') }}
                </p>

                <div class="facility-metadata">
                  <div class="meta-stat">
                    <span class="meta-stat-label">{{ t('facilities.assets') }}</span>
                    <strong>{{ facility.assetCount }}</strong>
                  </div>
                  <div class="meta-stat">
                    <span class="meta-stat-label">{{ t('facilities.spaces') }}</span>
                    <strong>{{ facility.spaceCount }}</strong>
                  </div>
                  <div class="meta-stat">
                    <span class="meta-stat-label">{{ t('facilities.iot') }}</span>
                    <strong>{{ facility.iotCount }}</strong>
                  </div>
                </div>
              </div>

              <div class="thumb-frame" :class="{ selected: facility.id === selectedFacilityId }">
                <img
                  v-if="resolvePreviewSrc(facility)"
                  :src="resolvePreviewSrc(facility) || ''"
                  :alt="facility.name"
                  class="facility-thumb"
                />
                <div v-else class="thumb-fallback">
                  <span>{{ getFacilityInitials(facility.name) }}</span>
                </div>
              </div>
            </article>
          </div>
        </div>

        <aside class="detail-column section-card">
          <div v-if="loadingDetail" class="state-card state-card--detail">
            <el-skeleton :rows="7" animated />
          </div>

          <div v-else-if="!selectedFacility" class="state-card state-card--detail">
            <el-empty :description="t('facilities.noFacilitySelected')" />
          </div>

          <template v-else>
            <div class="detail-header">
              <div class="detail-hero">
                <div class="detail-copy">
                  <p class="detail-overline">{{ t('facilities.selectedFacility') }}</p>
                  <h2>{{ selectedFacility.name }}</h2>
                  <p class="detail-subtitle">
                    {{ selectedFacility.description || selectedFacility.address || t('facilities.noFacilityDetails') }}
                  </p>
                  <div class="detail-summary-chips">
                    <span class="summary-chip">{{ selectedFacility.assetCount }} {{ t('facilities.assets') }}</span>
                    <span class="summary-chip">{{ selectedFacility.spaceCount }} {{ t('facilities.spaces') }}</span>
                    <span class="summary-chip">{{ selectedFacility.iotCount }} {{ t('facilities.iot') }}</span>
                  </div>
                </div>
              </div>
              <span class="status-pill" :class="selectedFacility.status">{{ getStatusLabel(selectedFacility.status) }}</span>
            </div>

            <div class="detail-actions">
              <el-button type="primary" @click="openFacility(selectedFacility.id)">
                {{ t('facilities.openWorkspace') }}
              </el-button>
              <el-button plain :disabled="!canUpdateFacility" @click="openEditDialog(selectedFacility)">
                {{ t('facilities.editInfo') }}
              </el-button>
            </div>

            <div class="detail-stats">
              <div class="detail-stat">
                <span class="detail-stat-label">{{ t('facilities.models') }}</span>
                <strong>{{ selectedFacility.models.length }}</strong>
              </div>
              <div class="detail-stat">
                <span class="detail-stat-label">{{ t('facilities.views') }}</span>
                <strong>{{ totalViews }}</strong>
              </div>
              <div class="detail-stat">
                <span class="detail-stat-label">{{ t('facilities.documents') }}</span>
                <strong>{{ selectedFacility.documentCount }}</strong>
              </div>
            </div>

            <section class="detail-block">
              <div class="block-header">
                <h3>{{ t('facilities.documentsSection') }}</h3>
              </div>
              <div class="document-archive-card">
                <div>
                  <strong>{{ t('facilities.documentsSummaryTitle') }}</strong>
                  <p>{{ t('facilities.documentsSummaryText', { count: selectedFacility.documentCount }) }}</p>
                </div>
                <el-button type="primary" plain @click="openFacilityDocuments(selectedFacility)">
                  {{ t('facilities.openDocuments') }}
                </el-button>
              </div>
            </section>

            <section class="detail-block">
              <div class="block-header">
                <h3>{{ t('facilities.currentModel') }}</h3>
              </div>
              <div v-if="!activeModel" class="empty-inline">
                {{ t('facilities.currentModelEmpty') }}
              </div>
              <div v-else class="model-overview-card">
                <div class="model-overview-header">
                  <div>
                    <p class="model-overview-label">{{ t('facilities.currentModelLabel') }}</p>
                    <strong>{{ activeModel.title }}</strong>
                  </div>
                  <span class="meta-chip" :class="activeModel.status">{{ getModelStatusLabel(activeModel.status) }}</span>
                </div>
                <dl class="model-overview-meta">
                  <div>
                    <dt>{{ t('facilities.modelSourceLabel') }}</dt>
                    <dd>{{ activeModel.originalName || activeModel.fileCode }}</dd>
                  </div>
                  <div>
                    <dt>{{ t('facilities.modelStatusLabel') }}</dt>
                    <dd>{{ getModelStatusLabel(activeModel.status) }}</dd>
                  </div>
                  <div>
                    <dt>{{ t('facilities.modelViewsLabel') }}</dt>
                    <dd>{{ activeModel.viewCount }}</dd>
                  </div>
                </dl>
              </div>
            </section>

            <section v-if="selectedFacility.models.length > 1" class="detail-block">
              <div class="block-header">
                <h3>{{ t('facilities.modelsSection') }}</h3>
              </div>
              <div class="model-switcher">
                <button
                  v-for="model in selectedFacility.models"
                  :key="model.id"
                  type="button"
                  class="model-chip"
                  :class="{ active: activeModelId === model.id }"
                  @click="activeModelId = model.id"
                >
                  {{ model.title }}
                </button>
              </div>
            </section>

            <section class="detail-block">
              <div class="block-header">
                <h3>{{ t('facilities.views') }} ({{ filteredViews.length }})</h3>
              </div>
              <el-input
                v-model="viewSearchQuery"
                class="search-input search-input--compact"
                :placeholder="t('facilities.viewSearchPlaceholder')"
                :prefix-icon="Search"
                clearable
              />
              <div v-if="filteredViews.length === 0" class="empty-inline">
                {{ t('facilities.noViews') }}
              </div>
              <div v-else class="view-list">
                <article v-for="view in filteredViews" :key="view.id" class="view-card">
                  <div class="view-thumb">
                    <img v-if="resolveMediaSrc(view.thumbnail)" :src="resolveMediaSrc(view.thumbnail) || ''" :alt="view.name" />
                    <div v-else class="view-thumb-fallback">
                      <span>{{ getFacilityInitials(view.name) }}</span>
                    </div>
                  </div>

                  <div class="view-copy">
                    <div class="view-title-row">
                      <h4>{{ view.name }}</h4>
                      <span v-if="view.isDefault" class="default-badge">{{ t('facilities.setDefaultView') }}</span>
                    </div>
                    <p class="view-meta-line">{{ t('facilities.updatedAt', { date: formatTimestamp(view.updatedAt) }) }}</p>
                  </div>

                  <el-dropdown trigger="click" popper-class="facility-action-menu" @command="handleViewCommand($event, view)">
                    <button class="menu-btn" type="button">
                      <el-icon><MoreFilled /></el-icon>
                    </button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="default">
                          <span class="dropdown-item-content">
                            <el-icon><Star /></el-icon>
                            <span>{{ t('facilities.setDefaultView') }}</span>
                          </span>
                        </el-dropdown-item>
                        <el-dropdown-item command="rename">
                          <span class="dropdown-item-content">
                            <el-icon><EditPen /></el-icon>
                            <span>{{ t('facilities.renameView') }}</span>
                          </span>
                        </el-dropdown-item>
                        <el-dropdown-item command="delete" divided class="danger-item">
                          <span class="dropdown-item-content">
                            <el-icon><Delete /></el-icon>
                            <span>{{ t('facilities.deleteView') }}</span>
                          </span>
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </article>
              </div>
            </section>

            <section class="detail-block">
              <div class="block-header">
                <h3>{{ t('facilities.dashboards') }}</h3>
                <span class="placeholder-pill">{{ t('facilities.dashboardsPending') }}</span>
              </div>
              <div class="dashboard-placeholder">
                <div class="placeholder-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M4 19h16" />
                    <path d="M7 15V9" />
                    <path d="M12 15V5" />
                    <path d="M17 15v-3" />
                  </svg>
                </div>
                <div>
                  <strong>{{ t('facilities.dashboardsPlaceholderTitle') }}</strong>
                  <p>{{ t('facilities.dashboardsPlaceholderText') }}</p>
                </div>
              </div>
            </section>
          </template>
        </aside>
      </section>
    </section>

    <el-dialog v-model="createDialogVisible" :title="t('facilities.createDialogTitle')" width="460px" class="facility-dialog">
      <el-form label-position="top" :model="facilityForm">
        <el-form-item :label="t('facilities.facilityName')">
          <el-input v-model="facilityForm.name" maxlength="255" show-word-limit />
        </el-form-item>
        <el-form-item :label="t('facilities.description')">
          <el-input v-model="facilityForm.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item :label="t('facilities.address')">
          <el-input v-model="facilityForm.address" />
        </el-form-item>
        <el-form-item :label="t('facilities.coverImage')">
          <el-upload
            ref="coverUploadRef"
            class="facility-cover-upload"
            accept="image/*"
            :auto-upload="false"
            :show-file-list="false"
            :limit="1"
            :disabled="uploadingCover"
            @change="handleCoverUploadChange"
          >
            <div v-if="facilityForm.coverImagePath" class="cover-upload-preview">
              <img :src="resolveMediaSrc(facilityForm.coverImagePath) || ''" :alt="facilityForm.name || t('facilities.facilityName')" />
              <div class="cover-upload-actions">
                <el-button size="small" :disabled="uploadingCover" @click.stop="removeCoverImage">{{ t('facilities.removeCoverImage') }}</el-button>
              </div>
            </div>
            <div v-else class="cover-upload-empty">
              <el-icon><Picture /></el-icon>
              <strong>{{ t('facilities.uploadCoverImage') }}</strong>
              <span>{{ uploadingCover ? t('facilities.coverImageUploading') : t('facilities.coverImageHint') }}</span>
            </div>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="savingFacility" @click="submitCreateFacility">{{ t('common.create') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editDialogVisible" :title="t('facilities.editDialogTitle')" width="460px" class="facility-dialog">
      <el-form label-position="top" :model="facilityForm">
        <el-form-item :label="t('facilities.facilityName')">
          <el-input v-model="facilityForm.name" maxlength="255" show-word-limit />
        </el-form-item>
        <el-form-item :label="t('facilities.description')">
          <el-input v-model="facilityForm.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item :label="t('facilities.address')">
          <el-input v-model="facilityForm.address" />
        </el-form-item>
        <el-form-item :label="t('facilities.coverImage')">
          <el-upload
            ref="coverUploadRef"
            class="facility-cover-upload"
            accept="image/*"
            :auto-upload="false"
            :show-file-list="false"
            :limit="1"
            :disabled="uploadingCover"
            @change="handleCoverUploadChange"
          >
            <div v-if="facilityForm.coverImagePath" class="cover-upload-preview">
              <img :src="resolveMediaSrc(facilityForm.coverImagePath) || ''" :alt="facilityForm.name || t('facilities.facilityName')" />
              <div class="cover-upload-actions">
                <el-button size="small" :disabled="uploadingCover" @click.stop="removeCoverImage">{{ t('facilities.removeCoverImage') }}</el-button>
              </div>
            </div>
            <div v-else class="cover-upload-empty">
              <el-icon><Picture /></el-icon>
              <strong>{{ t('facilities.uploadCoverImage') }}</strong>
              <span>{{ uploadingCover ? t('facilities.coverImageUploading') : t('facilities.coverImageHint') }}</span>
            </div>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="savingFacility" @click="submitEditFacility">{{ t('common.save') }}</el-button>
      </template>
    </el-dialog>
  </ConsoleShell>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { UploadInstance } from 'element-plus';
import { Delete, EditPen, FolderOpened, Grid, MoreFilled, Picture, Plus, Search, Star, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import ConsoleShell from '@/components/dashboard/ConsoleShell.vue';
import {
  createFacility,
  deleteFacility,
  getFacilityDetail,
  getFacilities,
  uploadFacilityCover,
  updateFacility,
} from '@/services/api/facilities';
import { activateModelFile } from '@/services/api/models';
import { useAuthStore } from '@/stores/auth';
import { useModelsStore } from '@/stores/models';
import type {
  FacilityDetail,
  FacilityListMode,
  FacilityModelSummary,
  FacilityModelView,
  FacilityPayload,
  FacilitySummary,
} from '@/types/facility';
import { recordRecentFacilityVisit } from '@/utils/recentFacilities';

const FACILITY_CREATE_PERMISSION = 'facility:create';
const FACILITY_UPDATE_PERMISSION = 'facility:update';
const FACILITY_DELETE_PERMISSION = 'facility:delete';

const router = useRouter();
const { t, locale } = useI18n();
const authStore = useAuthStore();
const modelsStore = useModelsStore();

const loadingList = ref(false);
const loadingDetail = ref(false);
const savingFacility = ref(false);
const uploadingCover = ref(false);
const facilities = ref<FacilitySummary[]>([]);
const selectedFacilityId = ref<number | null>(null);
const selectedFacility = ref<FacilityDetail | null>(null);
const listMode = ref<FacilityListMode>('list');
const searchQuery = ref('');
const viewSearchQuery = ref('');
const createDialogVisible = ref(false);
const editDialogVisible = ref(false);
const activeModelId = ref<number | null>(null);
const editingFacilityId = ref<number | null>(null);
const coverUploadRef = ref<UploadInstance | null>(null);
const apiBase = import.meta.env.VITE_API_URL || window.location.origin;

const facilityForm = reactive<FacilityPayload>({
  name: '',
  description: '',
  address: '',
  coverImagePath: '',
});

const canCreateFacility = computed(() => authStore.hasPermission(FACILITY_CREATE_PERMISSION));
const canUpdateFacility = computed(() => authStore.hasPermission(FACILITY_UPDATE_PERMISSION));
const canDeleteFacility = computed(() => authStore.hasPermission(FACILITY_DELETE_PERMISSION));

const filteredFacilities = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase();
  if (!keyword) {
    return facilities.value;
  }

  return facilities.value.filter((facility) => {
    return [facility.name, facility.facilityCode, facility.description || '', facility.address || '']
      .join(' ')
      .toLowerCase()
      .includes(keyword);
  });
});

const activeModel = computed<FacilityModelSummary | null>(() => {
  if (!selectedFacility.value || selectedFacility.value.models.length === 0) {
    return null;
  }

  if (activeModelId.value) {
    return selectedFacility.value.models.find((model) => model.id === activeModelId.value) || selectedFacility.value.models[0];
  }

  return selectedFacility.value.models[0];
});

const filteredViews = computed<FacilityModelView[]>(() => {
  const views = activeModel.value?.views || [];
  const keyword = viewSearchQuery.value.trim().toLowerCase();
  if (!keyword) {
    return views;
  }

  return views.filter((view) => view.name.toLowerCase().includes(keyword));
});

const totalViews = computed(() => selectedFacility.value?.models.reduce((total, model) => total + model.views.length, 0) || 0);

watch(selectedFacilityId, async (facilityId) => {
  if (!facilityId) {
    selectedFacility.value = null;
    return;
  }
  await loadFacilityDetail(facilityId);
});

watch(selectedFacility, (detail) => {
  activeModelId.value = detail?.models[0]?.id || null;
  viewSearchQuery.value = '';
});

onMounted(async () => {
  await loadFacilities();
});

async function loadFacilities() {
  loadingList.value = true;
  try {
    const data = await getFacilities();
    facilities.value = data;

    if (!selectedFacilityId.value || !data.find((item) => item.id === selectedFacilityId.value)) {
      selectedFacilityId.value = data[0]?.id || null;
    }

    enrichFacilityPreviews(data);
  } catch (error) {
    console.error('Failed to load facilities:', error);
    ElMessage.error((error as Error).message || t('facilities.loadListFailed'));
  } finally {
    loadingList.value = false;
  }
}

async function enrichFacilityPreviews(items: FacilitySummary[]) {
  const results = await Promise.allSettled(
    items.slice(0, 12).map(async (facility) => {
      const detail = await getFacilityDetail(facility.id);
      const preview = detail?.models.flatMap((model) => model.views).find((view) => view.thumbnail)?.thumbnail || null;
      return {
        id: facility.id,
        preview,
      };
    })
  );

  const previewMap = new Map<number, string | null>();
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      previewMap.set(result.value.id, result.value.preview);
    }
  });

  facilities.value = facilities.value.map((facility) => ({
    ...facility,
    previewThumbnail: previewMap.get(facility.id) ?? facility.previewThumbnail ?? null,
  }));
}

async function loadFacilityDetail(facilityId: number) {
  loadingDetail.value = true;
  try {
    const detail = await getFacilityDetail(facilityId);
    selectedFacility.value = detail;

    if (detail) {
      facilities.value = facilities.value.map((facility) => {
        if (facility.id !== detail.id) {
          return facility;
        }

        return {
          ...facility,
          previewThumbnail:
            detail.previewThumbnail ||
            detail.models.flatMap((model) => model.views).find((view) => view.thumbnail)?.thumbnail ||
            facility.previewThumbnail ||
            null,
          modelCount: detail.modelCount,
          viewCount: detail.viewCount,
          documentCount: detail.documentCount,
          defaultModelId: detail.defaultModelId,
          description: detail.description,
          address: detail.address,
        };
      });
    }
  } catch (error) {
    console.error('Failed to load facility detail:', error);
    ElMessage.error((error as Error).message || t('facilities.loadDetailFailed'));
  } finally {
    loadingDetail.value = false;
  }
}

function selectFacility(facilityId: number) {
  selectedFacilityId.value = facilityId;
}

function openFacilityDocuments(facility: FacilitySummary | FacilityDetail) {
  recordRecentFacilityVisit(facility.id, authStore.user?.id || authStore.user?.username || null);
  router.push({
    path: '/viewer',
    query: {
      panel: 'documents',
      facilityId: String(facility.id),
      facilityName: facility.name,
    },
  });
}

async function openFacility(facilityId?: number) {
  const targetFacilityId = facilityId || selectedFacilityId.value;
  if (!targetFacilityId) {
    return;
  }

  let detail = selectedFacility.value;
  if (!detail || detail.id !== targetFacilityId) {
    detail = await getFacilityDetail(targetFacilityId);
  }

  const model = pickOpenModel(detail);

  try {
    recordRecentFacilityVisit(targetFacilityId, authStore.user?.id || authStore.user?.username || null);
    router.push({
      path: '/viewer',
      query: {
        facilityId: String(targetFacilityId),
        facilityName: detail?.name || '',
        ...(model
          ? (() => {
              const defaultView = model.views.find((view) => view.isDefault) || model.views[0] || null;
              return {
                fileId: String(model.id),
                ...(defaultView ? {
                  viewId: String(defaultView.id),
                  viewName: defaultView.name,
                } : {}),
              };
            })()
          : {
              panel: 'models',
            }),
      },
    });
    if (model) {
      await activateModelFile(model.id);
      modelsStore.setActiveModel(model.id);
    }
  } catch (error) {
    console.error('Failed to open facility:', error);
    ElMessage.error((error as Error).message || t('facilities.openFailed'));
  }
}

function pickOpenModel(detail: FacilityDetail | null): FacilityModelSummary | null {
  if (!detail || detail.models.length === 0) {
    return null;
  }

  return (
    detail.models.find((model) => model.id === activeModelId.value) ||
    detail.models.find((model) => model.id === detail.defaultModelId) ||
    detail.models[0]
  );
}

function openCreateDialog() {
  if (!canCreateFacility.value) {
    ElMessage.warning(t('facilities.noCreatePermission'));
    return;
  }

  resetForm();
  createDialogVisible.value = true;
}

function openEditDialog(facility: FacilitySummary | FacilityDetail) {
  if (!canUpdateFacility.value) {
    ElMessage.warning(t('facilities.noUpdatePermission'));
    return;
  }

  editingFacilityId.value = facility.id;
  facilityForm.name = facility.name;
  facilityForm.description = facility.description || '';
  facilityForm.address = facility.address || '';
  facilityForm.coverImagePath = facility.coverImagePath || '';
  editDialogVisible.value = true;
}

async function submitCreateFacility() {
  if (!facilityForm.name?.trim()) {
    ElMessage.warning(t('facilities.requireName'));
    return;
  }

  savingFacility.value = true;
  try {
    const created = await createFacility({
      name: facilityForm.name.trim(),
      description: facilityForm.description?.trim() || null,
      address: facilityForm.address?.trim() || null,
      coverImagePath: facilityForm.coverImagePath || null,
    });
    createDialogVisible.value = false;
    await loadFacilities();
    selectedFacilityId.value = created.id;
    ElMessage.success(t('facilities.createSuccess'));
  } catch (error) {
    console.error('Failed to create facility:', error);
    ElMessage.error((error as Error).message || t('facilities.createFailed'));
  } finally {
    savingFacility.value = false;
  }
}

async function submitEditFacility() {
  if (!editingFacilityId.value) {
    return;
  }

  if (!facilityForm.name?.trim()) {
    ElMessage.warning(t('facilities.requireName'));
    return;
  }

  savingFacility.value = true;
  try {
    await updateFacility(editingFacilityId.value, {
      name: facilityForm.name.trim(),
      description: facilityForm.description?.trim() || null,
      address: facilityForm.address?.trim() || null,
      coverImagePath: facilityForm.coverImagePath || null,
    });
    editDialogVisible.value = false;
    await loadFacilities();
    await loadFacilityDetail(editingFacilityId.value);
    ElMessage.success(t('facilities.updateSuccess'));
  } catch (error) {
    console.error('Failed to update facility:', error);
    ElMessage.error((error as Error).message || t('facilities.updateFailed'));
  } finally {
    savingFacility.value = false;
  }
}

async function handleFacilityCommand(command: string, facility: FacilitySummary) {
  if (command === 'open') {
    await openFacility(facility.id);
    return;
  }

  if (command === 'edit') {
    openEditDialog(facility);
    return;
  }

  if (command === 'delete') {
    if (!canDeleteFacility.value) {
      ElMessage.warning(t('facilities.noDeletePermission'));
      return;
    }

    await ElMessageBox.confirm(
      t('facilities.facilityDeleteConfirm', { name: facility.name }),
      t('facilities.facilityDeleteConfirmTitle'),
      {
        type: 'warning',
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
      }
    );

    try {
      await deleteFacility(facility.id);
      ElMessage.success(t('facilities.deleteSuccess'));
      if (selectedFacilityId.value === facility.id) {
        selectedFacilityId.value = null;
      }
      await loadFacilities();
    } catch (error) {
      console.error('Failed to delete facility:', error);
      ElMessage.error((error as Error).message || t('facilities.deleteFailed'));
    }
  }
}

async function handleViewCommand(command: string, view: FacilityModelView) {
  try {
    if (command === 'default') {
      await http.put(`/api/views/${view.id}/set-default`, { isDefault: true });
      await reloadCurrentFacility();
      ElMessage.success(t('facilities.updateDefaultSuccess'));
      return;
    }

    if (command === 'rename') {
      const result = await ElMessageBox.prompt(t('facilities.renameViewPrompt'), t('facilities.renameViewTitle'), {
        inputValue: view.name,
        confirmButtonText: t('common.save'),
        cancelButtonText: t('common.cancel'),
      });
      const nextName = result.value?.trim();
      if (!nextName) {
        return;
      }
      await http.put(`/api/views/${view.id}`, { name: nextName });
      await reloadCurrentFacility();
      ElMessage.success(t('facilities.renameViewSuccess'));
      return;
    }

    if (command === 'delete') {
      await ElMessageBox.confirm(
        t('facilities.viewDeleteConfirm', { name: view.name }),
        t('facilities.viewDeleteConfirmTitle'),
        {
          type: 'warning',
          confirmButtonText: t('common.delete'),
          cancelButtonText: t('common.cancel'),
        }
      );
      await http.delete(`/api/views/${view.id}`);
      await reloadCurrentFacility();
      ElMessage.success(t('facilities.deleteViewSuccess'));
    }
  } catch (error) {
    if ((error as Error)?.message === 'cancel' || (error as Error)?.message === 'close') {
      return;
    }
    console.error('Failed to handle view command:', error);
    ElMessage.error((error as Error).message || t('facilities.viewActionFailed'));
  }
}

async function reloadCurrentFacility() {
  if (!selectedFacilityId.value) {
    return;
  }

  await Promise.all([loadFacilities(), loadFacilityDetail(selectedFacilityId.value)]);
}

function resolvePreviewSrc(facility: FacilitySummary) {
  return resolveMediaSrc(facility.coverImagePath || facility.previewThumbnail || null);
}

function resolveMediaSrc(path: string | null) {
  if (!path) {
    return null;
  }

  if (/^(https?:|data:|blob:)/.test(path)) {
    return path;
  }

  return new URL(path, apiBase).toString();
}

function getFacilityInitials(name: string) {
  return name
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'TS';
}

function getStatusLabel(status: string) {
  if (status === 'active') {
    return t('facilities.statusActive');
  }
  if (status === 'archived') {
    return t('facilities.statusArchived');
  }
  return t('facilities.statusUnknown');
}

function getModelStatusLabel(status: string) {
  if (status === 'uploaded') {
    return t('filePanel.statusUploaded');
  }
  if (status === 'extracting') {
    return t('filePanel.statusExtracting');
  }
  if (status === 'ready') {
    return t('filePanel.statusReady');
  }
  if (status === 'error') {
    return t('filePanel.statusError');
  }
  return status;
}

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat(locale.value === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp));
}

function resetForm() {
  editingFacilityId.value = null;
  facilityForm.name = '';
  facilityForm.description = '';
  facilityForm.address = '';
  facilityForm.coverImagePath = '';
  coverUploadRef.value?.clearFiles();
}

async function handleCoverUploadChange(uploadFile: { raw?: File }) {
  const file = uploadFile?.raw;
  if (!file) {
    return;
  }

  if (!file.type.startsWith('image/')) {
    ElMessage.warning(t('facilities.coverImageInvalidType'));
    return;
  }

  const maxSize = 2 * 1024 * 1024;
  if (file.size > maxSize) {
    ElMessage.warning(t('facilities.coverImageTooLarge'));
    return;
  }

  uploadingCover.value = true;
  try {
    facilityForm.coverImagePath = await uploadFacilityCover(file);
    ElMessage.success(t('facilities.coverImageUploadSuccess'));
  } catch (error) {
    console.error('Failed to upload facility cover image:', error);
    ElMessage.error((error as Error).message || t('facilities.coverImageUploadFailed'));
  } finally {
    uploadingCover.value = false;
    coverUploadRef.value?.clearFiles();
  }
}

function removeCoverImage() {
  facilityForm.coverImagePath = '';
  coverUploadRef.value?.clearFiles();
}
</script>

<style scoped>
.facilities-page {
  width: min(80vw, 1560px);
  margin: 0 auto;
  padding: 28px 0 40px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.page-kicker {
  margin: 0 0 6px;
  color: var(--md-sys-color-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.page-header h1 {
  margin: 0;
  font-size: 34px;
  line-height: 1.05;
  color: var(--md-sys-color-on-surface);
}

.page-description {
  margin: 8px 0 0;
  max-width: 720px;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 14px;
  line-height: 1.55;
}

.create-button {
  margin-top: 8px;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(360px, 0.9fr);
  gap: 20px;
  align-items: start;
}

.section-card {
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 16px;
  background: var(--md-sys-color-surface-container-low);
  box-shadow: 0 18px 48px color-mix(in srgb, var(--md-sys-color-shadow) 12%, transparent);
}

.facilities-column {
  padding: 18px;
}

.detail-column {
  position: sticky;
  top: 92px;
  padding: 22px;
}

.section-toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}

.search-input {
  flex: 1;
}

:deep(.facility-dialog .el-input__wrapper),
:deep(.facility-dialog .el-textarea__inner) {
  background: var(--md-sys-color-surface-container-high) !important;
  box-shadow: inset 0 0 0 1px var(--md-sys-color-outline-variant) !important;
}

:deep(.facility-dialog .el-textarea__inner) {
  border: none;
  border-radius: 12px;
  color: var(--md-sys-color-on-surface);
}

:deep(.facility-dialog .el-textarea__inner:focus) {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--md-sys-color-primary) 55%, transparent) !important;
}

.facility-cover-upload {
  width: 100%;
}

:deep(.facility-cover-upload .el-upload) {
  width: 100%;
}

.cover-upload-empty,
.cover-upload-preview {
  width: 100%;
  overflow: hidden;
  border-radius: 12px;
  border: 1px dashed var(--md-sys-color-outline-variant);
  background: color-mix(in srgb, var(--md-sys-color-surface-container-high) 88%, transparent);
}

.cover-upload-empty {
  min-height: 156px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
  color: var(--md-sys-color-on-surface-variant);
}

.cover-upload-empty .el-icon {
  font-size: 28px;
  color: var(--md-sys-color-primary);
}

.cover-upload-empty strong {
  color: var(--md-sys-color-on-surface);
  font-size: 15px;
}

.cover-upload-empty span {
  font-size: 12px;
  line-height: 1.5;
}

.cover-upload-preview {
  position: relative;
  min-height: 180px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--md-sys-color-primary) 24%, transparent), var(--md-sys-color-surface-container-high));
}

.cover-upload-preview img {
  width: 100%;
  height: 180px;
  object-fit: cover;
  display: block;
}

.cover-upload-actions {
  position: absolute;
  right: 12px;
  bottom: 12px;
}

.view-toggle {
  display: inline-flex;
  align-items: center;
  padding: 4px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 12px;
  background: var(--md-sys-color-surface-container);
}

.toggle-btn {
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.toggle-btn.active {
  background: color-mix(in srgb, var(--md-sys-color-primary) 16%, transparent);
  color: var(--md-sys-color-primary);
}

.facility-list {
  display: grid;
  gap: 14px;
}

.facility-list.mode-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.facility-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(180px, 30%);
  gap: 14px;
  padding: 12px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 16px;
  background: var(--md-sys-color-surface-container);
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.facility-card:hover {
  transform: translateY(-1px);
  background: color-mix(in srgb, var(--md-sys-color-surface-container) 84%, var(--md-sys-color-surface-container-high));
  border-color: color-mix(in srgb, var(--md-sys-color-primary) 42%, transparent);
  box-shadow: 0 18px 36px color-mix(in srgb, var(--md-sys-color-primary) 8%, transparent);
}

.facility-card.selected {
  border-color: color-mix(in srgb, var(--md-sys-color-primary) 56%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--md-sys-color-primary) 24%, transparent), 0 18px 30px color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent);
}

.facility-card.grid {
  grid-template-columns: 1fr;
}

.facility-card.grid .thumb-frame {
  order: -1;
  min-height: 196px;
}

.facility-copy {
  min-width: 0;
}

.facility-topline,
.view-title-row,
.detail-header,
.detail-actions,
.block-header,
.facility-title-group {
  display: flex;
  align-items: center;
}

.facility-topline,
.block-header,
.detail-header,
.detail-actions {
  justify-content: space-between;
}

.facility-title-group {
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.facility-copy h2,
.detail-header h2 {
  margin: 0;
  font-size: 26px;
  line-height: 1.1;
  color: var(--md-sys-color-on-surface);
}

.facility-copy h2 {
  font-size: 21px;
  letter-spacing: -0.02em;
  min-width: 0;
  flex: 1 1 auto;
}

.facility-code {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--md-sys-color-primary) 12%, transparent);
  color: var(--md-sys-color-primary);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.facility-description,
.detail-subtitle,
.dashboard-placeholder p,
.view-copy p {
  margin: 0;
  color: var(--md-sys-color-on-surface-variant);
}

.facility-description {
  margin-top: 8px;
  min-height: 22px;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  overflow: hidden;
  font-size: 13px;
}

.facility-metadata {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 78%, transparent);
}

.meta-stat {
  min-width: 0;
}

.meta-stat-label {
  display: block;
  margin-bottom: 4px;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.meta-stat strong {
  display: block;
  color: var(--md-sys-color-on-surface);
  font-size: 18px;
  line-height: 1;
}

.meta-chip,
.status-pill,
.default-badge,
.placeholder-pill {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.meta-chip {
  background: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface-variant);
}

.meta-chip.active,
.status-pill.active {
  background: color-mix(in srgb, var(--md-sys-color-primary) 14%, transparent);
  color: var(--md-sys-color-primary);
}

.meta-chip.archived,
.status-pill.archived {
  background: color-mix(in srgb, var(--md-sys-color-error) 12%, transparent);
  color: var(--md-sys-color-error);
}

.meta-chip.uploaded {
  background: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface);
}

.meta-chip.extracting {
  background: color-mix(in srgb, #ffc107 26%, transparent);
  color: color-mix(in srgb, #ffc107 86%, black 14%);
}

.meta-chip.ready {
  background: color-mix(in srgb, #4caf50 22%, transparent);
  color: color-mix(in srgb, #4caf50 82%, white 18%);
}

.meta-chip.error {
  background: color-mix(in srgb, var(--md-sys-color-error) 14%, transparent);
  color: var(--md-sys-color-error);
}

.thumb-frame {
  position: relative;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  min-height: 128px;
  border-radius: 12px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--md-sys-color-primary) 26%, var(--md-sys-color-surface-container-high)), var(--md-sys-color-surface-container-high));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--md-sys-color-outline-variant) 72%, transparent);
}

.thumb-frame.selected::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid color-mix(in srgb, var(--md-sys-color-primary) 58%, transparent);
  border-radius: inherit;
  pointer-events: none;
}

.facility-thumb,
.view-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.25s ease;
}

.facility-card:hover .facility-thumb {
  transform: scale(1.04);
}

.thumb-frame::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.08) 0%, transparent 32%, rgba(0, 0, 0, 0.42) 100%);
  z-index: 1;
}

.thumb-fallback,
.view-thumb-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: color-mix(in srgb, var(--md-sys-color-primary) 68%, white 32%);
  font-size: 36px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.menu-btn {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;
}

.menu-btn:hover {
  background: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface);
}

.dropdown-item-content {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

:deep(.facility-action-menu) {
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 8px;
  background: var(--md-sys-color-surface-container-high);
  box-shadow: 0 16px 32px color-mix(in srgb, var(--md-sys-color-shadow) 18%, transparent);
  overflow: hidden;
}

:deep(.facility-action-menu .el-dropdown-menu) {
  padding: 4px 0;
  background: transparent;
}

:deep(.facility-action-menu .el-dropdown-menu__item) {
  min-width: 160px;
  padding: 10px 14px;
  font-size: 12px;
  color: var(--md-sys-color-on-surface);
  line-height: 1;
}

:deep(.facility-action-menu .el-dropdown-menu__item:hover),
:deep(.facility-action-menu .el-dropdown-menu__item:focus) {
  background: var(--md-sys-color-surface-container-highest);
  color: var(--md-sys-color-on-surface);
}

:deep(.facility-action-menu .el-dropdown-menu__item.is-divided) {
  margin-top: 4px;
  border-top: 1px solid var(--md-sys-color-outline-variant);
}

:deep(.facility-action-menu .el-dropdown-menu__item.danger-item) {
  color: var(--md-sys-color-error);
}

:deep(.facility-action-menu .el-dropdown-menu__item.danger-item:hover),
:deep(.facility-action-menu .el-dropdown-menu__item.danger-item:focus) {
  background: var(--md-sys-color-error-container);
  color: var(--md-sys-color-on-error-container);
}

.detail-overline {
  margin: 0 0 10px;
  color: var(--md-sys-color-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.detail-hero {
  display: block;
}

.detail-copy {
  min-width: 0;
}

.detail-subtitle {
  margin-top: 10px;
  line-height: 1.6;
}

.detail-summary-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}

.summary-chip {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent);
  color: var(--md-sys-color-on-surface-variant);
  font-size: 12px;
  font-weight: 600;
}

.detail-actions {
  gap: 12px;
  margin-top: 18px;
}

.detail-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 20px;
}

.detail-stat {
  padding: 14px;
  border-radius: 12px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--md-sys-color-primary) 7%, var(--md-sys-color-surface-container)),
    var(--md-sys-color-surface-container)
  );
  border: 1px solid var(--md-sys-color-outline-variant);
}

.detail-stat-label {
  display: block;
  margin-bottom: 8px;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.detail-stat strong {
  font-size: 24px;
}

.detail-block {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid var(--md-sys-color-outline-variant);
}

.model-overview-card {
  margin-top: 14px;
  padding: 16px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 14px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--md-sys-color-primary) 8%, var(--md-sys-color-surface-container)),
    var(--md-sys-color-surface-container)
  );
}

.model-overview-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.model-overview-label {
  margin: 0 0 8px;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.model-overview-header strong {
  display: block;
  font-size: 20px;
  line-height: 1.2;
}

.model-overview-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 16px 0 0;
}

.model-overview-meta dt {
  margin: 0 0 6px;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 12px;
}

.model-overview-meta dd {
  margin: 0;
  color: var(--md-sys-color-on-surface);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
  word-break: break-word;
}

.block-header h3 {
  margin: 0;
  font-size: 17px;
}

.model-switcher {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}

.model-chip {
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 999px;
  background: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;
}

.model-chip.active {
  border-color: color-mix(in srgb, var(--md-sys-color-primary) 44%, transparent);
  color: var(--md-sys-color-primary);
  background: color-mix(in srgb, var(--md-sys-color-primary) 12%, transparent);
}

.search-input--compact {
  margin-top: 14px;
}

.view-list {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

.view-card {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 10px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 14px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--md-sys-color-primary) 4%, var(--md-sys-color-surface-container)),
    var(--md-sys-color-surface-container)
  );
}

.view-thumb {
  overflow: hidden;
  width: 76px;
  height: 56px;
  border-radius: 10px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--md-sys-color-primary) 24%, transparent), var(--md-sys-color-surface-container-high));
}

.view-copy {
  min-width: 0;
}

.view-title-row {
  gap: 10px;
}

.view-copy h4 {
  margin: 0;
  max-width: 100%;
  font-size: 15px;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.view-copy p {
  margin-top: 6px;
  font-size: 12px;
}

.view-meta-line {
  color: var(--md-sys-color-on-surface-variant);
}

.default-badge,
.placeholder-pill {
  height: 24px;
  padding: 0 10px;
  background: color-mix(in srgb, var(--md-sys-color-primary) 16%, transparent);
  color: var(--md-sys-color-primary);
}

.dashboard-placeholder {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  margin-top: 16px;
  padding: 16px;
  border: 1px dashed color-mix(in srgb, var(--md-sys-color-outline) 72%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--md-sys-color-surface-container-high) 52%, transparent);
}

.placeholder-icon {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: color-mix(in srgb, var(--md-sys-color-primary) 12%, transparent);
  color: var(--md-sys-color-primary);
}

.placeholder-icon svg {
  width: 24px;
  height: 24px;
}

.dashboard-placeholder strong {
  display: block;
  margin-bottom: 6px;
}

.document-archive-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 14px;
  padding: 16px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 14px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--md-sys-color-primary) 5%, var(--md-sys-color-surface-container)),
    var(--md-sys-color-surface-container)
  );
}

.document-archive-card strong {
  display: block;
  margin-bottom: 6px;
}

.document-archive-card p {
  margin: 0;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 13px;
  line-height: 1.5;
}

.empty-inline,
.state-card {
  padding: 24px;
  border-radius: 14px;
  background: var(--md-sys-color-surface-container);
  border: 1px dashed var(--md-sys-color-outline-variant);
  color: var(--md-sys-color-on-surface-variant);
}

.meta-chip--subtle {
  background: color-mix(in srgb, var(--md-sys-color-on-surface) 5%, transparent);
  color: var(--md-sys-color-on-surface-variant);
}

.state-card--detail {
  min-height: 320px;
}

@media (max-width: 1280px) {
  .content-grid {
    grid-template-columns: 1fr;
  }

  .detail-column {
    position: static;
  }
}

@media (max-width: 900px) {
  .facilities-page {
    width: auto;
    padding: 20px;
  }

  .page-header {
    flex-direction: column;
  }

  .facility-list.mode-grid {
    grid-template-columns: 1fr;
  }

  .facility-card {
    grid-template-columns: 1fr;
  }

  .thumb-frame {
    order: -1;
  }

  .detail-stats {
    grid-template-columns: 1fr;
  }

  .model-overview-meta {
    grid-template-columns: 1fr;
  }

  .detail-hero {
    grid-template-columns: 1fr;
  }

  .facility-metadata {
    grid-template-columns: 1fr 1fr;
  }

  .meta-status-line {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
