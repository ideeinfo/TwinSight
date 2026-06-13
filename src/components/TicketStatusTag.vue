<template>
  <span class="ticket-status-tag" :class="`status-${status}`">
    {{ label }}
  </span>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  status: {
    type: String,
    default: 'new'
  }
});

const { t } = useI18n();

const label = computed(() => {
  if (props.status === 'completed') return t('tickets.statusCompleted');
  if (props.status === 'closed') return t('tickets.statusClosed');
  return t('tickets.statusNew');
});
</script>

<style scoped>
.ticket-status-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
}

.status-new {
  background: rgba(232, 138, 44, 0.14);
  color: #d9730d;
}

.status-completed {
  background: rgba(34, 179, 126, 0.14);
  color: #1f8f66;
}

.status-closed {
  background: rgba(113, 119, 129, 0.16);
  color: #59616b;
}
</style>
