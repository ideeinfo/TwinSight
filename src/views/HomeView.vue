<template>
  <div class="digital-twin-home">
    <!-- Hero Section with 3D Background -->
    <section class="hero-section">
      <div class="hero-background">
        <div class="grid-overlay"></div>
        <div class="floating-data">
          <div v-for="i in 12" :key="i" class="data-point" :style="getDataPointStyle(i)"></div>
        </div>
        <div class="gradient-mesh"></div>
      </div>

      <div class="hero-content">
        <div v-animate="{ delay: 0 }" class="hero-badge">
          <span class="pulse-dot"></span>
          <span>{{ $t('home.liveSystem') }}</span>
        </div>

        <h1 v-animate="{ delay: 100 }" class="hero-title">
          <span class="title-line">{{ $t('home.titleLine1') }}</span>
          <span class="title-line title-highlight">{{ $t('home.titleLine2') }}</span>
        </h1>

        <p v-animate="{ delay: 200 }" class="hero-description">
          {{ $t('home.description') }}
        </p>

        <div v-animate="{ delay: 300 }" class="hero-actions">
          <button class="btn-primary" @click="handleLaunchViewer">
            <span>{{ $t('home.launchViewer') }}</span>
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
          <button class="btn-secondary" @click="router.push('/viewer')">
            <span>{{ $t('home.exploreData') }}</span>
          </button>
        </div>

        <!-- Quick Stats -->
        <div v-animate="{ delay: 400 }" class="hero-stats">
          <div v-for="stat in quickStats" :key="stat.label" class="stat-item">
            <div class="stat-value">{{ stat.value }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </div>
      </div>

      <!-- Scroll Indicator -->
      <div v-animate="{ delay: 500 }" class="scroll-indicator">
        <div class="mouse">
          <div class="wheel"></div>
        </div>
      </div>
    </section>

    <!-- Features Grid -->
    <section class="features-section">
      <div class="section-header">
        <span v-animate class="section-tag">// {{ $t('home.capabilities') }}</span>
        <h2 v-animate class="section-title">{{ $t('home.featureTitle') }}</h2>
      </div>

      <div class="features-grid">
        <div
          v-for="(feature, index) in features"
          :key="feature.title"
          v-animate="{ delay: index * 100 }"
          class="feature-card"
          @mouseenter="feature.hovered = true"
          @mouseleave="feature.hovered = false"
        >
          <div class="card-background" :class="feature.colorScheme"></div>
          <div class="card-content">
            <div class="feature-icon">
              <component :is="feature.icon" />
            </div>
            <h3 class="feature-title">{{ $t(feature.title) }}</h3>
            <p class="feature-description">{{ $t(feature.description) }}</p>
            <div class="feature-metrics">
              <span v-for="metric in feature.metrics" :key="metric" class="metric">
                {{ metric }}
              </span>
            </div>
          </div>
          <div class="card-border"></div>
        </div>
      </div>
    </section>

    <!-- Data Visualization Preview -->
    <section class="preview-section">
      <div class="preview-container">
        <div v-animate class="preview-info">
          <h2 class="section-title">{{ $t('home.monitoringTitle') }}</h2>
          <p class="section-description">{{ $t('home.monitoringDesc') }}</p>

          <div class="preview-metrics">
            <div v-for="metric in previewMetrics" :key="metric.label" class="metric-row">
              <div class="metric-info">
                <span class="metric-label">{{ $t(metric.label) }}</span>
                <span class="metric-value" :class="metric.status">{{ metric.value }}</span>
              </div>
              <div class="metric-bar">
                <div class="bar-fill" :style="{ width: metric.percentage, backgroundColor: metric.color }"></div>
              </div>
            </div>
          </div>
        </div>

        <div v-animate="{ delay: 200 }" class="preview-visual">
          <div class="building-model">
            <div v-for="i in 5" :key="i" class="model-floor" :style="{ animationDelay: `${i * 0.1}s` }">
              <div class="floor-rooms">
                <div v-for="j in 8" :key="j" class="room"></div>
              </div>
            </div>
            <div class="model-data-points">
              <div v-for="i in 16" :key="i" class="data-point-marker" :style="getMarkerStyle(i)"></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="cta-section">
      <div v-animate class="cta-content">
        <h2 class="cta-title">{{ $t('home.ctaTitle') }}</h2>
        <p class="cta-description">{{ $t('home.ctaDescription') }}</p>
        <div class="cta-actions">
          <button class="btn-large btn-primary" @click="handleLaunchViewer">
            {{ $t('home.getStarted') }}
          </button>
          <button class="btn-large btn-outline" @click="showDocs = true">
            {{ $t('home.viewDocs') }}
          </button>
        </div>
      </div>
      <div class="cta-background">
        <div class="gradient-orb orb-1"></div>
        <div class="gradient-orb orb-2"></div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="home-footer">
      <div class="footer-content">
        <div class="footer-brand">
          <div class="brand-logo">
            <svg viewBox="0 0 40 40" fill="none">
              <path d="M20 4L36 36H4L20 4Z" stroke="currentColor" stroke-width="2" />
              <circle cx="20" cy="24" r="6" fill="currentColor" />
            </svg>
          </div>
          <span class="brand-name">TANDEM</span>
        </div>
        <div class="footer-links">
          <a href="#" class="footer-link">{{ $t('home.documentation') }}</a>
          <a href="#" class="footer-link">{{ $t('home.support') }}</a>
          <a href="#" class="footer-link">{{ $t('home.about') }}</a>
        </div>
      </div>
    </footer>

    <!-- 登录对话框 -->
    <LoginDialog v-model="showLoginDialog" @success="onLoginSuccess" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import Icon3D from '../components/icons/Icon3D.vue';
import IconAssets from '../components/icons/IconAssets.vue';
import IconIoT from '../components/icons/IconIoT.vue';
import IconAI from '../components/icons/IconAI.vue';
import IconDocs from '../components/icons/IconDocs.vue';
import IconExport from '../components/icons/IconExport.vue';
import LoginDialog from '../components/LoginDialog.vue';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const { t } = useI18n();
const authStore = useAuthStore();
const showDocs = ref(false);
const showLoginDialog = ref(false);

// 处理启动查看器按钮点击
const handleLaunchViewer = () => {
  if (authStore.isAuthenticated) {
    router.push('/viewer');
  } else {
    showLoginDialog.value = true;
  }
};

// 登录成功回调
const onLoginSuccess = () => {
  router.push('/viewer');
};

// Quick Stats
const quickStats = computed(() => [
  { value: '1,247', label: t('home.statsAssets') },
  { value: '328', label: t('home.statsSpaces') },
  { value: '24/7', label: t('home.statsMonitoring') }
]);

// Features
const features = ref([
  {
    title: 'home.feature3D',
    description: 'home.feature3DDesc',
    icon: Icon3D,
    colorScheme: 'cyan',
    metrics: ['SVF', 'RVT', 'IFC'],
    hovered: false
  },
  {
    title: 'home.featureAssets',
    description: 'home.featureAssetsDesc',
    icon: IconAssets,
    colorScheme: 'emerald',
    metrics: ['MC编码', '分类', '位置'],
    hovered: false
  },
  {
    title: 'home.featureIoT',
    description: 'home.featureIoTDesc',
    icon: IconIoT,
    colorScheme: 'amber',
    metrics: ['实时', '历史', '预警'],
    hovered: false
  },
  {
    title: 'home.featureAI',
    description: 'home.featureAIDesc',
    icon: IconAI,
    colorScheme: 'violet',
    metrics: ['分析', '预测', '建议'],
    hovered: false
  },
  {
    title: 'home.featureDocs',
    description: 'home.featureDocsDesc',
    icon: IconDocs,
    colorScheme: 'rose',
    metrics: ['PDF', '图片', '关联'],
    hovered: false
  },
  {
    title: 'home.featureExport',
    description: 'home.featureExportDesc',
    icon: IconExport,
    colorScheme: 'blue',
    metrics: ['Excel', 'CSV', '映射'],
    hovered: false
  }
]);

// Preview Metrics
const previewMetrics = ref([
  { label: 'home.metricTemp', value: '24.5°C', percentage: '65%', color: '#00bcd4', status: 'normal' },
  { label: 'home.metricHumidity', value: '52%', percentage: '52%', color: '#4caf50', status: 'normal' },
  { label: 'home.metricEnergy', value: '1.2 MW', percentage: '78%', color: '#ff9800', status: 'warning' },
  { label: 'home.metricAir', value: '良好', percentage: '88%', color: '#9c27b0', status: 'good' }
]);

// Generate random positions for data points
const getDataPointStyle = () => {
  const top = Math.random() * 100;
  const left = Math.random() * 100;
  const delay = Math.random() * 3;
  return {
    top: `${top}%`,
    left: `${left}%`,
    animationDelay: `${delay}s`
  };
};

const getMarkerStyle = () => {
  const top = 10 + Math.random() * 80;
  const left = 10 + Math.random() * 80;
  return {
    top: `${top}%`,
    left: `${left}%`
  };
};

// Animation directive
const vAnimate = {
  mounted(el, binding) {
    const delay = binding.value?.delay || 0;
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)';

    setTimeout(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, delay);
  }
};
</script>

<style scoped>
/* ============================================
   DIGITAL TWIN HOME - INDUSTRIAL PRECISION
   ============================================ */

@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');

:root {
  --color-bg-primary: #0a0a0f;
  --color-bg-secondary: #111118;
  --color-bg-tertiary: #1a1a24;
  --color-text-primary: #f0f0f5;
  --color-text-secondary: #a0a0b0;
  --color-text-tertiary: #606070;
  --color-accent-cyan: #00bcd4;
  --color-accent-emerald: #4caf50;
  --color-accent-amber: #ff9800;
  --color-accent-violet: #9c27b0;
  --color-accent-rose: #f44336;
  --color-accent-blue: #2196f3;
  --color-border: rgba(255, 255, 255, 0.08);
  --color-border-hover: rgba(255, 255, 255, 0.15);
  --font-display: 'Space Grotesk', sans-serif;
  --font-body: 'IBM Plex Sans', sans-serif;
}

.digital-twin-home {
  min-height: 100vh;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-family: var(--font-body);
  overflow-x: hidden;
}

/* ============================================
   HERO SECTION
   ============================================ */

.hero-section {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120px 40px 80px;
  overflow: hidden;
}

.hero-background {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.grid-overlay {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse at center, black 20%, transparent 70%);
}

.floating-data {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.data-point {
  position: absolute;
  width: 4px;
  height: 4px;
  background: var(--color-accent-cyan);
  border-radius: 50%;
  box-shadow: 0 0 10px var(--color-accent-cyan);
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { opacity: 0.3; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-20px); }
}

.gradient-mesh {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 20% 30%, rgba(0, 188, 212, 0.15) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 70%, rgba(156, 39, 176, 0.1) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 50%, rgba(33, 150, 243, 0.08) 0%, transparent 60%);
  animation: meshMove 20s ease-in-out infinite;
}

@keyframes meshMove {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.hero-content {
  position: relative;
  z-index: 1;
  max-width: 1000px;
  text-align: center;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--color-border);
  border-radius: 100px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: 32px;
  backdrop-filter: blur(10px);
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: var(--color-accent-cyan);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

.hero-title {
  font-family: var(--font-display);
  font-size: clamp(48px, 8vw, 96px);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  margin-bottom: 24px;
}

.title-line {
  display: block;
  color: var(--color-text-primary);
}

.title-highlight {
  background: linear-gradient(135deg, var(--color-accent-cyan) 0%, var(--color-accent-violet) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-description {
  font-size: 18px;
  line-height: 1.6;
  color: var(--color-text-secondary);
  max-width: 600px;
  margin: 0 auto 48px;
}

.hero-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-bottom: 64px;
}

.btn-primary,
.btn-secondary,
.btn-outline,
.btn-large {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 14px 28px;
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
  border: none;
}

.btn-primary {
  background: linear-gradient(135deg, var(--color-accent-cyan) 0%, #00acc1 100%);
  color: #35BCE1;
  box-shadow: 0 4px 16px rgba(0, 188, 212, 0.3);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 188, 212, 0.4);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--color-border-hover);
}

.btn-icon {
  width: 20px;
  height: 20px;
  transition: transform 0.2s ease;
}

.btn-primary:hover .btn-icon {
  transform: translateX(4px);
}

.hero-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 48px;
  padding-top: 48px;
  border-top: 1px solid var(--color-border);
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-family: var(--font-display);
  font-size: 42px;
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1;
  margin-bottom: 8px;
  letter-spacing: -0.02em;
}

.stat-label {
  font-size: 14px;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.scroll-indicator {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  animation: bounce 2s ease-in-out infinite;
}

.mouse {
  width: 24px;
  height: 40px;
  border: 2px solid var(--color-border);
  border-radius: 12px;
  position: relative;
}

.wheel {
  width: 4px;
  height: 8px;
  background: var(--color-text-secondary);
  border-radius: 2px;
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  animation: scroll 2s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(10px); }
}

@keyframes scroll {
  0% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; transform: translateX(-50%) translateY(12px); }
}

/* ============================================
   FEATURES SECTION
   ============================================ */

.features-section {
  padding: 120px 40px;
  position: relative;
}

.section-header {
  text-align: center;
  margin-bottom: 80px;
}

.section-tag {
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-accent-cyan);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  display: block;
  margin-bottom: 16px;
}

.section-title {
  font-family: var(--font-display);
  font-size: clamp(36px, 5vw, 56px);
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.feature-card {
  position: relative;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 32px;
  cursor: pointer;
  transition: all 0.3s ease;
  overflow: hidden;
}

.feature-card:hover {
  border-color: var(--color-border-hover);
  transform: translateY(-4px);
}

.card-background {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.feature-card:hover .card-background {
  opacity: 1;
}

.card-background.cyan {
  background: radial-gradient(ellipse at top right, rgba(0, 188, 212, 0.1), transparent 60%);
}

.card-background.emerald {
  background: radial-gradient(ellipse at top right, rgba(76, 175, 80, 0.1), transparent 60%);
}

.card-background.amber {
  background: radial-gradient(ellipse at top right, rgba(255, 152, 0, 0.1), transparent 60%);
}

.card-background.violet {
  background: radial-gradient(ellipse at top right, rgba(156, 39, 176, 0.1), transparent 60%);
}

.card-background.rose {
  background: radial-gradient(ellipse at top right, rgba(244, 67, 54, 0.1), transparent 60%);
}

.card-background.blue {
  background: radial-gradient(ellipse at top right, rgba(33, 150, 243, 0.1), transparent 60%);
}

.card-content {
  position: relative;
  z-index: 1;
}

.feature-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  margin-bottom: 24px;
  font-size: 28px;
}

.feature-title {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 12px;
  letter-spacing: -0.01em;
}

.feature-description {
  font-size: 15px;
  line-height: 1.6;
  color: var(--color-text-secondary);
  margin-bottom: 20px;
}

.feature-metrics {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.metric {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-tertiary);
}

.card-border {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--color-accent-cyan), transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.feature-card:hover .card-border {
  opacity: 1;
}

/* ============================================
   PREVIEW SECTION
   ============================================ */

.preview-section {
  padding: 60px 40px;
  background: var(--color-bg-secondary);
}

.preview-container {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 80px;
  align-items: center;
  padding: 0 60px;
}

.section-description {
  font-size: 16px;
  line-height: 1.7;
  color: var(--color-text-secondary);
  margin-top: 24px;
  margin-bottom: 40px;
}

.preview-metrics {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.metric-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metric-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metric-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.metric-value {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.metric-value.normal { color: var(--color-accent-cyan); }
.metric-value.warning { color: var(--color-accent-amber); }
.metric-value.good { color: var(--color-accent-emerald); }

.metric-bar {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 1s ease-out;
}

.preview-visual {
  position: relative;
}

.building-model {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
}

.model-floor {
  display: flex;
  justify-content: center;
  animation: floorFadeIn 0.6s ease-out forwards;
  opacity: 0;
}

@keyframes floorFadeIn {
  to { opacity: 1; }
}

.floor-rooms {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 8px;
}

.room {
  width: 32px;
  height: 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  transition: all 0.3s ease;
}

.room:nth-child(3n) {
  background: rgba(0, 188, 212, 0.2);
  border-color: rgba(0, 188, 212, 0.3);
}

.room:nth-child(5n) {
  background: rgba(156, 39, 176, 0.15);
  border-color: rgba(156, 39, 176, 0.25);
}

.building-model:hover .room {
  transform: scale(1.1);
  box-shadow: 0 0 20px rgba(0, 188, 212, 0.3);
}

.model-data-points {
  position: absolute;
  inset: 40px;
  pointer-events: none;
}

.data-point-marker {
  position: absolute;
  width: 12px;
  height: 12px;
  background: var(--color-accent-cyan);
  border-radius: 50%;
  box-shadow: 0 0 20px var(--color-accent-cyan);
  animation: markerPulse 2s ease-in-out infinite;
}

@keyframes markerPulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.5); opacity: 0.5; }
}

/* ============================================
   CTA SECTION
   ============================================ */

.cta-section {
  position: relative;
  padding: 120px 40px;
  text-align: center;
  overflow: hidden;
}

.cta-background {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.gradient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
}

.orb-1 {
  width: 400px;
  height: 400px;
  background: var(--color-accent-cyan);
  top: -100px;
  left: -100px;
}

.orb-2 {
  width: 300px;
  height: 300px;
  background: var(--color-accent-violet);
  bottom: -100px;
  right: -100px;
}

.cta-content {
  position: relative;
  z-index: 1;
  max-width: 700px;
  margin: 0 auto;
}

.cta-title {
  font-family: var(--font-display);
  font-size: clamp(36px, 5vw, 52px);
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: 24px;
  letter-spacing: -0.02em;
}

.cta-description {
  font-size: 18px;
  line-height: 1.6;
  color: var(--color-text-secondary);
  margin-bottom: 40px;
}

.cta-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.btn-large {
  padding: 16px 32px;
  font-size: 16px;
}

.btn-outline {
  background: transparent;
  color: #35BCE1;
  border: 2px solid var(--color-border);
}

.btn-outline:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--color-border-hover);
}

/* ============================================
   FOOTER
   ============================================ */

.home-footer {
  padding: 40px;
  border-top: 1px solid var(--color-border);
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-logo {
  width: 40px;
  height: 40px;
  color: var(--color-text-primary);
}

.brand-name {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: 0.05em;
}

.footer-links {
  display: flex;
  gap: 32px;
}

.footer-link {
  font-size: 14px;
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: color 0.2s ease;
}

.footer-link:hover {
  color: var(--color-text-primary);
}

/* ============================================
   RESPONSIVE
   ============================================ */

@media (max-width: 1024px) {
  .preview-container {
    grid-template-columns: 1fr;
    gap: 48px;
  }
}

@media (max-width: 768px) {
  .hero-section {
    padding: 80px 24px 60px;
  }

  .hero-stats {
    grid-template-columns: 1fr;
    gap: 32px;
  }

  .features-section,
  .preview-section,
  .cta-section {
    padding: 80px 24px;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }

  .hero-actions,
  .cta-actions {
    flex-direction: column;
  }

  .btn-primary,
  .btn-secondary,
  .btn-large {
    width: 100%;
    justify-content: center;
  }

  .footer-content {
    flex-direction: column;
    gap: 24px;
    text-align: center;
  }

  .footer-links {
    flex-direction: column;
    gap: 16px;
  }
}
</style>
