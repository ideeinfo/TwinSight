<template>
  <ConsoleShell active-nav="home" :context-label="t('homeDashboard.navContext')">
    <section class="home-dashboard">
      <header class="dashboard-header">
        <div class="header-copy">
          <div class="title-row">
            <div>
              <h1>{{ t('homeDashboard.title', { name: authStore.user?.username || t('account.guest') }) }}</h1>
              <p class="page-description">{{ t('homeDashboard.description') }}</p>
            </div>
            <div class="header-badges">
              <span class="status-chip">{{ t('homeDashboard.liveStatus') }}</span>
              <span class="sync-chip">{{ t('homeDashboard.syncStatus') }}</span>
            </div>
          </div>
        </div>

        <div class="summary-strip">
          <article class="summary-card summary-card--primary summary-card--network">
            <p>{{ t('homeDashboard.networkLabel') }}</p>
            <strong>{{ portfolioSummary.facilities }}</strong>
            <span>{{ t('homeDashboard.networkHint', { count: portfolioSummary.activeFacilities }) }}</span>
          </article>

          <article class="summary-card summary-card--assets">
            <p>{{ t('homeDashboard.assetsLabel') }}</p>
            <strong>{{ portfolioSummary.assets }}</strong>
            <span>{{ t('homeDashboard.assetsHint', { count: portfolioSummary.spaces }) }}</span>
          </article>

          <article class="summary-card summary-card--views">
            <p>{{ t('homeDashboard.viewsLabel') }}</p>
            <strong>{{ portfolioSummary.views }}</strong>
            <span>{{ t('homeDashboard.viewsHint', { count: portfolioSummary.iot }) }}</span>
          </article>
        </div>
      </header>

      <section class="dashboard-grid">
        <div class="main-column">
          <section class="panel panel--facilities">
            <div class="panel-header">
              <div>
                <h2>{{ t('homeDashboard.recentTitle') }}</h2>
              </div>
              <RouterLink class="panel-link" to="/facilities">{{ t('homeDashboard.viewAllFacilities') }}</RouterLink>
            </div>

            <div v-if="loadingList" class="state-card">
              <el-skeleton :rows="5" animated />
            </div>

            <div v-else-if="recentFacilities.length === 0" class="state-card">
              <el-empty :description="t('homeDashboard.emptyFacilities')" />
            </div>

            <div v-else class="facility-grid">
              <article
                v-for="facility in recentFacilities"
                :key="facility.id"
                class="facility-tile"
                :class="{ active: facility.id === selectedFacilityId }"
                @click="selectFacility(facility.id)"
                @dblclick="openFacility(facility.id)"
              >
                <div class="tile-media" :class="{ active: facility.id === selectedFacilityId }">
                  <img
                    v-if="resolvePreviewSrc(facility)"
                    :src="resolvePreviewSrc(facility) || ''"
                    :alt="facility.name"
                    class="tile-image"
                  />
                  <div v-else class="tile-fallback">
                    <span>{{ getInitials(facility.name) }}</span>
                  </div>
                </div>

                <div class="tile-content">
                  <div class="tile-topline">
                    <div>
                      <h3>{{ facility.name }}</h3>
                      <p class="tile-subtitle">{{ facility.description || facility.address || t('homeDashboard.noDescription') }}</p>
                    </div>
                    <span class="tile-status" :class="facility.status">{{ getStatusLabel(facility.status) }}</span>
                  </div>

                  <div class="tile-metrics">
                    <div class="metric-pill">
                      <span>{{ t('facilities.assets') }}</span>
                      <strong>{{ facility.assetCount }}</strong>
                    </div>
                    <div class="metric-pill">
                      <span>{{ t('facilities.spaces') }}</span>
                      <strong>{{ facility.spaceCount }}</strong>
                    </div>
                    <div class="metric-pill">
                      <span>{{ t('facilities.iot') }}</span>
                      <strong>{{ facility.iotCount }}</strong>
                    </div>
                  </div>

                  <div class="tile-footer">
                    <span>{{ t('homeDashboard.updatedAt', { date: formatTimestamp(facility.updatedAt) }) }}</span>
                    <button type="button" class="open-link" @click.stop="openFacility(facility.id)">
                      {{ t('facilities.openWorkspace') }}
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </section>
        </div>

        <aside class="side-column">
          <section class="panel panel--status">
            <div class="panel-header panel-header--tight">
              <div>
                <h2>{{ statusPanelTitle }}</h2>
              </div>
              <span class="status-chip status-chip--muted">{{ t('homeDashboard.statusChip') }}</span>
            </div>

            <div class="status-highlight">
              <div>
                <p>{{ t('homeDashboard.healthLabel') }}</p>
                <strong>{{ healthScore }}%</strong>
              </div>
              <span class="health-indicator">{{ t('homeDashboard.healthState') }}</span>
            </div>

            <div class="status-grid">
              <article class="status-card">
                <span>{{ t('homeDashboard.sessionsLabel') }}</span>
                <strong>{{ liveSessions }}</strong>
                <small>{{ t('homeDashboard.sessionsHint') }}</small>
              </article>
              <article class="status-card">
                <span>{{ t('homeDashboard.syncJobsLabel') }}</span>
                <strong>{{ syncJobs }}</strong>
                <small>{{ t('homeDashboard.syncJobsHint') }}</small>
              </article>
              <article class="status-card">
                <span>{{ t('homeDashboard.readyViewsLabel') }}</span>
                <strong>{{ selectedViewCount }}</strong>
                <small>{{ t('homeDashboard.readyViewsHint') }}</small>
              </article>
              <article class="status-card">
                <span>{{ t('homeDashboard.dashboardsLabel') }}</span>
                <strong>{{ selectedFacility?.dashboardCount || 0 }}</strong>
                <small>{{ t('homeDashboard.dashboardsHint') }}</small>
              </article>
            </div>

            <div class="action-card">
              <div>
                <p class="action-kicker">{{ t('homeDashboard.actionKicker') }}</p>
                <strong>{{ selectedFacility?.name || t('homeDashboard.noSelectionTitle') }}</strong>
                <span>{{ selectedFacilityActionText }}</span>
              </div>
              <el-button type="primary" :disabled="!selectedFacility" @click="openFacility()">
                {{ t('homeDashboard.openSelected') }}
              </el-button>
            </div>
          </section>

          <section class="panel panel--views">
            <div class="panel-header panel-header--tight">
              <div>
                <h2>{{ t('homeDashboard.viewsTitle') }}</h2>
              </div>
            </div>

            <div v-if="loadingDetail" class="state-card state-card--compact">
              <el-skeleton :rows="4" animated />
            </div>

            <div v-else-if="selectedViews.length === 0" class="state-card state-card--compact">
              <el-empty :description="t('homeDashboard.emptyViews')" />
            </div>

            <div v-else class="view-stack">
              <article
                v-for="view in selectedViews"
                :key="view.id"
                class="view-row"
              >
                <div class="view-thumb">
                  <img v-if="resolveMediaSrc(view.thumbnail)" :src="resolveMediaSrc(view.thumbnail) || ''" :alt="view.name" />
                  <div v-else class="view-thumb-fallback">
                    <span>{{ getInitials(view.name) }}</span>
                  </div>
                </div>

                <div class="view-copy">
                  <div class="view-title-line">
                    <strong>{{ view.name }}</strong>
                    <span v-if="view.isDefault" class="default-badge">{{ t('facilities.setDefaultView') }}</span>
                  </div>
                  <span>{{ t('homeDashboard.viewUpdatedAt', { date: formatTimestamp(view.updatedAt) }) }}</span>
                </div>
              </article>
            </div>
          </section>
        </aside>
      </section>
    </section>
  </ConsoleShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import ConsoleShell from '@/components/dashboard/ConsoleShell.vue';
import { getFacilityDetail, getFacilities } from '@/services/api/facilities';
import { activateModelFile } from '@/services/api/models';
import { useAuthStore } from '@/stores/auth';
import { useModelsStore } from '@/stores/models';
import type { FacilityDetail, FacilityModelSummary, FacilityModelView, FacilitySummary } from '@/types/facility';
import { loadRecentFacilityEntries, recordRecentFacilityVisit, sortFacilitiesByRecentVisits } from '@/utils/recentFacilities';

const router = useRouter();
const { t, locale } = useI18n();
const authStore = useAuthStore();
const modelsStore = useModelsStore();

const loadingList = ref(false);
const loadingDetail = ref(false);
const facilities = ref<FacilitySummary[]>([]);
const recentFacilityEntries = ref(loadRecentFacilityEntries(null));
const selectedFacilityId = ref<number | null>(null);
const selectedFacility = ref<FacilityDetail | null>(null);
const apiBase = import.meta.env.VITE_API_URL || window.location.origin;

const recentOrderedFacilities = computed(() => sortFacilitiesByRecentVisits(facilities.value, recentFacilityEntries.value));
const recentFacilities = computed(() => recentOrderedFacilities.value.slice(0, 4));

const portfolioSummary = computed(() => ({
  facilities: facilities.value.length,
  activeFacilities: facilities.value.filter((facility) => facility.status === 'active').length,
  assets: facilities.value.reduce((total, facility) => total + facility.assetCount, 0),
  spaces: facilities.value.reduce((total, facility) => total + facility.spaceCount, 0),
  views: facilities.value.reduce((total, facility) => total + facility.viewCount, 0),
  iot: facilities.value.reduce((total, facility) => total + facility.iotCount, 0),
}));

const selectedModel = computed<FacilityModelSummary | null>(() => {
  if (!selectedFacility.value) {
    return null;
  }

  return (
    selectedFacility.value.models.find((model) => model.id === selectedFacility.value?.defaultModelId) ||
    selectedFacility.value.models[0] ||
    null
  );
});

const selectedViews = computed<FacilityModelView[]>(() => selectedModel.value?.views.slice(0, 5) || []);
const selectedViewCount = computed(() => selectedFacility.value?.viewCount || 0);
const liveSessions = computed(() => Math.max(selectedFacility.value?.assetCount || 0, 1));
const syncJobs = computed(() => Math.max(selectedFacility.value?.models.length || 0, 0));
const statusPanelTitle = computed(() => selectedFacility.value?.name || t('homeDashboard.statusTitle'));
const healthScore = computed(() => {
  if (!selectedFacility.value) {
    return 0;
  }

  const raw = 72 + Math.min(selectedFacility.value.assetCount, 18) + Math.min(selectedFacility.value.viewCount, 10);
  return Math.min(raw, 96);
});

const selectedFacilityActionText = computed(() => {
  if (!selectedFacility.value) {
    return t('homeDashboard.noSelectionDescription');
  }

  return t('homeDashboard.actionDescription', {
    count: selectedViews.value.length,
    facility: selectedFacility.value.name,
  });
});

watch(selectedFacilityId, async (facilityId) => {
  if (!facilityId) {
    selectedFacility.value = null;
    return;
  }

  await loadFacilityDetail(facilityId);
});

onMounted(async () => {
  recentFacilityEntries.value = loadRecentFacilityEntries(authStore.user?.id || authStore.user?.username || null);
  await loadFacilities();
});

async function loadFacilities() {
  loadingList.value = true;
  try {
    const data = await getFacilities();
    facilities.value = data;

    if (!selectedFacilityId.value || !data.some((item) => item.id === selectedFacilityId.value)) {
      selectedFacilityId.value = recentOrderedFacilities.value[0]?.id || data[0]?.id || null;
    }

    enrichFacilityPreviews(data);
  } catch (error) {
    console.error('Failed to load home facilities:', error);
    ElMessage.error((error as Error).message || t('homeDashboard.loadFailed'));
  } finally {
    loadingList.value = false;
  }
}

async function enrichFacilityPreviews(items: FacilitySummary[]) {
  const results = await Promise.allSettled(
    items.slice(0, 6).map(async (facility) => {
      const detail = await getFacilityDetail(facility.id);
      const preview = detail?.models.flatMap((model) => model.views).find((view) => view.thumbnail)?.thumbnail || null;
      return { id: facility.id, preview };
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
      facilities.value = facilities.value.map((facility) => (
        facility.id === detail.id
          ? {
              ...facility,
              description: detail.description,
              address: detail.address,
              previewThumbnail:
                detail.previewThumbnail ||
                detail.models.flatMap((model) => model.views).find((view) => view.thumbnail)?.thumbnail ||
                facility.previewThumbnail ||
                null,
              modelCount: detail.modelCount,
              viewCount: detail.viewCount,
            }
          : facility
      ));
    }
  } catch (error) {
    console.error('Failed to load facility detail for home:', error);
    ElMessage.error((error as Error).message || t('homeDashboard.detailFailed'));
  } finally {
    loadingDetail.value = false;
  }
}

function selectFacility(facilityId: number) {
  selectedFacilityId.value = facilityId;
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
    recentFacilityEntries.value = recordRecentFacilityVisit(
      targetFacilityId,
      authStore.user?.id || authStore.user?.username || null,
    );
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
                ...(defaultView
                  ? {
                      viewId: String(defaultView.id),
                      viewName: defaultView.name,
                    }
                  : {}),
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
    console.error('Failed to open facility from home:', error);
    ElMessage.error((error as Error).message || t('facilities.openFailed'));
  }
}

function pickOpenModel(detail: FacilityDetail | null): FacilityModelSummary | null {
  if (!detail || detail.models.length === 0) {
    return null;
  }

  return detail.models.find((model) => model.id === detail.defaultModelId) || detail.models[0];
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

function resolvePreviewSrc(facility: FacilitySummary | FacilityDetail) {
  return resolveMediaSrc(facility.coverImagePath || facility.previewThumbnail || null);
}

function resolveMediaSrc(path: string | null | undefined) {
  if (!path) {
    return null;
  }

  if (/^(https?:|data:|blob:)/.test(path)) {
    return path;
  }

  return new URL(path, apiBase).toString();
}

function getInitials(name: string) {
  return name
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase())
    .join('') || 'TS';
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale.value === 'zh-CN' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
</script>

<style scoped>
.home-dashboard {
  width: min(80vw, 1560px);
  margin: 0 auto;
  padding: 28px 0 40px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: calc(100vh - 64px);
}

.dashboard-header,
.panel {
  background: color-mix(in srgb, var(--md-sys-color-surface-container) 92%, transparent);
  border: 1px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 88%, transparent);
  border-radius: 16px;
}

.dashboard-header {
  padding: 18px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.page-kicker,
.panel-kicker,
.action-kicker {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--md-sys-color-primary);
}

.title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.title-row h1,
.panel-header h2 {
  margin: 0;
}

.title-row h1 {
  font-size: clamp(24px, 2.8vw, 32px);
  line-height: 1.1;
  letter-spacing: -0.03em;
}

.page-description {
  margin: 6px 0 0;
  max-width: 720px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--md-sys-color-on-surface-variant);
}

.header-badges,
.detail-summary-chips {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.status-chip,
.sync-chip,
.status-chip--muted {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.status-chip {
  color: var(--md-sys-color-primary);
  background: color-mix(in srgb, var(--md-sys-color-primary) 16%, transparent);
}

.sync-chip,
.status-chip--muted {
  color: var(--md-sys-color-on-surface-variant);
  background: var(--md-sys-color-surface-container-high);
}

.summary-strip {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.summary-card {
  position: relative;
  overflow: hidden;
  min-height: 104px;
  padding: 14px 16px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--md-sys-color-surface-container-high) 88%, transparent);
  border: 1px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 72%, transparent);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 6px;
}

.summary-card--primary {
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--md-sys-color-primary) 18%, var(--md-sys-color-surface-container-high)) 0%, var(--md-sys-color-surface-container-high) 100%);
}

.summary-card::after {
  content: '';
  position: absolute;
  inset: auto auto -10% 54%;
  width: 170px;
  height: 96px;
  opacity: 0.18;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
  pointer-events: none;
}

.summary-card--network::after {
  background-image: url("data:image/svg+xml,%3Csvg width='170' height='96' viewBox='0 0 170 96' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M24 68L58 36L98 52L136 20' stroke='%2387D1EB' stroke-width='2.2' stroke-linecap='round'/%3E%3Ccircle cx='24' cy='68' r='5.5' stroke='%2387D1EB' stroke-width='2'/%3E%3Ccircle cx='58' cy='36' r='5.5' stroke='%2387D1EB' stroke-width='2'/%3E%3Ccircle cx='98' cy='52' r='5.5' stroke='%2387D1EB' stroke-width='2'/%3E%3Ccircle cx='136' cy='20' r='5.5' stroke='%2387D1EB' stroke-width='2'/%3E%3C/svg%3E");
}

.summary-card--assets::after {
  background-image: url("data:image/svg+xml,%3Csvg width='170' height='96' viewBox='0 0 170 96' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='26' y='24' width='34' height='46' rx='4' stroke='%2387D1EB' stroke-width='2'/%3E%3Crect x='68' y='38' width='34' height='32' rx='4' stroke='%2387D1EB' stroke-width='2'/%3E%3Crect x='110' y='16' width='34' height='54' rx='4' stroke='%2387D1EB' stroke-width='2'/%3E%3Cpath d='M43 24V14M85 38V28M127 16V6' stroke='%2387D1EB' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");
}

.summary-card--views::after {
  background-image: url("data:image/svg+xml,%3Csvg width='170' height='96' viewBox='0 0 170 96' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='28' y='22' width='48' height='32' rx='6' stroke='%2387D1EB' stroke-width='2'/%3E%3Crect x='94' y='22' width='48' height='32' rx='6' stroke='%2387D1EB' stroke-width='2'/%3E%3Cpath d='M52 60C52 66.627 57.373 72 64 72H106C112.627 72 118 66.627 118 60' stroke='%2387D1EB' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='M64 54V72M106 54V72' stroke='%2387D1EB' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");
}

.summary-card p,
.summary-card span,
.status-card span,
.status-card small,
.action-card span,
.tile-subtitle,
.tile-footer span,
.view-copy span {
  color: var(--md-sys-color-on-surface-variant);
}

.summary-card p,
.status-card span {
  margin: 0;
  font-size: 11px;
}

.summary-card strong,
.status-highlight strong,
.status-card strong {
  font-size: 22px;
  line-height: 1;
}

.summary-card span,
.status-card small {
  font-size: 11px;
  line-height: 1.4;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(340px, 0.95fr);
  gap: 24px;
  align-items: start;
}

.main-column,
.side-column {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.panel {
  padding: 22px;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.panel-header--tight {
  margin-bottom: 16px;
}

.panel-link,
.open-link {
  color: var(--md-sys-color-primary);
  text-decoration: none;
  font-weight: 600;
}

.open-link {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.facility-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.facility-tile {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 82%, transparent);
  background: color-mix(in srgb, var(--md-sys-color-surface-container-low) 35%, var(--md-sys-color-surface-container));
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.facility-tile:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--md-sys-color-primary) 48%, transparent);
  box-shadow: 0 18px 32px rgba(0, 0, 0, 0.12);
}

.facility-tile.active {
  border-color: color-mix(in srgb, var(--md-sys-color-primary) 72%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--md-sys-color-primary) 24%, transparent);
}

.tile-media {
  position: relative;
  aspect-ratio: 16 / 9;
  min-height: 150px;
  border-radius: 12px;
  overflow: hidden;
  background: linear-gradient(135deg, color-mix(in srgb, var(--md-sys-color-primary) 28%, transparent), var(--md-sys-color-surface-container-high));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--md-sys-color-outline-variant) 74%, transparent);
}

.tile-media::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 20%, rgba(16, 18, 22, 0.24) 100%);
  pointer-events: none;
}

.tile-media.active::before {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid color-mix(in srgb, var(--md-sys-color-primary) 72%, transparent);
  border-radius: inherit;
  z-index: 1;
}

.tile-image,
.view-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.facility-tile:hover .tile-image {
  transform: scale(1.03);
}

.tile-image {
  transition: transform 0.28s ease;
}

.tile-fallback,
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

.tile-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.tile-topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.tile-topline h3 {
  margin: 0;
  font-size: 24px;
  line-height: 1.2;
}

.tile-subtitle {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tile-status {
  flex-shrink: 0;
  min-height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
}

.tile-status.active {
  color: var(--md-sys-color-primary);
  background: color-mix(in srgb, var(--md-sys-color-primary) 16%, transparent);
}

.tile-status.archived {
  color: var(--md-sys-color-on-surface-variant);
  background: var(--md-sys-color-surface-container-high);
}

.tile-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.metric-pill {
  padding: 10px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--md-sys-color-surface-container-highest) 82%, transparent);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.metric-pill span {
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

.metric-pill strong {
  font-size: 20px;
}

.tile-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}

.status-highlight {
  padding: 18px 20px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--md-sys-color-primary) 18%, var(--md-sys-color-surface-container-high)) 0%, var(--md-sys-color-surface-container-highest) 100%);
  margin-bottom: 16px;
}

.status-highlight p,
.action-card p {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--md-sys-color-on-surface-variant);
}

.health-indicator {
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  background: rgba(125, 194, 66, 0.14);
  color: #8ccf4d;
  font-size: 12px;
  font-weight: 700;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.status-card,
.action-card {
  padding: 16px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--md-sys-color-surface-container-high) 88%, transparent);
  border: 1px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 66%, transparent);
}

.status-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-card {
  margin-top: 12px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.action-card strong,
.view-copy strong {
  display: block;
  margin-bottom: 8px;
}

.view-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.view-row {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 66%, transparent);
  background: color-mix(in srgb, var(--md-sys-color-surface-container-low) 32%, var(--md-sys-color-surface-container));
}

.view-thumb {
  width: 88px;
  height: 64px;
  border-radius: 12px;
  overflow: hidden;
  background: linear-gradient(135deg, color-mix(in srgb, var(--md-sys-color-primary) 28%, transparent), var(--md-sys-color-surface-container-high));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--md-sys-color-outline-variant) 74%, transparent);
}

.view-title-line {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.default-badge {
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--md-sys-color-primary);
  background: color-mix(in srgb, var(--md-sys-color-primary) 14%, transparent);
}

.state-card {
  min-height: 220px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  background: color-mix(in srgb, var(--md-sys-color-surface-container-low) 32%, var(--md-sys-color-surface-container));
}

.state-card--compact {
  min-height: 180px;
}

@media (max-width: 1280px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .summary-strip {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 920px) {
  .home-dashboard {
    width: auto;
    padding: 20px;
  }

  .title-row,
  .action-card,
  .tile-topline,
  .tile-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .facility-grid,
  .status-grid,
  .tile-metrics {
    grid-template-columns: 1fr;
  }

  .view-row {
    grid-template-columns: 1fr;
  }

  .view-thumb {
    width: 100%;
    height: 150px;
  }
}
</style>
