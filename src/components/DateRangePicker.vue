<template>
  <Teleport to="body">
    <div v-if="visible" class="date-picker-overlay" @click.self="close">
      <div class="date-picker-modal">
        <!-- Header -->
        <div class="picker-header">
          <span class="picker-title">{{ t('timeline.selectDateRange') }}</span>
          <button class="close-btn" @click="close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Calendar -->
        <div class="calendar-widget">
          <div class="cal-header">
            <button @click="changeMonth(-1)">&#9664;</button>
            <span>{{ calendarTitle }}</span>
            <button @click="changeMonth(1)">&#9654;</button>
          </div>
          <div class="cal-grid">
            <div class="cal-day-name" v-for="(d, idx) in calendarDayNames" :key="idx">{{ d }}</div>
            <div
              v-for="(day, idx) in calendarDays"
              :key="idx"
              class="cal-day"
              :class="{
                'empty': !day.inMonth,
                'selected': isDaySelected(day.date),
                'in-range': isDayInRange(day.date)
              }"
              @click="handleDayClick(day)"
            >
              {{ day.date ? day.date.getDate() : '' }}
            </div>
          </div>

          <!-- Range Preview -->
          <div class="range-preview">
            <div class="preview-box">
              <label>{{ t('timeline.startDate') }}</label>
              <span :class="{ placeholder: !tempStart }">
                {{ formatDate(tempStart) || t('common.select') }}
              </span>
            </div>
            <div class="arrow">→</div>
            <div class="preview-box">
              <label>{{ t('timeline.endDate') }}</label>
              <span :class="{ placeholder: !tempEnd }">
                {{ formatDate(tempEnd) || t('common.select') }}
              </span>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="picker-footer">
          <button class="btn-cancel" @click="close">{{ t('common.cancel') }}</button>
          <button class="btn-apply" @click="apply" :disabled="!tempStart || !tempEnd">
            {{ t('common.apply') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  modelValue: {
    type: Object,
    default: () => ({ start: null, end: null })
  }
});

const emit = defineEmits(['update:visible', 'update:modelValue', 'apply']);

const { t, locale } = useI18n();

// Internal state
const calendarViewDate = ref(new Date());
const tempStart = ref(null);
const tempEnd = ref(null);

// Watch for visibility changes to sync initial values
watch(() => props.visible, (newVal) => {
  if (newVal) {
    tempStart.value = props.modelValue?.start ? new Date(props.modelValue.start) : null;
    tempEnd.value = props.modelValue?.end ? new Date(props.modelValue.end) : null;
    calendarViewDate.value = tempStart.value || new Date();
  }
});

// Computed properties
const calendarDayNames = computed(() => [
  t('calendar.sun'),
  t('calendar.mon'),
  t('calendar.tue'),
  t('calendar.wed'),
  t('calendar.thu'),
  t('calendar.fri'),
  t('calendar.sat')
]);

const calendarTitle = computed(() => {
  const localeCode = locale.value === 'zh' ? 'zh-CN' : 'en-US';
  return calendarViewDate.value.toLocaleDateString(localeCode, { month: 'long', year: 'numeric' });
});

const calendarDays = computed(() => {
  const y = calendarViewDate.value.getFullYear();
  const m = calendarViewDate.value.getMonth();
  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);
  const days = [];
  
  // Add empty days for alignment
  for (let i = 0; i < firstDay.getDay(); i++) {
    days.push({ date: null, inMonth: false });
  }
  
  // Add days of month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(y, m, i), inMonth: true });
  }
  
  return days;
});

// Methods
const changeMonth = (delta) => {
  const newDate = new Date(calendarViewDate.value);
  newDate.setMonth(newDate.getMonth() + delta);
  calendarViewDate.value = newDate;
};

const isSameDay = (d1, d2) => {
  return d1 && d2 && d1.toDateString() === d2.toDateString();
};

const isDaySelected = (date) => {
  return isSameDay(date, tempStart.value) || isSameDay(date, tempEnd.value);
};

const isDayInRange = (date) => {
  return date && tempStart.value && tempEnd.value && 
    date > tempStart.value && date < tempEnd.value;
};

const handleDayClick = (day) => {
  if (!day.date) return;
  
  if (!tempStart.value || (tempStart.value && tempEnd.value)) {
    // Start new selection
    tempStart.value = day.date;
    tempEnd.value = null;
  } else {
    // Complete selection
    if (day.date < tempStart.value) {
      tempEnd.value = tempStart.value;
      tempStart.value = day.date;
    } else {
      tempEnd.value = day.date;
    }
  }
};

const formatDate = (date) => {
  return date ? date.toLocaleDateString() : '';
};

const close = () => {
  emit('update:visible', false);
};

const apply = () => {
  if (tempStart.value && tempEnd.value) {
    const endDate = new Date(tempEnd.value);
    endDate.setHours(23, 59, 59);
    
    emit('update:modelValue', {
      start: new Date(tempStart.value),
      end: endDate
    });
    emit('apply', {
      start: new Date(tempStart.value),
      end: endDate
    });
    close();
  }
};
</script>

<style scoped>
.date-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
}

.date-picker-modal {
  background: #2d2d2d;
  border-radius: 8px;
  min-width: 300px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  border: 1px solid #444;
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #3e3e3e;
  background: #252526;
  border-radius: 8px 8px 0 0;
}

.picker-title {
  font-weight: 600;
  font-size: 14px;
  color: #fff;
}

.close-btn {
  background: none;
  border: none;
  color: #aaa;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn svg {
  width: 16px;
  height: 16px;
}

.close-btn:hover {
  color: #fff;
}

.calendar-widget {
  padding: 16px;
}

.cal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.cal-header button {
  background: transparent;
  border: 1px solid #444;
  color: #ccc;
  border-radius: 4px;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 10px;
}

.cal-header button:hover {
  border-color: #777;
  color: #fff;
}

.cal-header span {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  text-align: center;
  margin-bottom: 16px;
}

.cal-day-name {
  font-size: 10px;
  color: #777;
  padding-bottom: 6px;
}

.cal-day {
  font-size: 12px;
  padding: 8px 4px;
  border-radius: 4px;
  cursor: pointer;
  color: #ddd;
  transition: background 0.15s;
}

.cal-day:hover:not(.empty) {
  background: #3e3e3e;
}

.cal-day.empty {
  cursor: default;
  pointer-events: none;
}

.cal-day.selected {
  background: #0078d4;
  color: #fff;
  font-weight: bold;
}

.cal-day.in-range {
  background: rgba(0, 120, 212, 0.3);
  color: #fff;
}

.range-preview {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1e1e1e;
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid #333;
}

.preview-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preview-box label {
  font-size: 10px;
  color: #777;
}

.preview-box span {
  font-size: 12px;
  color: #fff;
  font-weight: 500;
}

.preview-box span.placeholder {
  color: #555;
  font-style: italic;
}

.arrow {
  color: #555;
  font-size: 14px;
}

.picker-footer {
  padding: 12px 16px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  border-top: 1px solid #3e3e3e;
  background: #252526;
  border-radius: 0 0 8px 8px;
}

.btn-cancel {
  background: transparent;
  border: 1px solid #555;
  color: #ccc;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-cancel:hover {
  border-color: #777;
  color: #fff;
}

.btn-apply {
  background: #0078d4;
  border: none;
  color: #fff;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.btn-apply:hover {
  background: #106ebe;
}

.btn-apply:disabled {
  background: #333;
  color: #777;
  cursor: not-allowed;
}
</style>
