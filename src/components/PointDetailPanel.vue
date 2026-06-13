<template>
  <div class="point-detail-panel">
    <div class="panel-header">
      <div class="header-copy">
        <div class="panel-title">{{ t('points.detailTitle') }}</div>
        <div class="panel-code">{{ point?.pointCode || '请选择一个点位' }}</div>
      </div>
      <span v-if="point" class="type-pill" :style="{ borderColor: getTypeColor(point.pointType), color: getTypeColor(point.pointType) }">
        {{ getTypeLabel(point.pointType) }}
      </span>
    </div>

    <div v-if="!point" class="empty-state">
      <strong>请选择一个点位</strong>
      <p>点击左侧点位列表或模型气泡后，这里会显示并编辑点位信息。</p>
    </div>

    <template v-else>
      <div class="panel-body">
        <section class="detail-group">
          <div class="group-header">点位信息</div>
          <div class="group-body">
            <div class="row">
              <label>{{ t('points.codeLabel') }}</label>
              <div class="editor-box">
                <el-input v-model="form.pointCode" :disabled="!canManage" />
              </div>
            </div>
            <div class="row">
              <label>{{ t('points.nameLabel') }}</label>
              <div class="editor-box">
                <el-input v-model="form.name" :disabled="!canManage" />
              </div>
            </div>
            <div class="row">
              <label>{{ t('points.typeLabel') }}</label>
              <div class="editor-box">
                <el-select v-model="form.pointType" :disabled="!canManage" style="width: 100%;" @change="syncDataKind">
                  <el-option
                    v-for="type in pointTypes"
                    :key="type.value"
                    :label="type.label"
                    :value="type.value"
                  />
                </el-select>
              </div>
            </div>
            <div class="row">
              <label>最新值</label>
              <div class="val-box">{{ formatLatest(point) }}</div>
            </div>
          </div>
        </section>

        <section class="detail-group">
          <div class="group-header">绑定对象</div>
          <div class="group-body">
            <div class="row">
              <label>{{ t('points.targetTypeLabel') }}</label>
              <div class="editor-box">
                <el-select v-model="form.targetType" :disabled="!canManage" style="width: 100%;" @change="form.targetCode = ''">
                  <el-option :label="t('points.spaceTarget')" value="space" />
                  <el-option :label="t('points.assetTarget')" value="asset" />
                </el-select>
              </div>
            </div>
            <div class="row">
              <label>{{ t('points.targetLabel') }}</label>
              <div class="editor-box">
                <el-select v-model="form.targetCode" filterable :disabled="!canManage" style="width: 100%;">
                  <el-option
                    v-for="target in targetOptions"
                    :key="target.code"
                    :label="target.label"
                    :value="target.code"
                  />
                </el-select>
              </div>
            </div>
            <div class="row">
              <label>对象名称</label>
              <div class="val-box">{{ point.targetName || point.targetCode || t('common.none') }}</div>
            </div>
          </div>
        </section>

        <section class="detail-group">
          <div class="group-header">采集配置</div>
          <div class="group-body">
            <div class="row">
              <label>{{ t('points.unitLabel') }}</label>
              <div class="editor-box">
                <el-input v-model="form.unit" :disabled="!canManage || form.dataKind === 'video'" />
              </div>
            </div>
            <div class="row">
              <label>{{ t('points.multiplierLabel') }}</label>
              <div class="editor-box">
                <el-input-number v-model="form.multiplier" :disabled="!canManage || form.dataKind === 'video'" :min="0" :step="0.1" controls-position="right" />
              </div>
            </div>
            <div v-if="form.dataKind === 'video'" class="field-block">
              <div class="field-label">{{ t('points.sourceUrlLabel') }}</div>
              <div class="editor-box">
                <el-input v-model="form.sourceUrl" :disabled="!canManage" placeholder="HLS / FLV / WebRTC URL" />
              </div>
            </div>
            <div class="row">
              <label>{{ t('points.minLabel') }}</label>
              <div class="editor-box">
                <el-input-number v-model="form.thresholdMin" :disabled="!canManage || form.dataKind === 'video'" controls-position="right" />
              </div>
            </div>
            <div class="row">
              <label>{{ t('points.maxLabel') }}</label>
              <div class="editor-box">
                <el-input-number v-model="form.thresholdMax" :disabled="!canManage || form.dataKind === 'video'" controls-position="right" />
              </div>
            </div>
            <div class="row">
              <label>{{ t('points.enabledLabel') }}</label>
              <div class="editor-box switch-box">
                <el-switch v-model="form.isEnabled" :disabled="!canManage" />
              </div>
            </div>
          </div>
        </section>

        <section class="detail-group">
          <div class="group-header">时间信息</div>
          <div class="group-body">
            <div class="row">
              <label>创建时间</label>
              <div class="val-box">{{ formatDateTime(point.createdAt) }}</div>
            </div>
            <div class="row">
              <label>更新时间</label>
              <div class="val-box">{{ formatDateTime(point.updatedAt) }}</div>
            </div>
          </div>
        </section>
      </div>

      <div class="panel-actions">
        <el-button
          v-if="point.dataKind !== 'video'"
          :disabled="submitting"
          @click="$emit('copy-stream-url', point)"
        >
          {{ t('points.copyStreamUrl') }}
        </el-button>
        <el-button type="danger" plain :disabled="submitting || !canManage" @click="$emit('delete-point', point)">
          {{ t('common.delete') }}
        </el-button>
        <el-button type="primary" :loading="submitting" :disabled="!canManage || !canSubmit" @click="submit">
          {{ t('common.save') }}
        </el-button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';

const props = defineProps({
  point: { type: Object, default: null },
  spaces: { type: Array, default: () => [] },
  assets: { type: Array, default: () => [] },
  latestValues: { type: Object, default: () => ({}) },
  submitting: { type: Boolean, default: false }
});

const emit = defineEmits(['save-point', 'delete-point', 'copy-stream-url']);
const { t } = useI18n();
const authStore = useAuthStore();

const canManage = computed(() => authStore.hasPermission('point:manage'));

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

const resetForm = () => {
  const point = props.point;
  Object.assign(form, defaultForm(), point ? {
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
  } : {});
};

watch(() => props.point, resetForm, { immediate: true });

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
  if (!point || point.dataKind === 'video') return t('points.videoPoint');
  const latest = props.latestValues?.[point.pointCode];
  if (!latest) return '--';
  return `${Number(latest.value).toFixed(1)}${point.unit || ''}`;
};

const formatDateTime = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('zh-CN', { hour12: false });
};

const submit = () => {
  if (!props.point) return;
  emit('save-point', {
    id: props.point.id,
    payload: {
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
    }
  });
};
</script>

<style scoped>
.point-detail-panel {
  width: 100%;
  height: 100%;
  background: var(--md-sys-color-surface);
  border-left: 1px solid var(--md-sys-color-outline-variant);
  display: flex;
  flex-direction: column;
  font-size: 11px;
  color: var(--md-sys-color-on-surface);
  user-select: none;
  overflow: hidden;
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.panel-header {
  min-height: 56px;
  padding: 10px 12px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface-container-low);
}

.header-copy {
  min-width: 0;
}

.panel-title {
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface-variant);
}

.panel-code {
  font-size: 14px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
  word-break: break-all;
}

.type-pill {
  flex-shrink: 0;
  padding: 3px 8px;
  border: 1px solid currentColor;
  background: color-mix(in srgb, currentColor 12%, transparent);
  font-weight: 700;
}

.empty-state {
  flex: 1;
  margin: 12px;
  border: 1px dashed var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface-container-lowest);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  text-align: center;
  padding: 24px;
}

.empty-state p {
  margin: 0;
  color: var(--md-sys-color-on-surface-variant);
  line-height: 1.6;
}

.detail-group {
  border-top: 1px solid var(--md-sys-color-outline-variant);
}

.detail-group:first-of-type {
  border-top: none;
}

.group-header {
  background: var(--md-sys-color-surface-container);
  padding: 8px 12px;
  font-weight: 600;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  color: var(--md-sys-color-on-surface);
}

.group-body {
  padding: 8px 12px;
}

.row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 8px;
}

.row:last-child {
  margin-bottom: 0;
}

.row label,
.field-label {
  flex: 0 0 72px;
  color: var(--md-sys-color-on-surface-variant);
  line-height: 24px;
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}

.editor-box,
.val-box {
  flex: 1;
  min-width: 0;
}

.val-box {
  min-height: 24px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  border: 1px solid var(--input-border);
  background: var(--input-bg);
  color: var(--input-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.switch-box {
  min-height: 24px;
  display: flex;
  align-items: center;
}

.panel-actions {
  margin-top: auto;
  padding: 12px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface-container-low);
}

:deep(.el-input__wrapper),
:deep(.el-select__wrapper),
:deep(.el-input-number .el-input__wrapper) {
  border-radius: 2px;
  box-shadow: 0 0 0 1px var(--input-border) inset;
  background: var(--input-bg);
  color: var(--input-text);
}

:deep(.el-input__wrapper.is-focus),
:deep(.el-select__wrapper.is-focused) {
  box-shadow: 0 0 0 1px var(--md-sys-color-primary) inset;
}

:deep(.el-input__inner),
:deep(.el-select__placeholder),
:deep(.el-select__selected-item) {
  font-size: 11px;
}
</style>
