# Prompt 00: Global Style

以下内容建议作为所有页面 prompt 的开头。

```text
Use the existing TwinSight UI design language.

Design goals:
- Modern, professional, enterprise product UI
- Dark mode first, with full light mode compatibility
- Product UI for BIM, facility management, and engineering workflows
- Functional, dense, readable, and operational
- Not a marketing landing page
- Not playful or consumer-oriented

Visual language:
- Material Design 3 influenced semantic design system
- Primary action color: TwinSight Blue
- Use semantic surface layering instead of decorative gradients
- Prefer dark charcoal surfaces with blue primary actions
- Functional and restrained color usage
- Tables, trees, panels, and dialogs should feel like a real operations tool

Typography:
- Font family: Inter, Segoe UI, sans-serif
- H1: 24px bold
- H2: 20px semibold
- H3: 16px medium
- Body: 14px regular
- Lists, tables, and trees: 12px regular

Component style:
- Prefer Element Plus style component language
- Dialogs should feel like Element Plus dialogs
- Inputs should use subtle filled backgrounds and 4px radius
- Lists and trees should support full-row selection highlight
- Iconography should feel like Element Plus or engineering console icons
- Compact toolbar buttons and compact data tables

Important constraints:
- Match the existing TwinSight product style rather than inventing a new visual language
- Do not redesign the brand
- Do not create a glossy SaaS marketing look
- Avoid glassmorphism, playful illustration systems, oversized cards, or excessive empty space
- Preserve an engineering console feel with compact but readable spacing

Theme tokens:
- Use semantic color tokens instead of arbitrary colors
- Generate both dark and light variants of the same screen
- Keep the information architecture and component hierarchy identical across both themes

TwinSight theme tokens

Dark mode:
- primary: rgb(135 209 235)
- background: rgb(30 31 33)
- surface: rgb(30 31 33)
- surface-container-low: rgb(30 31 33)
- surface-container: rgb(42 43 45)
- surface-container-high: rgb(54 55 57)
- surface-container-highest: rgb(68 70 72)
- on-surface: rgb(227 227 227)
- on-surface-variant: rgb(196 199 197)
- outline: rgb(140 145 147)
- outline-variant: rgb(64 72 76)

Light mode:
- primary: rgb(4 103 126)
- background: rgb(245 250 253)
- surface: rgb(245 250 253)
- surface-container-low: rgb(239 244 247)
- surface-container: rgb(234 239 241)
- surface-container-high: rgb(228 233 236)
- surface-container-highest: rgb(222 227 230)
- on-surface: rgb(23 28 31)
- on-surface-variant: rgb(64 72 76)
- outline: rgb(112 120 124)
- outline-variant: rgb(191 200 204)

Theme application rules:
- Use semantic surface layering for panels, dialogs, cards, tables, and sidebars
- Primary actions use the primary token
- Body text uses on-surface
- Secondary text uses on-surface-variant
- Borders and dividers use outline or outline-variant
- Inputs use filled surfaces with 4px radius
- Tables, trees, panels, and dialogs should feel like a real operations tool

Deliverable:
- Generate a desktop-first product screen
- Keep layout realistic for implementation in a Vue + Element Plus application
```
