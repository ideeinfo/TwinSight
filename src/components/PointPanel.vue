<template>
  <div class="point-panel">
    <div class="panel-header">
      <span class="title">{{ t('points.moduleTitle') }}</span>
      <div class="actions">
        <el-button
          class="create-btn"
          type="primary"
          size="small"
          :icon="Plus"
          :disabled="!canManage"
          @click="startCreate"
        >
          {{ t('points.createPoint') }}
        </el-button>
      </div>
    </div>

    <div class="toolbar">
      <el-input v-model="filters.keyword" :placeholder="t('points.searchPlaceholder')" clearable />
      <el-select v-model="filters.pointType" clearable :placeholder="t('points.typeLabel')">
        <el-option
          v-for="type in pointTypes"
          :key="type.value"
          :label="type.label"
          :value="type.value"
        />
      </el-select>
      <el-select v-model="filters.targetType" clearable :placeholder="t('points.targetTypeLabel')">
        <el-option :label="t('points.spaceTarget')" value="space" />
        <el-option :label="t('points.assetTarget')" value="asset" />
      </el-select>
    </div>

    <div class="point-list">
      <div v-if="loading" class="empty-state">{{ t('common.loading') }}</div>
      <div v-else-if="points.length === 0" class="empty-state">{{ t('points.empty') }}</div>
      <button
        v-for="point in points"
        v-else
        :key="point.id"
        class="point-row"
        :class="{ selected: point.id === selectedPointId }"
        type="button"
        @click="$emit('select-point', point)"
      >
        <span class="type-dot" :style="{ backgroundColor: getTypeColor(point.pointType) }"></span>
        <span class="point-main">
          <strong>{{ point.name }}</strong>
          <small>{{ point.pointCode }} · {{ getTypeLabel(point.pointType) }}</small>
        </span>
        <span class="point-value">
          {{ formatLatest(point) }}
        </span>
      </button>
    </div>

    <div class="detail-panel">
      <div class="detail-header">
        <span>{{ editingPoint?.id ? t('points.detailTitle') : t('points.newTitle') }}</span>
        <el-button v-if="editingPoint?.id && canManage" text type="danger" size="small" :icon="Delete" @click="requestDelete">
          {{ t('common.delete') }}
        </el-button>
      </div>

      <div class="detail-body">
        <div class="form-row">
          <label>{{ t('points.codeLabel') }}</label>
          <el-input v-model="form.pointCode" :disabled="!canManage" />
        </div>
        <div class="form-row">
          <label>{{ t('points.nameLabel') }}</label>
          <el-input v-model="form.name" :disabled="!canManage" />
        </div>
        <div class="form-row">
          <label>{{ t('points.typeLabel') }}</label>
          <el-select v-model="form.pointType" :disabled="!canManage" style="width: 100%;" @change="syncDataKind">
            <el-option
              v-for="type in pointTypes"
              :key="type.value"
              :label="type.label"
              :value="type.value"
            />
          </el-select>
        </div>
        <div class="form-row">
          <label>{{ t('points.targetTypeLabel') }}</label>
          <el-select v-model="form.targetType" :disabled="!canManage" style="width: 100%;" @change="form.targetCode = ''">
            <el-option :label="t('points.spaceTarget')" value="space" />
            <el-option :label="t('points.assetTarget')" value="asset" />
          </el-select>
        </div>
        <div class="form-row">
          <label>{{ t('points.targetLabel') }}</label>
          <el-select v-model="form.targetCode" filterable :disabled="!canManage" style="width: 100%;">
            <el-option
              v-for="target in targetOptions"
              :key="target.code"
              :label="target.label"
              :value="target.code"
            />
          </el-select>
        </div>
        <div class="form-row two-cols">
          <div>
            <label>{{ t('points.unitLabel') }}</label>
            <el-input v-model="form.unit" :disabled="!canManage || form.dataKind === 'video'" />
          </div>
          <div>
            <label>{{ t('points.multiplierLabel') }}</label>
            <el-input-number v-model="form.multiplier" :disabled="!canManage || form.dataKind === 'video'" :min="0" :step="0.1" controls-position="right" />
          </div>
        </div>
        <div v-if="form.dataKind === 'video'" class="form-row">
          <label>{{ t('points.sourceUrlLabel') }}</label>
          <el-input v-model="form.sourceUrl" :disabled="!canManage" placeholder="HLS / FLV / WebRTC URL" />
        </div>
        <div class="form-row two-cols">
          <div>
            <label>{{ t('points.minLabel') }}</label>
            <el-input-number v-model="form.thresholdMin" :disabled="!canManage || form.dataKind === 'video'" controls-position="right" />
          </div>
          <div>
            <label>{{ t('points.maxLabel') }}</label>
            <el-input-number v-model="form.thresholdMax" :disabled="!canManage || form.dataKind === 'video'" controls-position="right" />
          </div>
        </div>
        <div class="form-row switch-row">
          <label>{{ t('points.enabledLabel') }}</label>
          <el-switch v-model="form.isEnabled" :disabled="!canManage" />
        </div>
      </div>

      <div class="detail-actions">
        <el-button
          v-if="editingPoint?.id && editingPoint.dataKind !== 'video'"
          :icon="Link"
          size="small"
          @click="$emit('copy-stream-url', editingPoint)"
        >
          {{ t('points.copyStreamUrl') }}
        </el-button>
        <el-button type="primary" size="small" :disabled="!canManage || !canSubmit" @click="submit">
          {{ t('common.save') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { Delete, Link, Plus } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';

const props = defineProps({
  points: { type: Array, default: () => [] },
  spaces: { type: Array, default: () => [] },
  assets: { type: Array, default: () => [] },
  latestValues: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
  selectedPointId: { type: Number, default: null }
});

const emit = defineEmits(['create-point', 'delete-point', 'filters-change', 'select-point', 'copy-stream-url', 'update-point']);
const { t } = useI18n();
const authStore = useAuthStore();

const canManage = computed(() => authStore.hasPermission('point:manage'));
const editingPoint = ref(null);

const filters = reactive({
  keyword: '',
  pointType: '',
  targetType: ''
});

const defaultForm = () => ({
  pointCode: '',
  name: '',
  pointType: 'temperature',
  dataKind: 'scalar',
  targetType: 'space',
  targetCode: '',
  unit: '℃',
  multiplier: 1,
  protocol: 'http',
  sourceUrl: '',
  thresholdMin: null,
  thresholdMax: null,
  isEnabled: true
});

const form = reactive(defaultForm());

const pointTypes = computed(() => [
  { value: 'temperature', label: t('points.types.temperature'), color: '#e76f51', unit: '℃' },
  { value: 'humidity', label: t('points.types.humidity'), color: '#2a9d8f', unit: '%' },
  { value: 'illuminance', label: t('points.types.illuminance'), color: '#f4a261', unit: 'lx' },
  { value: 'displacement', label: t('points.types.displacement'), color: '#5e81ac', unit: 'mm' },
  { value: 'vibration', label: t('points.types.vibration'), color: '#b56576', unit: 'mm/s' },
  { value: 'energy', label: t('points.types.energy'), color: '#e9c46a', unit: 'kWh' },
  { value: 'electricity', label: t('points.types.electricity'), color: '#ffb703', unit: 'kWh' },
  { value: 'water', label: t('points.types.water'), color: '#219ebc', unit: 'm³' },
  { value: 'gas', label: t('points.types.gas'), color: '#8d99ae', unit: 'm³' },
  { value: 'video', label: t('points.types.video'), color: '#6c757d', unit: '' }
]);

const targetOptions = computed(() => {
  if (form.targetType === 'asset') {
    return props.assets
      .filter((asset) => asset.mcCode)
      .map((asset) => ({
        code: asset.mcCode,
        label: `${asset.name || asset.mcCode} (${asset.mcCode})`
      }));
  }

  return props.spaces
    .filter((space) => space.code)
    .map((space) => ({
      code: space.code,
      label: `${space.name || space.code} (${space.code})`
    }));
});

const canSubmit = computed(() => (
  form.pointCode.trim() &&
  form.name.trim() &&
  form.pointType &&
  form.targetType &&
  form.targetCode
));

watch(filters, () => {
  emit('filters-change', {
    keyword: filters.keyword.trim() || undefined,
    pointType: filters.pointType || undefined,
    targetType: filters.targetType || undefined
  });
}, { deep: true });

watch(
  () => props.selectedPointId,
  (id) => {
    const point = props.points.find((item) => item.id === id);
    if (point) applyPoint(point);
  }
);

const resetForm = (next = defaultForm()) => {
  Object.assign(form, defaultForm(), next);
};

const applyPoint = (point) => {
  editingPoint.value = point;
  resetForm({
    pointCode: point.pointCode || '',
    name: point.name || '',
    pointType: point.pointType || 'temperature',
    dataKind: point.dataKind || (point.pointType === 'video' ? 'video' : 'scalar'),
    targetType: point.targetType || 'space',
    targetCode: point.targetCode || '',
    unit: point.unit || '',
    multiplier: Number(point.multiplier || 1),
    protocol: point.protocol || 'http',
    sourceUrl: point.sourceUrl || '',
    thresholdMin: point.thresholdMin,
    thresholdMax: point.thresholdMax,
    isEnabled: point.isEnabled !== false
  });
};

const startCreate = () => {
  editingPoint.value = null;
  resetForm();
};

const syncDataKind = () => {
  const meta = pointTypes.value.find((type) => type.value === form.pointType);
  form.dataKind = form.pointType === 'video' ? 'video' : 'scalar';
  if (form.dataKind === 'scalar' && !form.unit) {
    form.unit = meta?.unit || '';
  }
  if (form.dataKind === 'video') {
    form.unit = '';
  }
};

const getTypeLabel = (type) => pointTypes.value.find((item) => item.value === type)?.label || type;
const getTypeColor = (type) => pointTypes.value.find((item) => item.value === type)?.color || '#8a8f98';

const formatLatest = (point) => {
  if (point.dataKind === 'video') return t('points.videoPoint');
  const latest = props.latestValues?.[point.pointCode];
  if (!latest) return '--';
  return `${Number(latest.value).toFixed(1)}${point.unit || ''}`;
};

const requestDelete = () => {
  if (editingPoint.value) {
    emit('delete-point', editingPoint.value);
  }
};

const submit = () => {
  const payload = {
    pointCode: form.pointCode.trim(),
    name: form.name.trim(),
    pointType: form.pointType,
    dataKind: form.dataKind,
    targetType: form.targetType,
    targetCode: form.targetCode,
    unit: form.unit,
    multiplier: form.multiplier,
    protocol: form.protocol,
    sourceUrl: form.sourceUrl,
    thresholdMin: form.thresholdMin,
    thresholdMax: form.thresholdMax,
    isEnabled: form.isEnabled
  };

  if (editingPoint.value?.id) {
    emit('update-point', editingPoint.value.id, payload);
  } else {
    emit('create-point', payload);
  }
};
</script>

<style scoped>
.point-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--md-sys-color-surface-container-low);
  color: var(--md-sys-color-on-surface);
  overflow: hidden;
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
}

.toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.point-list {
  flex: 1;
  min-height: 180px;
  overflow-y: auto;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.empty-state {
  padding: 24px 12px;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 12px;
}

.point-row {
  width: 100%;
  min-height: 54px;
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: none;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface-container-lowest);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.point-row:hover,
.point-row.selected {
  background: color-mix(in srgb, var(--md-sys-color-primary) 12%, var(--md-sys-color-surface-container-lowest));
}

.type-dot {
  width: 8px;
  height: 28px;
}

.point-main {
  min-width: 0;
}

.point-main strong,
.point-main small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.point-main strong {
  font-size: 13px;
}

.point-main small,
.point-value {
  font-size: 11px;
  color: var(--md-sys-color-on-surface-variant);
}

.point-value {
  font-weight: 700;
}

.detail-panel {
  flex: 0 0 380px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--md-sys-color-surface);
}

.detail-header {
  min-height: 38px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  font-weight: 700;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px;
}

.form-row {
  margin-bottom: 10px;
}

.form-row label {
  display: block;
  margin-bottom: 4px;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 11px;
}

.two-cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.detail-actions {
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--md-sys-color-outline-variant);
}

:deep(.el-input__wrapper),
:deep(.el-select__wrapper),
:deep(.el-input-number .el-input__wrapper) {
  border-radius: 2px;
  box-shadow: 0 0 0 1px var(--input-border) inset;
  background: var(--input-bg);
}
</style>
