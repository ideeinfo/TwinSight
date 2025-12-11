<template>
  <div class="searchable-select" ref="dropdownRef">
    <div class="select-trigger" @click="toggleDropdown">
      <span class="select-value" :class="{ placeholder: !modelValue }">
        {{ modelValue || placeholder }}
      </span>
      <span class="select-arrow" :class="{ open: isOpen }">▼</span>
    </div>

    <!-- 使用 Teleport 将下拉列表渲染到 body，避免被父容器截断 -->
    <Teleport to="body">
      <div 
        v-if="isOpen" 
        class="select-dropdown-portal"
        :style="dropdownStyle"
        ref="dropdownPortalRef"
      >
        <div class="select-dropdown-content">
          <input 
            ref="searchInput"
            v-model="searchText"
            class="select-search"
            placeholder="Search..."
            @click.stop
          />
          <div class="select-options">
            <div 
              v-for="option in filteredOptions"
              :key="option"
              class="select-option"
              :class="{ selected: option === modelValue }"
              @click="selectOption(option)"
            >
              {{ option }}
            </div>
            <div v-if="filteredOptions.length === 0" class="select-empty">
              No options found
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Select...' }
});

const emit = defineEmits(['update:modelValue']);

const isOpen = ref(false);
const searchText = ref('');
const dropdownRef = ref(null);
const dropdownPortalRef = ref(null); // Ref for the portal content
const searchInput = ref(null);
const dropdownStyle = ref({
  top: '0px',
  left: '0px',
  width: '0px'
});

// 过滤后的选项
const filteredOptions = computed(() => {
  if (!searchText.value) return props.options;
  const search = searchText.value.toLowerCase();
  return props.options.filter(opt => opt.toLowerCase().includes(search));
});

// 更新下拉列表位置
function updatePosition() {
  if (!dropdownRef.value || !isOpen.value) return;
  
  const rect = dropdownRef.value.getBoundingClientRect();
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

  dropdownStyle.value = {
    top: `${rect.bottom + scrollTop + 4}px`, // 4px margin
    left: `${rect.left + scrollLeft}px`,
    width: `${rect.width}px`
  };
}

// 切换下拉列表
function toggleDropdown() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    searchText.value = '';
    updatePosition();
    nextTick(() => {
      searchInput.value?.focus();
    });
    // 添加滚动和调整大小监听器以实时更新位置
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true); // true capture phase for all scrollable parents
  } else {
    removeListeners();
  }
}

function removeListeners() {
  window.removeEventListener('resize', updatePosition);
  window.removeEventListener('scroll', updatePosition, true);
}

// 关闭下拉列表
function closeDropdown() {
  isOpen.value = false;
  searchText.value = '';
  removeListeners();
}

// 选择选项
function selectOption(option) {
  emit('update:modelValue', option);
  closeDropdown();
}

// 点击外部关闭
function handleClickOutside(event) {
  const target = event.target;
  // 检查是否点击在触发器上
  const isClickOnTrigger = dropdownRef.value && dropdownRef.value.contains(target);
  // 检查是否点击在下拉内容上 (Portal)
  const isClickOnPortal = dropdownPortalRef.value && dropdownPortalRef.value.contains(target);

  if (!isClickOnTrigger && !isClickOnPortal) {
    closeDropdown();
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  removeListeners();
});
</script>

<style scoped>
.searchable-select {
  position: relative;
  width: 100%;
}

.select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #1e1e1e;
  border: 1px solid #444;
  color: #e0e0e0;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  font-family: 'Consolas', monospace;
  cursor: pointer;
  transition: all 0.2s;
}

.select-trigger:hover {
  border-color: #4fc3f7;
}

.select-value {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.select-value.placeholder {
  color: #666;
}

.select-arrow {
  margin-left: 8px;
  font-size: 10px;
  color: #999;
  transition: transform 0.2s;
}

.select-arrow.open {
  transform: rotate(180deg);
}

/* Portal Styles - GLOBAL CONTEXT (since used in Teleport) but Scoped CSS might rely on deep selectors or global styles. 
   Vue's <style scoped> applies a unique ID to elements. Teleported elements retain that ID.
   However, we need to be careful with global positioning. */
.select-dropdown-portal {
  position: absolute;
  z-index: 9999; /* Ensure it's on top of everything */
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  max-height: 300px;
}

.select-dropdown-content {
  display: flex;
  flex-direction: column;
  max-height: 100%;
}

.select-search {
  width: 100%;
  background: #1e1e1e;
  border: none;
  border-bottom: 1px solid #444;
  color: #e0e0e0;
  padding: 8px 12px;
  font-size: 13px;
  outline: none;
  border-radius: 4px 4px 0 0;
  box-sizing: border-box; /* Ensure padding doesn't overflow width */
}

.select-search:focus {
  background: #252526;
}

.select-options {
  overflow-y: auto;
  max-height: 250px;
}

.select-option {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  color: #e0e0e0;
  transition: background 0.15s;
}

.select-option:hover {
  background: #333;
}

.select-option.selected {
  background: #4fc3f7;
  color: #000;
  font-weight: 500;
}

.select-empty {
  padding: 12px;
  text-align: center;
  color: #666;
  font-size: 13px;
}


</style>
