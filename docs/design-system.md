# CraftScript Dashboard — Design System

TL;DR for contributors and agents working in `cs_ng_app_client` (the DeFi dashboard at `app.craftscript.com`).

> **Marketing site:** Landing pages, hero backgrounds, and Launch App live in `cs_nextjs_client`. See `cs_nextjs_client/docs/design-system.md` for marketing-specific patterns.

## Grid

| Breakpoint | Columns |
|------------|---------|
| Mobile (`< 768px`) | 4 |
| Desktop (`≥ 768px`) | 7 |

Full viewport width, no max-width container. Header, sidebar, and content share the same column tracks.

| Area | Desktop placement |
|------|-------------------|
| Logo | Column 1 |
| Sidebar | Column 1 |
| Main content | Columns 2–7 |
| Connect Wallet | Columns 6–7 |

## Chrome

- Header height: **64px** (`--shell-header-height: 4rem`)
- Mobile bottom nav: same height

## Colors

| Token | Hex |
|-------|-----|
| Orange (primary) | `#FE6C00` |
| Black (background) | `#171c1f` |
| Grid lines | `#d4d4d3` |
| Gray decorative | `#CFCBD2` |
| White text | `#fff` |

Source of truth: `src/assets/styles/default-theme-colors.css`.

## Exchange page

Styles live in `src/styles/exchange-page.scss` under `.exchange-page`. Use shell color variables; panel border colors may be darker than shell grid lines.

## Cursor rule

Agents load `.cursor/rules/design-system.mdc` automatically for layout and styling guidance.
