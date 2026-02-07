# Implementation Plan - RDS/Power Network UI Enhancements

## Problem Analysis

Users reported several UI/UX issues in the Power Network Graph:
1.  **Toolbar Buttons**: Some buttons were duplicate ("Zoom Out"), and in light theme, they were invisible due to color contrast issues (white icon on white background).
2.  **Light Theme**: The power network graph did not adapt to the application's light theme, remaining dark with poor visibility of text and nodes.
3.  **Visualization Grid**: The grid background was not theme-aware and appeared intrusive in light mode.
4.  **Node Visuals**:
    -   Nodes appeared green in light mode due to static color mapping.
    -   Active/hover state turned nodes black in light mode.
    -   Need to highlight nodes that have associated BIM model elements (orange fill).
5.  **Title Style**: The title "Power Network Topology" was too prominent and inconsistent with adjacent tabs.

## Proposed Changes

### 1. Toolbar and Title Refinement
-   Remove duplicate buttons.
-   Reduce title font size and weight.
-   Use CSS variables for toolbar background and text colors to support theming.
-   Ensure buttons use theme-aware colors (visible in both modes).

### 2. Theming Architecture
-   Implement dynamic theme switching in `PowerNetworkGraph.vue`.
-   Use CSS variables (`--pg-bg`, `--pg-text`, etc.) scoped to the component but responsive to global `html.light` class.
-   Use `MutationObserver` to detect theme changes and force-update G6 graph rendering (as Canvas elements need re-draw).
-   Set G6 `theme` property (`dark`/`light`) dynamically.

### 3. Node Styling
-   Remove static style definitions in `loadData` to allow G6 mappers to work dynamically.
-   Implement `getNodeFill(d)` mapper:
    -   **Orange** (`#E65100`/`#FFF7E6`) if `bimGuid` exists (BIM-associated).
    -   **Theme Default** (`#1f1f1f`/`#ffffff`) otherwise.
-   Implement `node.state.active` and `selected` styles:
    -   **Active**: Light blue fill in light mode, dark grey in dark mode.
    -   **Selected**: Blue border with theme-appropriate fill.

### 4. Tooltip Theming
-   Update Tooltip CSS to use variables for background, border, and text colors.
-   Ensure internal elements (section titles, labels) adapt to light theme (e.g., usually dark text on light background).

## Verification Plan

### Automated Checks
-   Ensure build passes with no lint errors for modified Vue/CSS.

### Manual Verification
1.  **Theme Switch**:
    -   Switch to Light Mode: Graph background becomes white, nodes white (or orange), text dark. Toolbar buttons visible.
    -   Switch to Dark Mode: Graph background dark, nodes dark (or orange), text light.
2.  **Node Interaction**:
    -   Hover: Node highlights (not turns black).
    -   Select: Node highlights with blue border.
    -   Verify BIM nodes are Orange.
3.  **Tooltip**:
    -   Hover over node: Tooltip background matches theme (white/black), text readable.
