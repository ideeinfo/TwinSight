# 演练 - 修复多次调用导致的提前解锁问题

## 任务概览
通过日志分析发现，`AppViewer` 会触发两次 `loadNewModel`。第二次调用因为检测到 `isLoadingModel=true`，之前直接返回了 `Promise.resolve()`，导致调用方误以为加载完成，从而提前解锁了 UI。

本次修复引入了 **Promise 单例模式**，确保所有并发的加载请求都等待同一个真实的加载过程完成。

## 变更内容

### 1. `MainView.vue` - 重构加载逻辑
- **引入 `currentLoadPromise`**：用于存储当前正在进行的加载任务。
- **重构 `loadNewModel`**：
  - 如果检测到正在加载 (`isLoadingModel` 为真)，不再返回空的 resolved promise。
  - 而是返回 `currentLoadPromise`，这意味着第二次调用的等待者将加入到第一次调用的等待队列中。
  - 只有当第一次调用真正完成后（触发几何体和对象树事件），两个调用才会同时解决。
- **提取 `performLoadNewModel`**：将实际的加载代码移入此函数，保持主函数逻辑清晰。

## 验证结果

### 预期行为
- 再次刷新页面时，查看控制台日志。
- 当 `AppViewer` 发起第二次调用时，应该看到日志：`⏭️ 模型正在加载中，返回现有 Promise 以保持锁定`。
- `isModelLoading` 应该一直保持为 `true`，直到那条 `🎉` 庆祝日志出现。
