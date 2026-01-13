<template>
  <el-dialog
    :model-value="visible"
    :title="t('timeline.selectDateRange')"
    width="400px"
    :close-on-click-modal="false"
    destroy-on-close
    class="custom-dialog date-range-dialog"
    @update:model-value="$emit('update:visible', $event)"
  >
    <div class="calendar-widget">
      <div class="cal-header">
        <el-button size="small" circle @click="changeMonth(-1)"><el-icon><ArrowLeft /></el-icon></el-button>
        <span class="cal-title">{{ calendarTitle }}</span>
        <el-button size="small" circle @click="changeMonth(1)"><el-icon><ArrowRight /></el-icon></el-button>
      </div>
      <div class="cal-grid">
        <div v-for="(d, idx) in calendarDayNames" :key="idx" class="cal-day-name">{{ d }}</div>
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

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="close">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :disabled="!tempStart || !tempEnd" @click="apply">
          {{ t('common.apply') }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Close, ArrowLeft, ArrowRight } from '@element-plus/icons-vue';

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
/* 模态框样式移除，使用 el-dialog */
.calendar-widget {
  padding: 10px;
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




</style>
