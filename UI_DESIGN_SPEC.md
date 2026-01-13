# TwinSight UI Design Specification

## 1. Design Philosophy
- **Modern & Professional**: Clean, flat design with subtle depth (Google Material Design 3 influence).
- **Dark Mode First**: Optimized for data visualization and engineering tools, with full Light Mode support.
- **Semantic Tokens**: All colors and styles are driven by semantic variables (e.g., `--md-sys-color-primary`) rather than hardcoded hex values.

## 2. Color System
The color system is based on Material Design 3 (M3).

### Key Tokens (CSS Variables)
| Token Name | Description | Dark Value (Default) | Light Value |
| :--- | :--- | :--- | :--- |
| `--md-sys-color-primary` | Primary action color | `#38ABDF` (TwinSight Blue) | `#38ABDF` |
| `--md-sys-color-surface` | Card / Panel background | `#0F1416` | `#FFFFFF` |
| `--md-sys-color-surface-container` | Dialog / Hover background | `#1B2023` | `#FAFAFA` |
| `--md-sys-color-outline` | Borders | `#8A9296` | `#79747E` |
| `--md-sys-color-on-surface` | Primary Text | `#DEE3E6` | `#1D1B20` |

### Semantic Aliases
Use these aliases in components for clarity:
- **Lists/Tables**: `--list-bg`, `--list-item-bg-hover`, `--list-border`
- **Inputs**: `--input-bg`, `--input-border`, `--input-text`
- **Dialogs**: `--dialog-bg`, `--dialog-title`

## 3. Typography
- **Font Family**: Inter, Segoe UI, sans-serif.
- **Base Size**: 14px (`--font-size-base`).
- **Small Size**: 12px (`--font-size-sm`) - used for **Lists, Tables, Trees**.
- **Hierarchy**:
  - H1: 24px, Bold (Page Titles)
  - H2: 20px, Semi-Bold (Section Headers)
  - H3: 16px, Medium (Panel Headers)
  - Body: 14px, Regular
  - Lists/Trees: 12px, Regular
  - Caption: 12px, Regular (Labels, Hints)

## 4. Components

### Buttons
- **Primary**: Solid background (`--el-button-bg-color: transparent` + `color-mix` state layers).
- **Secondary/Text**: Transparent background, colored text or outline.
- **Icon Buttons**: `32px` or `24px`, circular hover effect.
- **Toolbar Text Buttons** (`.action-btn`):
  - No `type` attribute (avoid Element Plus default hover).
  - Color: `var(--md-sys-color-primary)` (text + icon).
  - Hover: `color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent)` (light tint).
  - Danger variant: Use `var(--md-sys-color-error)` for delete actions.

### Inputs & Forms
- **Background**: `--md-sys-color-surface-container-highest` (Slightly lighter than background).
- **Border**: None (by default) or transparent. Focus state shows Primary border.
- **Rounded**: `4px` border radius.

### Dialogs & Modals
- **Component**: Use `el-dialog` exclusively. Do not use custom overlays.
- **Styling**:
  - Class: `.custom-dialog` (Global override in `theme.css`).
  - Background: Solid `--md-sys-color-surface-container` (Dark Gray).
  - Input Context: Inputs inside dialogs automatically switch to lighter background for contrast.

### Lists & Trees
- **Selection**: Full-width highlight with `--md-sys-color-secondary-container`.
- **Hover**: `--md-sys-color-surface-container-highest`.
- **Icons**: Use `@element-plus/icons-vue`.

## 5. Development Guidelines
1. **Always use tokens**: Never write hex codes (e.g., `#333`, `#fff`) directly in Vue components. Use `var(--md-sys-color-...)`.
2. **Element Plus First**: Prefer `el-button`, `el-input`, `el-dialog` over native HTML elements.
3. **Scoped CSS**: Keep component-specific layout in `<style scoped>`, but rely on `theme.css` for colors/fonts.
4. **Dark/Light Support**: Test new components in both modes. If a color looks wrong in Light mode, checking `theme.css` global overrides is the first step.
