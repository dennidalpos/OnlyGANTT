# Brand assets

OnlyGANTT brand assets are versioned under `src/public/brand/`. Browser-level assets that must be reachable at the web root are generated under `src/public/`.

Regenerate the full kit from Windows PowerShell 7+:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/generate-brand-assets.ps1
```

The script uses .NET `System.Drawing` and writes deterministic SVG, PNG, BMP and ICO outputs. Run it when changing the source geometry, text or palette before building packages.

## Brand direction

Product name: `OnlyGANTT`.

Visual direction: compact Gantt chart mark with a dark slate tile, cyan/green/amber vertical bars, and a white timeline baseline. The app UI is a dark operational web tool for Windows-hosted project scheduling, so assets extend the existing dark UI tokens instead of introducing a new design system.

Font stack: the app uses `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`. Generated raster assets use Segoe UI because the target platform is Windows.

Core palette:

| Token | Value | Source |
| --- | --- | --- |
| Background | `#0f172a` | `--bg-primary` |
| Surface | `#1e293b` | `--bg-secondary` |
| Surface light | `#334155` | `--bg-tertiary` |
| Text | `#f8fafc` | `--text-primary` |
| Muted text | `#cbd5e1` | `--text-secondary` |
| Cyan accent | `#38bdf8` | Brand mark |
| Green accent | `#22c55e` | Brand mark |
| Amber accent | `#f59e0b` | `--warning` and brand mark |

Spacing, radius and shadow tokens remain in `src/public/styles/00-foundation.css`. Brand assets use the existing rounded, dark, utilitarian visual language only.

## Generated files

| File | Size or format | Current use |
| --- | --- | --- |
| `src/public/brand/onlygantt-logo.svg` | SVG | GitHub-facing README logo on light backgrounds. |
| `src/public/brand/onlygantt-logo-dark.svg` | SVG | Logo variant for dark surfaces. |
| `src/public/brand/onlygantt-mark.svg` | SVG | Compact source mark. |
| `src/public/brand/onlygantt-app-icon.svg` | SVG | App icon source, same mark geometry. |
| `src/public/favicon.svg` | SVG | Browser favicon source referenced by `src/public/index.html`. |
| `src/public/favicon-32.png` | 32x32 PNG | PNG favicon fallback referenced by `src/public/index.html`. |
| `src/public/apple-touch-icon.png` | 180x180 PNG | Apple touch icon referenced by `src/public/index.html`. |
| `src/public/site.webmanifest` | Web manifest | PWA-style browser metadata referenced by `src/public/index.html`. |
| `src/public/brand/icon-16.png` | 16x16 PNG | Windows ICO source. |
| `src/public/brand/icon-24.png` | 24x24 PNG | Windows ICO source. |
| `src/public/brand/icon-32.png` | 32x32 PNG | Windows ICO source. |
| `src/public/brand/icon-48.png` | 48x48 PNG | Windows ICO source. |
| `src/public/brand/icon-256.png` | 256x256 PNG | Windows ICO source. |
| `src/public/brand/apple-touch-icon.png` | 180x180 PNG | Versioned duplicate of root touch icon generated with the kit. |
| `src/public/brand/favicon-32.png` | 32x32 PNG | Versioned duplicate of root favicon fallback generated with the kit. |
| `src/public/brand/pwa-icon-192.png` | 192x192 PNG | Referenced by `src/public/site.webmanifest`. |
| `src/public/brand/pwa-icon-512.png` | 512x512 PNG | Referenced by `src/public/site.webmanifest`. |
| `src/public/brand/onlygantt.ico` | ICO | MSI uninstall/program entry, setup bootstrapper icon and all-users desktop URL shortcut. |
| `src/public/brand/social-og-1200x630.png` | 1200x630 PNG | Open Graph image referenced by `src/public/index.html`. |
| `src/public/brand/social-x-large-1200x600.png` | 1200x600 PNG | Twitter/X large image referenced by `src/public/index.html`. |
| `src/public/brand/social-linkedin-1200x627.png` | 1200x627 PNG | LinkedIn-style social image. |
| `src/public/brand/post-square-1080x1080.png` | 1080x1080 PNG | Base square announcement/post image. |
| `src/public/brand/post-portrait-1080x1350.png` | 1080x1350 PNG | Base portrait announcement/post image. |
| `src/public/brand/setup-banner-493x58.png` | 493x58 PNG | Portable preview/export of the setup banner. |
| `src/public/brand/setup-dialog-493x312.png` | 493x312 PNG | Portable preview/export of the setup dialog image. |
| `src/public/brand/setup-banner-493x58.bmp` | 493x58 BMP | WiX banner bitmap wired through `WixUIBannerBmp`. |
| `src/public/brand/setup-dialog-493x312.bmp` | 493x312 BMP | WiX dialog bitmap wired through `WixUIDialogBmp`. |

## Consumption

`src/server/server.js` serves `src/public/` as static content, so browser asset paths are absolute web paths such as `/favicon.svg` and `/brand/social-og-1200x630.png`.

`src/public/index.html` consumes favicon, apple touch icon, web manifest, Open Graph image and Twitter/X image metadata.

`tools/wix/Product.wxs` and `tools/wix/Bundle.wxs` receive `src/public/brand/onlygantt.ico` through the packaging scripts. The MSI also writes that ICO path into the all-users `OnlyGANTT.url` desktop shortcut.

`tools/wix/Product.wxs` receives `setup-banner-493x58.bmp` and `setup-dialog-493x312.bmp` through `scripts/support/packaging/build-msi.ps1` for the standard WiX UI bitmaps.

The current MSI creates an all-users desktop URL shortcut named `OnlyGANTT.url`. It does not create a Start Menu shortcut.
