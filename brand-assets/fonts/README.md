Siren brand font export

Primary stack
- Heading: Clash Display 600, 700
- Body: Inter 400, 500, 600
- Mono utility in the current app also resolves to Inter

Exported files
- `clash-display-600.ttf`
- `clash-display-700.ttf`
- `inter-400.ttf`
- `inter-500.ttf`
- `inter-600.ttf`
- `siren-brand-fonts.css`

Source of truth in app
- `apps/web/src/app/globals.css`
- `apps/web/src/app/layout.tsx`

Usage
- Import `siren-brand-fonts.css`
- Use `var(--font-heading)` for headlines
- Use `var(--font-body)` for body copy
- Use `var(--font-mono)` for the app's current mono utility
