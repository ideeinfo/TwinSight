# TwinSight AI Updates Walkthrough

## 1. AI Alert Workflow Refactor
We have streamlined the AI alert process to be faster and more user-initiated:
- **Immediate Notification**: Alerts now appear instantly with key data (Temperature, Threshold) without waiting for AI analysis.
- **Manual Analysis Trigger**: A "Smart Analyze" button is provided for users to request deep analysis on demand.
- **Analysis Feedback**: The chat interface now shows a "Analyzing..." state and renders the result asynchronously.

## 2. Citation System Enhancements
To fix the issue where citation markers `[x]` were not clickable or pointed to the wrong documents, we ported the robust logic from `AIAnalysisModal` to `AIChatPanel`:
- **Smart Reference Parsing**: The system now parses the "References" section (e.g., `[13] manual.pdf`) to map citation numbers to actual document files, even if indices don't match the source array order.
- **Rich Markdown Rendering**: Added support for Headers (`###`), Lists (`- item`), and Paragraphs (`\n\n`) for better readability.
- **Deep CSS Selectors**: Applied `:deep(.ai-doc-link)` to ensure citation styles (color, underline, pointer cursor) persist within `v-html` content.
- **Enhanced Event Data**: Clicking a citation now emits comprehensive file metadata (ID, name, type, download URL) for the previewer.

## 3. General Fixes
- **Autofill Prevention**: Added `autocomplete="off"` to all search inputs to prevent browser interference.

## Overview
This update integrates system alerts (specifically temperature alerts) directly into the AI Chat Panel, replacing the previous modal dialog approach. This provides a unified interface for system notifications and AI interactions.

## Key Changes

### 1. `AIChatPanel.vue`
- **New Message Type**: Added logic to render `alert` type messages with a distinct red/danger style (`.glass-effect-danger`).
- **Sources Support**: Updated `addAlertMessage` and the template to display reference documents (`sources`) within alert cards.
- **Auto-Open**: The chat panel automatically opens when an alert is received.

### 2. `MainView.vue`
- **Logic Refactoring**: Removed the `AIAnalysisModal` trigger logic.
- **Event Emission**: Instead of showing a modal, the component now emits a `trigger-ai-alert` event with analysis results, level, and actions.
- **Data Flow**: High/Low temperature triggers now asynchronously call the backend (n8n), then emit the result to the parent component.

### 3. `AppViewer.vue`
- **Event Handling**: Added a listener for `@trigger-ai-alert` from `MainView`.
- **Ref Access**: Added `aiChatPanelRef` to directly invoke `addAlertMessage` on the chat panel.
- **Action Execution**: Updated `executeAIAction` to support the `locate_room` action type (used in alerts), which switches to the appropriate view and isolates the room in 3D.

## Verification Steps
1.  **Trigger Alert**: Simulate a high temperature event (or wait for one).
2.  **Observe Chat**: The AI Chat Panel should open automatically.
3.  **Check Content**:
    -   Title should be "🔥 高温报警: [Room Name]".
    -   Message should contain the analysis text.
    -   Sources should be listed (if any).
4.  **Test Action**: Click "定位房间" button in the alert card.
    -   The view should switch to Connect/Spaces view (if not already there).
    -   The room should be selected and isolated in the 3D viewer.

## Screenshots
(Placeholders - system generated)

## 4. Source Display Refactoring
To improve the user experience and reliability of document citations:
- **Unified Source List**: Created `AISourceList.vue` to display references as a clean, interactive list of chips below the message, replacing the redundant text-based list.
- **Citation Renumbering**: The backend now renumbers citations in the analysis text (e.g., changing `[17]` to `[1]`) to ensure they matches the 1-based index in the source list.
- **Click Handling Fix**: Resolved an issue where source list items were not clickable by ensuring the backend provides the `id` field (aliasing `docId`) expected by the `AppViewer`'s `open-source` handler.
- **Image Retrieval Fix**: Updated `ai-service.js` to include asset codes in search patterns AND removed the restrictive `.jpg/.png` exclusion filter. This ensures that technical photos (e.g., `AF0201.jpg`) linked to assets or matching their codes are correctly provided as context to the AI.
- **Null Error Fix**: Added a safety check in `ai-service.js` to catch cases where the RAG service returns `null`, preventing the "Cannot read properties of null" crash.
- **Deduplication**: Removed the logic in `ai-service.js` that appended a duplicate "References" text section to the AI response.
