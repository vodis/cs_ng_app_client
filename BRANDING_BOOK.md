# CraftScript Branding Book

This file is a quick visual reference for the app shell and dashboard UI.

## Palette

Core brand colors:

- `--main-bg-color`: `#171c1f` - main app background
- `--main-border-color`: `#d4d4d3` - dividers, shell lines, borders
- `--main-text-color`: `#ffffff` - primary text on dark surfaces
- `--primary-text-color`: `#fe6c00` - accent orange, CTA, active states
- `--secondary-text-color`: `#767676` - muted labels and supporting text
- `--gray-30`: `#cfcbd2` - decorative gray copy
- `--gray-100`: `#080708` - dark text on light contexts

Material token overrides:

- Primary: orange `#fe6c00`
- Secondary: gray `#767676`
- On primary: white `#ffffff`

## Font Stack

Primary app sans stack:

```css
ui-sans-serif, system-ui, -apple-system, 'system-ui', 'Segoe UI', Roboto,
'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji',
'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'
```

Project-specific fonts:

- `Aeonik Fono` - numeric and monospace-like accent usage
- `GTF Adieu TRIAL` - bundled, but current display headings use `KodeMono, sans-serif`

## Typography Sizes

Base sizing:

- Root/base size: `16px`
- Body default: `1.6rem` (`25.6px`)
- Mobile body: `1.4rem` (`22.4px`)

Heading scale:

- `h1` / `.h1`: `5rem`, mobile `3rem`, `700`, uppercase
- `h2` / `.h2`: `3.6rem`, mobile `2.8rem`, `700`, lowercase
- `h3` / `.h3`: `2.5rem`, mobile `1.8rem`, `400`, lowercase
- `h4` / `.h4`, `h5`, `h6`: `1.8rem`, `400`

Utility text:

- `.subtitle`: `1.2rem`, uppercase
- `.body-1`: `1.6rem`, mobile `1.4rem`
- `.caption`: `max(1rem, 11px)`, uppercase

Number styles:

- `.number-1`: `4.8rem`, mobile `3.8rem`
- `.number-2`: `2.5rem`, mobile `2rem`
- `.number-3`: `1.8rem`, mobile `2rem`

## Spacing And Padding

Grid margins by breakpoint:

- `xs`: `1rem` (`16px`)
- `sm`: `1.6rem` (`25.6px`)
- `md`: `2.4rem` (`38.4px`)
- `lg`: `3rem` (`48px`)
- `xl`: `4rem` (`64px`)
- `2xl`: `4rem` (`64px`)

Grid gutters by breakpoint:

- `xs`: `0.9rem` (`14.4px`)
- `sm`: `1.2rem` (`19.2px`)
- `md`: `1.2rem` (`19.2px`)
- `lg`: `1.2rem` (`19.2px`)
- `xl`: `1.6rem` (`25.6px`)
- `2xl`: `1.6rem` (`25.6px`)

Common shell measurements:

- Header height: `4rem` (`64px`)
- Mobile bottom nav height: `4rem` (`64px`)
- Scrollable shell area: `calc(100vh - 4rem)`

## Mobile Measurements

Mobile app shell applies below `768px`.

- Mobile breakpoint: `< 768px`
- Shell grid columns: `4`
- Header height: `64px`
- Bottom navigation height: `64px`
- Typical horizontal shell margin: `16px` on `xs`, `25.6px` on `sm`

Recommended reference widths:

- Small mobile: `320px`
- Standard mobile: `360px`
- Large mobile: `390px`
- Mobile max before tablet/desktop shell change: `767px`

## Laptop Dimensions

Useful laptop range in this project:

- `lg`: `976px` and up
- Laptop working range: `976px - 1439px`

Recommended laptop reference widths:

- Small laptop: `1024px`
- Standard laptop: `1280px`
- Large laptop: `1366px`

Shell behavior:

- Desktop shell is already active from `768px+`
- At laptop widths, the app still uses the `7`-column shell
- Main content spans columns `2-7`
- Sidebar stays in column `1`

## Desktop Dimensions

Large desktop breakpoint:

- `xl`: `1440px`
- `2xl`: `1536px`

Recommended desktop reference widths:

- Desktop baseline: `1440px`
- Large desktop: `1536px`
- Wide desktop: `1728px` or `1920px`

Typography behavior on large desktop:

- Up to `1440px`, root size stays at `16px`
- In the `xl` band, root size scales fluidly with viewport width

## Layout Structure

Shell layout is one of the most important parts of this branding book. The app
frame, header, sidebar, divider, and routed content must stay aligned to the
same shell grid. This is not just a visual preference: the shell layout is
protected by E2E tests and should be treated as a contract.

Shell grid:

- Mobile: `4` columns
- Desktop and up: `7` columns

Desktop placement:

- Logo: column `1`
- Sidebar: column `1`
- Divider: end of column `1`
- Main content: columns `2-7`

Rules:

- Full viewport width
- No max-width page container
- Use `--main-border-color` for shell lines
- Keep shell chrome aligned across header, sidebar, and content

Protected shell layout requirements:

- Header height must remain `64px`
- Main content must start directly below the header
- Sidebar width must match the first column of the `7`-column desktop grid
- Vertical divider must stay aligned with the sidebar right edge
- Sidebar, divider, and router content must share the same grid row

E2E coverage:

- Shell layout regression tests live in `e2e/shell-layout.spec.ts`
- When changing shell UI, header, sidebar, divider, or responsive grid
  behavior, preserve those expectations and run the shell layout E2E tests

## Source Of Truth

Main files:

- `src/assets/styles/default-theme-colors.css`
- `src/styles.scss`
- `@vodis/cs-foundation/styles/variables`
- `@vodis/cs-foundation/styles/typography`
- `src/app/components/layout/layout.component.scss`
- `docs/design-system.md`
