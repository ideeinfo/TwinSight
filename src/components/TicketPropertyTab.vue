<template>
  <div class="ticket-property-tab">
    <div class="tab-header">
      <span>{{ t('tickets.relatedTickets', { count: tickets.length }) }}</span>
    </div>

    <div v-if="loading" class="state-text">{{ t('common.loading') }}</div>
    <div v-else-if="tickets.length === 0" class="state-text">{{ t('tickets.noTickets') }}</div>

    <div v-else class="ticket-list">
      <button
        v-for="ticket in tickets"
        :key="ticket.id"
        type="button"
        class="ticket-card"
        @click="$emit('locate-ticket', ticket)"
      >
        <div class="ticket-card-top">
          <strong>{{ ticket.ticketNo }}</strong>
          <TicketStatusTag :status="ticket.status" />
        </div>
        <div class="ticket-card-title">{{ ticket.title || ticket.description }}</div>
        <div class="ticket-card-meta">
          <span>{{ ticket.spaceName || ticket.sourceSpaceCode }}</span>
          <span>{{ formatDate(ticket.createdAt) }}</span>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import TicketStatusTag from './TicketStatusTag.vue';
import { listTickets } from '../services/tickets';

const props = defineProps({
  assetCode: { type: String, default: '' },
  spaceCode: { type: String, default: '' },
  fileId: { type: Number, default: null }
});

defineEmits(['locate-ticket']);

const { t } = useI18n();
const loading = ref(false);
const tickets = ref([]);

const formatDate = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const loadData = async () => {
  const assetCode = String(props.assetCode || '').trim();
  const spaceCode = String(props.spaceCode || '').trim();

  if (!assetCode && !spaceCode) {
    tickets.value = [];
    return;
  }

  loading.value = true;
  try {
    tickets.value = await listTickets({
      fileId: props.fileId || undefined,
      ...(assetCode ? { assetCode } : { spaceCode })
    });
  } catch (error) {
    console.error('加载右侧工单列表失败:', error);
    tickets.value = [];
  } finally {
    loading.value = false;
  }
};

watch(() => [props.assetCode, props.spaceCode, props.fileId], loadData, { immediate: true });
</script>

<style scoped>
.ticket-property-tab {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tab-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

.ticket-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ticket-card {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 12px;
  background: var(--md-sys-color-surface-container-low);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.ticket-card:hover {
  border-color: var(--md-sys-color-primary);
  transform: translateY(-1px);
}

.ticket-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.ticket-card-title {
  font-size: 13px;
  color: var(--md-sys-color-on-surface);
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ticket-card-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

.state-text {
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
  padding: 8px 0;
}
</style>
