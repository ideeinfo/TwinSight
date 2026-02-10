# Refactor AI Source Display

## Goal
Remove redundant "References" text from AI response and create a reusable frontend component for displaying source documents with numerical tags (e.g., `[1] Document.pdf`).

## User Review Required
> [!NOTE]
> This change will remove the text-based "References" list from the AI's markdown response. Users will rely on the interactive chip list below the message to see references. Inline citations `[1]` in the text will remain and be clickable.

## Proposed Changes

### Backend
#### [MODIFY] [ai-service.js](file:///Volumes/DATA/antigravity/TwinSight/server/services/ai-service.js)
- Remove the logic that appends `### 4. 参考的文档` to the `formattedText`.

### Frontend
#### [NEW] [AISourceList.vue](file:///Volumes/DATA/antigravity/TwinSight/src/components/ai/AISourceList.vue)
- Create a new reusable component to display a list of sources.
- Features:
  - Display `[index]` tag for each source.
  - Consistent styling with `AIChatPanel`.
  - Emit `open-source` event on click.

#### [MODIFY] [AIChatPanel.vue](file:///Volumes/DATA/antigravity/TwinSight/src/components/ai/AIChatPanel.vue)
- Import and use `AISourceList`.
- Remove the inline `v-for` loop for sources.

## Verification Plan
1. Trigger an AI alert or chat and verify:
   - The "References" text section is GONE from the message body.
   - The inline citations `[1]` still work and open the document.
   - The new `AISourceList` component appears below the message.
   - The list items show `[1]`, `[2]` tags.
   - Clicking items in the list opens the document preview.
