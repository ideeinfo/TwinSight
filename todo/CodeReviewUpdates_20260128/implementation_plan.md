# Implementation Plan - Code Review Fixes (2026-01-28)

This plan addresses the critical and major issues identified in the code review. The goal is to improve performance, reduce memory usage, and improve code maintainability.

## Phase 1: Documents Route Optimization
**Ref**: `server/routes/documents.js`
**Objective**: Fix the critical memory issue where `extractExif` reads the entire file into memory.

- [ ] Import `open` and `read` from `fs` (or use `fs.promises.open`) to handle file chunk release.
- [ ] Modify `extractExif` function:
    - [ ] Open the file descriptor.
    - [ ] Read only the first 64KB (65536 bytes) into a buffer.
    - [ ] Close the file descriptor strictly in a `finally` block.
    - [ ] Pass the 64KB buffer to `ExifParser`.

## Phase 2: AI Analysis Refactor
**Ref**: `server/routes/ai-analysis.js`
**Objective**: Refactor the bloated route handler into a clean Service-Controller pattern.

- [ ] Create `server/services/ai-service.js`.
- [ ] Move `getContextData` logic to `ai-service.js` (or import if shared).
- [ ] Implement `executeN8nWorkflow` in `ai-service.js`:
    - [ ] Encapsulate N8N API call.
    - [ ] Encapsulate result formatting / resource matching logic.
- [ ] Implement `executeDirectAnalysis` in `ai-service.js`:
    - [ ] Encapsulate context gathering.
    - [ ] Encapsulate Open WebUI RAG call.
    - [ ] Encapsulate result formatting / regex logic.
- [ ] Implement helper `formatAnalysisResult` or similar utils to handle the shared logic of "Text processing" and "Source linking" which is currently duplicated or extremely long in both branches.
- [ ] Refactor `server/routes/ai-analysis.js` to:
    - [ ] Import `aiService`.
    - [ ] The `POST /temperature-alert` route should just parse inputs and call `aiService.processTemperatureAlert(params)`.

## Phase 3: Document Intelligence Service Caching
**Ref**: `server/services/document-intelligence-service.js`
**Objective**: Reduce unnecessary database queries during batch processing.

- [ ] Add module-level `const TAG_CACHE = new Map();` (name -> id).
- [ ] Modify `getOrCreateTag`:
    - [ ] Check `TAG_CACHE` first.
    - [ ] If found, return immediate ID.
    - [ ] If not found, proceed with DB lookup/creation.
    - [ ] On success (find or create), store result in `TAG_CACHE`.

## Phase 4: Verification
- [ ] Verify `extractExif` works with a sample JPG (via Upload).
- [ ] Verify AI Analysis returns correct results in both N8N and Direct modes (using Mock or actual service if available).
- [ ] Verify Document processing does not crash and tags are applied correctly.
