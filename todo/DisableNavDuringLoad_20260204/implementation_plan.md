# Implementation Plan - Singleton Loading Promise

## Task Description
Fix the premature UI unlocking issue caused by redundant `loadNewModel` calls. When `AppViewer` calls `loadNewModel` a second time while the first call is still loading, it previously returned `Promise.resolve()` immediately, causing the UI to unlock.

## User Review Required
> [!IMPORTANT]
> The fix introduces a singleton promise pattern (`currentLoadPromise`). This means concurrent calls to `loadNewModel` for the same loading operation will now *share* the same promise and wait for the original operation to complete.

## Proposed Changes

### Frontend components

#### [MainView.vue]
-   Introduce `currentLoadPromise` variable.
-   Refactor `loadNewModel` to:
    1.  Check if `isLoadingModel && currentLoadPromise`. If true, return `currentLoadPromise`.
    2.  Check if fully loaded (already present). If true, return `Promise.resolve(true)`.
    3.  If starting new load, assign the async operation to `currentLoadPromise`.
    4.  Await `performLoadNewModel` (refactored body).
    5.  Clear `currentLoadPromise` in `finally` block.
-   Move the main body of the loading logic into `performLoadNewModel`.

## Verification Plan

### Manual Verification
1.  **Redundant Call Test**:
    -   Observe logs. Verify that the second call (triggered by AppViewer logic) prints "⏭️ 模型正在加载中，返回现有 Promise 以保持锁定".
    -   Verify that it adheres to the original loading timeline and doesn't unlock immediately.
2.  **Lock Duration**:
    -   Refresh page.
    -   Visually confirm that the sidebar remains disabled until the "🎉 模型几何体与对象树均已就绪" log appears.
