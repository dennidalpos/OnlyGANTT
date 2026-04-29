# Asset brand

Gli asset brand versionati sono in `src/public/brand/` e sono generati da:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/assets/generate-brand-assets.ps1
```

Formati generati:

| File | Uso |
| --- | --- |
| `onlygantt-logo.svg` | Logo scalabile per documentazione, UI e materiali. |
| `onlygantt.ico` | Icona Windows multi-size per setup e shortcut. |
| `icon-16.png`, `icon-24.png`, `icon-32.png`, `icon-48.png`, `icon-256.png` | Icone Windows e favicon raster. |
| `social-og-1200x630.png` | Open Graph e anteprime link 1.91:1. |
| `social-x-large-1200x600.png` | Card social 2:1. |
| `social-linkedin-1200x627.png` | Link preview LinkedIn 1.91:1. |
| `post-square-1080x1080.png` | Post social quadrato. |
| `post-portrait-1080x1350.png` | Post social portrait 4:5. |
| `setup-banner-493x58.png` | Banner setup stile WiX. |
| `setup-dialog-493x312.png` | Dialog bitmap setup stile WiX. |

Le dimensioni icona Windows seguono il set minimo raccomandato da Microsoft: 16, 24, 32, 48 e 256 px.

Riferimenti dimensionali principali:

- Microsoft Learn, Windows app icon construction: 16, 24, 32, 48 e 256 px come set minimo.
- X Developer Platform, Summary Card with Large Image: rapporto 2:1.
- LinkedIn Help, Page post preview: rapporto 1.91:1 con 1200x627 px.
