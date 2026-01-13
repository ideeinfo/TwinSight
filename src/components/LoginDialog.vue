<template>
  <el-dialog
    v-model="visible"
    :title="isLogin ? $t('auth.loginTitle') : $t('auth.registerTitle')"
    width="420px"
    :close-on-click-modal="false"
    :show-close="true"
    class="auth-dialog"
    :class="{ 'is-dark': isDarkMode }"
    @close="handleClose"
  >
    <div class="auth-content">
      <!-- 欢迎语 -->
      <div class="auth-welcome">
        <div class="welcome-icon">
          <img src="../assets/logo.png" alt="Logo" />
        </div>
        <p class="welcome-text">{{ isLogin ? $t('auth.welcomeBack') : $t('auth.welcomeNew') }}</p>
      </div>

      <!-- 登录/注册表单 -->
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-position="top"
        hide-required-asterisk
        :show-message="false"
        @submit.prevent="handleSubmit"
      >
        <!-- 姓名（仅注册时显示） -->
        <el-form-item v-if="!isLogin" :label="$t('auth.name')" prop="name">
          <el-input
            v-model="formData.name"
            :placeholder="$t('auth.namePlaceholder')"
            prefix-icon="User"
            size="large"
            class="auth-input"
          />
        </el-form-item>

        <!-- 邮箱 -->
        <el-form-item :label="$t('auth.email')" prop="email">
          <el-input
            v-model="formData.email"
            type="email"
            :placeholder="$t('auth.emailPlaceholder')"
            prefix-icon="Message"
            size="large"
            class="auth-input"
          />
        </el-form-item>

        <!-- 密码 -->
        <el-form-item :label="$t('auth.password')" prop="password">
          <el-input
            v-model="formData.password"
            type="password"
            :placeholder="$t('auth.passwordPlaceholder')"
            prefix-icon="Lock"
            size="large"
            show-password
            class="auth-input"
          />
        </el-form-item>

        <!-- 确认密码（仅注册时显示） -->
        <el-form-item v-if="!isLogin" :label="$t('auth.confirmPassword')" prop="confirmPassword">
          <el-input
            v-model="formData.confirmPassword"
            type="password"
            :placeholder="$t('auth.confirmPasswordPlaceholder')"
            prefix-icon="Lock"
            size="large"
            show-password
            class="auth-input"
          />
        </el-form-item>

        <!-- 错误提示 -->
        <div v-if="errorMessage" class="error-message">
          <el-icon><WarningFilled /></el-icon>
          <span>{{ errorMessage }}</span>
        </div>

        <!-- 提交按钮 -->
        <el-form-item class="submit-item">
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            native-type="submit"
            class="submit-btn"
          >
            {{ isLogin ? $t('auth.login') : $t('auth.register') }}
          </el-button>
        </el-form-item>
      </el-form>

      <!-- 切换登录/注册 -->
      <div class="auth-switch">
        <span>{{ isLogin ? $t('auth.noAccount') : $t('auth.hasAccount') }}</span>
        <el-button type="primary" link @click="toggleMode">
          {{ isLogin ? $t('auth.goRegister') : $t('auth.goLogin') }}
        </el-button>
      </div>

      <!-- OAuth 入口（预留） -->
      <div class="oauth-section">
        <div class="oauth-divider">
          <span>{{ $t('auth.orContinueWith') }}</span>
        </div>
        <div class="oauth-buttons">
          <el-button class="oauth-btn" disabled>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>Google</span>
          </el-button>
          <el-button class="oauth-btn" disabled>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="#07C160" d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348z"/>
            </svg>
            <span>{{ $t('auth.wechat') }}</span>
          </el-button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { WarningFilled } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import * as authService from '@/services/auth';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'success'): void;
}>();

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const themeStore = useThemeStore();

const formRef = ref();
const isLogin = ref(true);
const loading = ref(false);
const errorMessage = ref('');

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const isDarkMode = computed(() => themeStore.isDark);

const formData = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: ''
});

// 表单验证规则
const formRules = computed(() => ({
  name: [
    { required: !isLogin.value, message: t('auth.nameRequired'), trigger: 'blur' }
  ],
  email: [
    { required: true, message: t('auth.emailRequired'), trigger: 'blur' },
    { type: 'email', message: t('auth.emailInvalid'), trigger: 'blur' }
  ],
  password: [
    { required: true, message: t('auth.passwordRequired'), trigger: 'blur' },
    { min: 8, message: t('auth.passwordMinLength'), trigger: 'blur' }
  ],
  confirmPassword: [
    { required: !isLogin.value, message: t('auth.confirmPasswordRequired'), trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: Function) => {
        if (!isLogin.value && value !== formData.password) {
          callback(new Error(t('auth.passwordMismatch')));
        } else {
          callback();
        }
      },
      trigger: 'blur'
    }
  ]
}));

// 切换登录/注册模式
const toggleMode = () => {
  isLogin.value = !isLogin.value;
  errorMessage.value = '';
  formRef.value?.resetFields();
};

// 关闭对话框
const handleClose = () => {
  errorMessage.value = '';
  isLogin.value = true;
  formRef.value?.resetFields();
};

// 提交表单
const handleSubmit = async () => {
  try {
    await formRef.value?.validate();
  } catch (fields: any) {
    // 验证失败，显示第一条错误信息
    if (fields && typeof fields === 'object') {
      const firstField = Object.keys(fields)[0];
      if (firstField && fields[firstField]?.[0]?.message) {
        ElMessage.warning(fields[firstField][0].message);
      }
    }
    return;
  }

  loading.value = true;
  errorMessage.value = '';

  try {
    if (isLogin.value) {
      // 登录
      const result = await authService.login(formData.email, formData.password);
      if (result.success && result.data) {
        // 保存认证信息
        authStore.setAuth(
          {
            id: result.data.user.id,
            username: result.data.user.name,
            email: result.data.user.email,
            roles: result.data.user.roles
          },
          result.data.accessToken,
          result.data.user.permissions || [] // 使用服务器返回的权限
        );
        
        // 保存 token 到 localStorage
        localStorage.setItem('accessToken', result.data.accessToken);
        
        ElMessage.success(t('auth.loginSuccess'));
        visible.value = false;
        emit('success');
        
        // 跳转到查看器
        router.push('/viewer');
      } else {
        errorMessage.value = result.error || t('auth.loginFailed');
      }
    } else {
      // 注册
      const result = await authService.register(formData.email, formData.password, formData.name);
      if (result.success) {
        ElMessage.success(t('auth.registerSuccess'));
        // 注册成功后切换到登录
        isLogin.value = true;
        formData.password = '';
        formData.confirmPassword = '';
      } else {
        errorMessage.value = result.error || t('auth.registerFailed');
      }
    }
  } catch (error: any) {
    errorMessage.value = error.message || t('auth.unknownError');
  } finally {
    loading.value = false;
  }
};

// 监听模式切换时重置错误
watch(isLogin, () => {
  errorMessage.value = '';
});
</script>

<style scoped>
/* 对话框样式 - 浅色模式 */
.auth-dialog :deep(.el-dialog) {
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 0, 0, 0.1);
}

/* 浅色模式输入框透明 */
.auth-dialog :deep(.el-input__wrapper) {
  background: transparent;
  box-shadow: none;
  border: 1px solid rgba(0, 0, 0, 0.15);
}

.auth-dialog :deep(.el-input__wrapper:hover) {
  border-color: rgba(0, 0, 0, 0.25);
}

.auth-dialog :deep(.el-input__wrapper.is-focus) {
  border-color: #00bcd4;
}

.auth-dialog.is-dark :deep(.el-dialog) {
  background: rgba(26, 26, 36, 0.85);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.auth-dialog.is-dark :deep(.el-dialog__header) {
  background: transparent;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.auth-dialog.is-dark :deep(.el-dialog__title) {
  color: #f0f0f5;
}

.auth-dialog.is-dark :deep(.el-dialog__body) {
  background: transparent;
}

/* 欢迎区域 */
.auth-welcome {
  text-align: center;
  margin-bottom: 24px;
}

.welcome-icon {
  width: 100%;
  max-width: 280px;
  height: 64px;
  margin: 0 auto 12px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.welcome-icon img {
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.welcome-text {
  font-size: 15px;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.is-dark .welcome-text {
  color: #a0a0b0;
}

/* 表单样式 */
.auth-content :deep(.el-form-item__label) {
  font-weight: 500;
}

.is-dark .auth-content :deep(.el-form-item__label) {
  color: #f0f0f5;
}

.is-dark .auth-content :deep(.el-input__wrapper) {
  background: transparent !important;
  background-color: transparent !important;
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow: none !important;
}

.is-dark .auth-content :deep(.el-input__wrapper:hover) {
  border-color: rgba(255, 255, 255, 0.35);
}

.is-dark .auth-content :deep(.el-input__wrapper.is-focus) {
  border-color: #00bcd4;
}

.is-dark .auth-content :deep(.el-input) {
  --el-input-bg-color: transparent;
}

.is-dark .auth-content :deep(.el-input__inner) {
  color: #f0f0f5;
}

.is-dark .auth-content :deep(.el-input__inner::placeholder) {
  color: #606070;
}

/* 错误提示 */
.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(244, 67, 54, 0.1);
  border: 1px solid rgba(244, 67, 54, 0.3);
  border-radius: 8px;
  color: #f44336;
  font-size: 14px;
  margin-bottom: 16px;
}

/* 提交按钮 */
.submit-item {
  margin-top: 24px;
  margin-bottom: 0;
}

.submit-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  font-weight: 600;
  background: linear-gradient(135deg, #00bcd4 0%, #00acc1 100%);
  border: none;
}

.submit-btn:hover {
  background: linear-gradient(135deg, #00acc1 0%, #0097a7 100%);
}

/* 切换登录/注册 */
.auth-switch {
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.is-dark .auth-switch {
  color: #a0a0b0;
}

/* OAuth 区域 */
.oauth-section {
  margin-top: 24px;
}

.oauth-divider {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.oauth-divider::before,
.oauth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--el-border-color);
}

.is-dark .oauth-divider::before,
.is-dark .oauth-divider::after {
  background: rgba(255, 255, 255, 0.08);
}

.oauth-divider span {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.is-dark .oauth-divider span {
  color: #606070;
}

.oauth-buttons {
  display: flex;
  gap: 12px;
}

.oauth-btn {
  flex: 1;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 8px;
  font-weight: 500;
}

.is-dark .oauth-btn {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.1);
  color: #a0a0b0;
}
</style>

/* 全局样式覆盖 Element Plus 默认样式 */
/* 全局样式覆盖 Element Plus 默认样式 */
<style>
/* 根级变量覆盖 - 基底设置 */
.auth-dialog {
  /* 调整透明度：用户要求 30% 透明度 = 70% 不透明度 (0.70) */
  --el-dialog-bg-color: v-bind('isDarkMode ? "rgba(26, 26, 36, 0.9)" : "rgba(255, 255, 255, 0.9)"') !important;
  --el-dialog-box-shadow: 0 12px 32px 4px rgba(0, 0, 0, 0.36) !important;
  --el-input-bg-color: transparent !important;
  --el-fill-color-blank: transparent !important;
}

/* 强制背景使用变量 */
.auth-dialog .el-dialog {
  background: var(--el-dialog-bg-color) !important;
  backdrop-filter: blur(20px) !important;
  -webkit-backdrop-filter: blur(20px) !important;
  border: 1px solid v-bind('isDarkMode ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.1)"') !important;
}

/* 移除内部干扰背景 */
.auth-dialog .el-dialog__header,
.auth-dialog .el-dialog__body {
  background: transparent !important;
}

/* 
  输入框强制透明 - 混合策略 
  兼容 Edge/Chrome 的终极方案：直接命中 CSS 属性，不依赖变量继承
*/
body .auth-input .el-input__wrapper,
body .auth-input .el-input__inner {
  background-color: transparent !important;
  background: transparent !important;
}

/* 边框样式 - 需要区分深浅模式 */
/* 深色模式 */
body .el-dialog.auth-dialog.is-dark .auth-input .el-input__wrapper {
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2) inset !important;
}

body .el-dialog.auth-dialog.is-dark .auth-input .el-input__wrapper:hover {
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.35) inset !important;
}

/* 浅色模式 */
body .el-dialog.auth-dialog:not(.is-dark) .auth-input .el-input__wrapper {
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15) inset !important;
}

body .el-dialog.auth-dialog:not(.is-dark) .auth-input .el-input__wrapper:hover {
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25) inset !important;
}

/* 聚焦状态 - 通用 */
body .auth-input .el-input__wrapper.is-focus {
  box-shadow: 0 0 0 1px #00bcd4 inset !important;
}

/* 
  自动填充样式覆盖 (Autofill Hack)
  利用 transition 延迟背景色变化，实现"透明"背景
*/
body .auth-input .el-input__inner:-webkit-autofill,
body .auth-input .el-input__inner:-webkit-autofill:hover,
body .auth-input .el-input__inner:-webkit-autofill:focus,
body .auth-input .el-input__inner:-webkit-autofill:active {
  -webkit-transition: color 99999s ease-out, background-color 99999s ease-out;
  transition: color 99999s ease-out, background-color 99999s ease-out;
  -webkit-transition-delay: 99999s;
  transition-delay: 99999s;
}

/* 确保自动填充的文字颜色正确 */
body .el-dialog.auth-dialog.is-dark .auth-input .el-input__inner:-webkit-autofill {
  -webkit-text-fill-color: #f0f0f5 !important;
}

body .el-dialog.auth-dialog:not(.is-dark) .auth-input .el-input__inner:-webkit-autofill {
  -webkit-text-fill-color: #606266 !important;
}
</style>
