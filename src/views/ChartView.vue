<template>
  <div class="full-chart-container">
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>正在加载数据...</p>
    </div>
    <div v-else-if="error" class="error-state">
      <p>加载失败: {{ error }}</p>
    </div>
    <ChartPanel 
      v-else 
      :data="chartData" 
      :range="dateRange" 
      :label-text="title"
      class="fullscreen-chart"
      @close="closeWindow"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import ChartPanel from '../components/ChartPanel.vue';

const route = useRoute();
const loading = ref(true);
const error = ref(null);
const chartData = ref([]);
const dateRange = ref(null);

const title = computed(() => {
  const room = route.query.room || 'Unknown';
  return `${room} 温度趋势 (全屏模式)`;
});

const closeWindow = () => {
  window.close();
};

const fetchData = async () => {
  try {
    const { room, start, end } = route.query;
    if (!room) throw new Error('缺少房间编号');

    // 默认最近24小时
    const endTime = end ? parseInt(end) : Date.now();
    const startTime = start ? parseInt(start) : endTime - 24 * 3600 * 1000;
    
    dateRange.value = { startMs: startTime, endMs: endTime };

    // 计算合适的聚合窗口
    const duration = endTime - startTime;
    let windowStr = '15m'; // default
    if (duration > 7 * 24 * 3600 * 1000) windowStr = '1d';
    else if (duration > 24 * 3600 * 1000) windowStr = '1h';

    const url = `/api/v1/timeseries/query?roomCode=${encodeURIComponent(room)}&start=${startTime}&end=${endTime}&aggregateWindow=${windowStr}`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    
    const json = await res.json();
    // Support both wrapped {success:true, data: []} and direct [] formats
    const data = Array.isArray(json) ? json : (json.data || []);
    
    chartData.value = data;
    
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchData();
  document.title = title.value;
});
</script>

<style scoped>
.full-chart-container {
  width: 100vw;
  height: 100vh;
  background: #1e1e1e;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.loading-state, .error-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #ccc;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255,255,255,0.1);
  border-radius: 50%;
  border-top-color: #00f2ff;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.fullscreen-chart {
  width: 100%;
  height: 100%;
}
</style>
