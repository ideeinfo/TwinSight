<template>
  <el-dialog
    v-model="visible"
    :title="$t('account.settings')"
    width="480px"
    :close-on-click-modal="false"
    class="account-dialog"
  >
    <div class="account-content">
      <!-- 头像区域 -->
      <div class="avatar-section">
        <div class="avatar-wrapper" @click="triggerAvatarUpload">
          <div class="avatar-large" :style="avatarStyle">
            <img v-if="avatarPreview || user?.avatarUrl" :src="avatarPreview || user?.avatarUrl" alt="avatar" />
            <span v-else>{{ initials }}</span>
          </div>
          <div class="avatar-overlay">
            <el-icon><Camera /></el-icon>
          </div>
        </div>
        <input
          ref="avatarInput"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style="display: none"
          @change="handleAvatarSelect"
        />
        <p class="avatar-hint">{{ $t('account.uploadAvatarHint') }}</p>
      </div>

      <!-- 表单 -->
      <el-form ref="formRef" :model="formData" :rules="formRules" label-position="top">
        <!-- 姓名 -->
        <el-form-item :label="$t('account.name')" prop="name">
          <el-input v-model="formData.name" :placeholder="$t('account.namePlaceholder')" />
        </el-form-item>

        <!-- 邮箱（只读） -->
        <el-form-item :label="$t('account.email')">
          <el-input :model-value="user?.email || ''" disabled />
        </el-form-item>

        <!-- 修改密码区域 -->
        <el-divider>{{ $t('account.changePassword') }}</el-divider>

        <el-form-item :label="$t('account.currentPassword')" prop="currentPassword">
          <el-input
            v-model="formData.currentPassword"
            type="password"
            :placeholder="$t('account.currentPasswordPlaceholder')"
            show-password
          />
        </el-form-item>

        <el-form-item :label="$t('account.newPassword')" prop="newPassword">
          <el-input
            v-model="formData.newPassword"
            type="password"
            :placeholder="$t('account.newPasswordPlaceholder')"
            show-password
          />
        </el-form-item>

        <el-form-item :label="$t('account.confirmNewPassword')" prop="confirmNewPassword">
          <el-input
            v-model="formData.confirmNewPassword"
            type="password"
            :placeholder="$t('account.confirmNewPasswordPlaceholder')"
            show-password
          />
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <el-button @click="visible = false">{{ $t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">
        {{ $t('common.save') }}
      </el-button>
    </template>

    <!-- 头像裁剪对话框 -->
    <AvatarCropper
      v-model="showCropper"
      :image-src="cropperImageSrc"
      @confirm="handleAvatarCropped"
    />
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { Camera } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import * as authService from '@/services/auth';
import AvatarCropper from './AvatarCropper.vue';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const { t } = useI18n();
const authStore = useAuthStore();

const formRef = ref();
const avatarInput = ref<HTMLInputElement | null>(null);
const saving = ref(false);
const showCropper = ref(false);
const cropperImageSrc = ref('');
const avatarPreview = ref('');

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const user = computed(() => authStore.user);

const formData = reactive({
  name: '',
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: ''
});

// 初始化表单
watch(visible, (val) => {
  if (val && user.value) {
    formData.name = user.value.username || '';
    formData.currentPassword = '';
    formData.newPassword = '';
    formData.confirmNewPassword = '';
    avatarPreview.value = '';
  }
});

// 头像首字母
const initials = computed(() => {
  const name = user.value?.username || '';
  if (!name) return '?';
  if (/[\u4e00-\u9fa5]/.test(name)) {
    return name.substring(0, 2);
  }
  return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
});

// 头像样式
const avatarStyle = computed(() => {
  if (avatarPreview.value || user.value?.avatarUrl) return {};
  const colors = ['#00bcd4', '#4caf50', '#ff9800', '#9c27b0', '#f44336', '#2196f3'];
  const id = user.value?.id || 0;
  return { backgroundColor: colors[id % colors.length] };
});

// 表单验证规则
const formRules = computed(() => ({
  name: [
    { required: true, message: t('account.nameRequired'), trigger: 'blur' }
  ],
  newPassword: [
    { min: 8, message: t('auth.passwordMinLength'), trigger: 'blur' }
  ],
  confirmNewPassword: [
    {
      validator: (_rule: any, value: string, callback: Function) => {
        if (formData.newPassword && value !== formData.newPassword) {
          callback(new Error(t('auth.passwordMismatch')));
        } else {
          callback();
        }
      },
      trigger: 'blur'
    }
  ]
}));

// 触发头像上传
const triggerAvatarUpload = () => {
  avatarInput.value?.click();
};

// 选择头像文件
const handleAvatarSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  // 检查文件大小（2MB）
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.error(t('account.avatarTooLarge'));
    return;
  }

  // 读取文件并打开裁剪器
  const reader = new FileReader();
  reader.onload = (e) => {
    cropperImageSrc.value = e.target?.result as string;
    showCropper.value = true;
  };
  reader.readAsDataURL(file);

  // 重置 input 以便重复选择同一文件
  input.value = '';
};

// 头像裁剪完成
const handleAvatarCropped = (dataUrl: string) => {
  avatarPreview.value = dataUrl;
};

// 保存
const handleSave = async () => {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  saving.value = true;
  try {
    // 更新姓名
    if (formData.name !== user.value?.username) {
      await authService.updateProfile({ name: formData.name });
      // 更新本地状态
      if (authStore.user) {
        authStore.user.username = formData.name;
      }
    }

    // 上传头像
    if (avatarPreview.value) {
      const blob = await fetch(avatarPreview.value).then(r => r.blob());
      await authService.uploadAvatar(blob);
    }

    // 修改密码
    if (formData.newPassword && formData.currentPassword) {
      await authService.changePassword(formData.currentPassword, formData.newPassword);
      ElMessage.success(t('account.passwordChanged'));
    }

    ElMessage.success(t('common.saveSuccess'));
    visible.value = false;
  } catch (error: any) {
    ElMessage.error(error.message || t('common.saveFailed'));
  } finally {
    saving.value = false;
  }
};
</script>

<style scoped>
.account-content {
  padding: 0 8px;
}

/* 头像区域 */
.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
}

.avatar-wrapper {
  position: relative;
  cursor: pointer;
}

.avatar-large {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 600;
  color: #fff;
  overflow: hidden;
}

.avatar-large img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-overlay {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24px;
  opacity: 0;
  transition: opacity 0.2s;
}

.avatar-wrapper:hover .avatar-overlay {
  opacity: 1;
}

.avatar-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 8px;
}

/* 分隔线 */
.el-divider {
  margin: 24px 0 16px;
}

.el-divider :deep(.el-divider__text) {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
