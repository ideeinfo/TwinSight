<template>
  <div class="ticket-panel">
    <div class="panel-header">
      <span class="title">{{ t('tickets.moduleTitle') }}</span>
      <div class="actions">
        <el-button class="create-btn" type="primary" size="small" @click="$emit('create-ticket')" :disabled="!canCreate">
          {{ t('tickets.createTicket') }}
        </el-button>
        <template v-if="selectedRows.length > 0 && authStore.hasPermission('ticket:delete')">
          <span class="selection-count">{{ t('common.selected', { count: selectedRows.length }) }}</span>
          <el-button class="delete-btn" type="danger" text size="small" @click="$emit('delete-selected', selectedRows)">
            <el-icon><Delete /></el-icon>
            {{ t('common.delete') }}
          </el-button>
        </template>
      </div>
    </div>

    <div class="toolbar">
      <el-input
        v-model="localFilters.keyword"
        :placeholder="t('tickets.searchPlaceholder')"
        clearable
      />
      <el-select v-model="localFilters.status" clearable :placeholder="t('tickets.statusLabel')">
        <el-option :label="t('tickets.statusNew')" value="new" />
        <el-option :label="t('tickets.statusCompleted')" value="completed" />
        <el-option :label="t('tickets.statusClosed')" value="closed" />
      </el-select>
      <el-select v-model="localFilters.assigneeUserId" clearable :placeholder="t('tickets.assigneeLabel')">
        <el-option
          v-for="assignee in assignees"
          :key="assignee.id"
          :label="assignee.name"
          :value="assignee.id"
        />
      </el-select>
    </div>

    <div v-if="createTicketHint" class="filter-chip hint-text">
      {{ createTicketHint }}
    </div>

    <div v-if="markerFilterLabel" class="filter-chip">
      <el-tag closable @close="$emit('clear-marker-filter')">
        {{ t('tickets.markerFilterLabel', { label: markerFilterLabel }) }}
      </el-tag>
    </div>

    <el-table
      ref="tableRef"
      class="ticket-table"
      v-loading="loading"
      :data="tickets"
      row-key="id"
      table-layout="fixed"
      highlight-current-row
      :row-class-name="getRowClassName"
      @selection-change="handleSelectionChange"
      @row-click="$emit('select-ticket', $event)"
    >
      <template #empty>
        <div class="empty-state">{{ t('tickets.noTickets') }}</div>
      </template>

      <el-table-column type="selection" width="38" />
      <el-table-column prop="ticketNo" :label="t('tickets.ticketNoLabel')" min-width="120" show-overflow-tooltip />
      <el-table-column :label="t('tickets.titleLabel')" min-width="100" show-overflow-tooltip>
        <template #default="{ row }">
          <div class="subject-cell">
            <strong class="cell-text">{{ row.title || row.description }}</strong>
          </div>
        </template>
      </el-table-column>
      <el-table-column :label="t('tickets.spaceLabel')" min-width="84" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="cell-text">{{ row.spaceName || row.sourceSpaceCode }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('tickets.assetLabel')" min-width="100" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.assets?.length" class="cell-text">
            {{ formatAssets(row.assets) }}
          </span>
          <span v-else class="muted-text">{{ t('tickets.spaceOnly') }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('tickets.statusLabel')" min-width="72">
        <template #default="{ row }">
          <TicketStatusTag :status="row.status" />
        </template>
      </el-table-column>
      <el-table-column :label="t('tickets.createdAtLabel')" min-width="84">
        <template #default="{ row }">
          <span class="cell-text">{{ formatDate(row.createdAt) }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('tickets.assigneeLabel')" min-width="76" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="cell-text">{{ row.assigneeName || '--' }}</span>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue';
import { Delete } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';
import TicketStatusTag from './TicketStatusTag.vue';

const props = defineProps({
  tickets: { type: Array, default: () => [] },
  assignees: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  selectedTicketId: { type: Number, default: null },
  selectedTicketIds: { type: Array, default: () => [] },
  markerFilterLabel: { type: String, default: '' },
  canCreate: { type: Boolean, default: true },
  createTicketHint: { type: String, default: '' }
});

const emit = defineEmits([
  'clear-marker-filter',
  'create-ticket',
  'delete-selected',
  'filters-change',
  'selection-change',
  'select-ticket'
]);

const { t } = useI18n();
const authStore = useAuthStore();
const tableRef = ref(null);
const selectedRows = ref([]);

const localFilters = reactive({
  keyword: '',
  status: '',
  assigneeUserId: null
});

watch(localFilters, () => {
  emit('filters-change', {
    keyword: localFilters.keyword.trim() || undefined,
    status: localFilters.status || undefined,
    assigneeUserId: localFilters.assigneeUserId || undefined
  });
}, { deep: true });

watch(
  () => props.selectedTicketIds,
  (ids) => {
    if ((ids || []).length === 0) {
      selectedRows.value = [];
      tableRef.value?.clearSelection?.();
    }
  },
  { deep: true }
);

const formatDate = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const formatAssets = (assets = []) => {
  if (assets.length === 0) return '--';
  if (assets.length === 1) {
    return assets[0].name || assets[0].assetCode;
  }
  const first = assets[0].name || assets[0].assetCode;
  return `${first} +${assets.length - 1}`;
};

const getRowClassName = ({ row }) => {
  return row.id === props.selectedTicketId ? 'is-ticket-active' : '';
};

const handleSelectionChange = (rows) => {
  selectedRows.value = rows;
  emit('selection-change', rows.map((row) => row.id));
};
</script>

<style scoped>
.ticket-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--md-sys-color-surface-container-low);
}

.panel-header {
  min-height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.title {
  font-size: 18px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(132px, 0.72fr) minmax(142px, 0.83fr);
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.filter-chip {
  padding: 8px 12px 0;
}

.hint-text {
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

.subject-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.subject-cell strong {
  font-size: 13px;
  color: var(--md-sys-color-on-surface);
}

.cell-text {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.muted-text {
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

.create-btn {
  font-weight: 700;
  box-shadow: none;
}

.selection-count {
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

.delete-btn {
  color: #f56c6c !important;
}

.empty-state {
  padding: 24px 0;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 12px;
}

:deep(.ticket-table) {
  --el-table-bg-color: var(--md-sys-color-surface-container-low);
  --el-table-tr-bg-color: var(--md-sys-color-surface-container-lowest);
  --el-table-header-bg-color: var(--md-sys-color-surface-container-low);
  --el-table-border-color: var(--md-sys-color-outline-variant);
  --el-table-row-hover-bg-color: color-mix(in srgb, var(--md-sys-color-primary) 7%, var(--md-sys-color-surface-container-lowest));
  border-top: 1px solid var(--md-sys-color-outline-variant);
}

:deep(.ticket-table .el-table__inner-wrapper::before) {
  display: none;
}

:deep(.ticket-table th.el-table__cell) {
  background: var(--md-sys-color-surface-container-low);
  color: var(--md-sys-color-on-surface);
  font-weight: 700;
  padding: 11px 6px;
  font-size: 13px;
}

:deep(.ticket-table td.el-table__cell) {
  color: var(--md-sys-color-on-surface);
  background: transparent;
  padding: 10px 6px;
}

:deep(.ticket-table .el-table__body tr > td.el-table__cell) {
  background: var(--md-sys-color-surface-container-lowest);
  transition: background-color 0.18s ease;
}

:deep(.ticket-table .el-table__body tr:hover > td.el-table__cell) {
  background: color-mix(in srgb, var(--md-sys-color-primary) 7%, var(--md-sys-color-surface-container-lowest));
}

:deep(.ticket-table .el-table__body tr.is-ticket-active > td.el-table__cell) {
  background: color-mix(in srgb, var(--md-sys-color-primary) 15%, var(--md-sys-color-surface-container-lowest));
}

:deep(.ticket-table .el-table__body tr.is-ticket-active:hover > td.el-table__cell) {
  background: color-mix(in srgb, var(--md-sys-color-primary) 19%, var(--md-sys-color-surface-container-lowest));
}

:deep(.ticket-table .el-table__body tr) {
  cursor: pointer;
}

:deep(.ticket-table colgroup col:first-child) {
  width: 38px !important;
}
</style>
