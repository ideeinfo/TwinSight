# Walkthrough - RDS/Power Network UI Enhancements

## Overview

This walkthrough details the changes made to `PowerNetworkGraph.vue` to support dynamic theme switching (Dark/Light mode), improve component performance under theme changes, and highlight key data aspects (BIM-associated nodes).

## Key Changes

### 1. `PowerNetworkGraph.vue`

#### Dynamic Theme Management
-   Introduced `observeThemeChange` using `MutationObserver` to watch for `html.light` class changes.
-   Forces `initGraph` re-execution on theme switch to handle Canvas re-rendering.
-   Uses CSS variables (`--pg-bg`, `--pg-text`, etc.) for container and toolbar styling, ensuring immediate visual updates.
-   Manually sets `rootContainer.style` properties in JS to handle complex scoped CSS priority issues.

#### G6 Configuration Updates
-   **Theme Property**: Added `theme: isDarkMode() ? 'dark' : 'light'` to G6 initialization.
-   **Mapper Logic**:
    -   `fill`: Now accepts the whole node object `d` instead of just type.
    -   `getNodeFill(d)`: Returns **Orange** (`#E65100`/`#FFF7E6`) if `d.bimGuid` exists, otherwise falls back to theme default (`#1f1f1f`/`#ffffff`).
    -   `stroke`: Uses `getNodeColor(d.nodeType)` for type differentiation (Source=Red, Bus=Yellow, Device=Green, etc.).
-   **Interaction States**:
    -   `state.active` (Hover): Uses theme-adaptive colors (light blue in Light, dark grey in Dark).
    -   `state.selected` (Click): Uses theme-adaptive colors (light blue fill + blue border in Light, dark grey fill + white border in Dark).

#### Tooltip Styling
-   Converted all hardcoded Tooltip colors to CSS variables (`--tt-bg`, `--tt-text`, `--tt-sub`, `--tt-border`).
-   Ensured `.section-title`, `.label`, and `.aspect-code` colors adapt correctly to the theme.

#### Toolbar Logic
-   Removed duplicate "Zoom Out" button logic.
-   Styled buttons using `--pg-btn-color` to ensure visibility in both themes.

## Verification Steps

1.  **Open Power Network View**: Navigate to the RDS Power Network tab.
2.  **Switch Theme**:
    -   Click the theme toggle (user profile -> settings -> theme).
    -   Verify the graph background changes instantly (Black <-> White).
    -   Verify toolbar buttons remain visible and update color.
    -   Verify node text color updates (White <-> Dark Grey).
3.  **Inspect Nodes**:
    -   **BIM Nodes**: Check for nodes that are Orange filled. These indicate a link to a BIM element.
    -   **Standard Nodes**: Check for nodes that follow the theme background color but have colored borders indicating their type.
4.  **Interactions**:
    -   **Hover**: Hover over a node. Verify it highlights slightly (not turn black) and shows a readable tooltip matching the theme.
    -   **Click**: Click a node. Verify it highlights with a distinct border and fill color.
