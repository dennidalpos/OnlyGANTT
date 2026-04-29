# Script operativi

Il percorso supportato per sviluppo, verifica, packaging e cleanup passa dagli script npm principali. Gli script PowerShell sotto `scripts/` restano Windows-native e sono classificati per responsabilita'.

## Principali

| Script | Uso supportato |
| --- | --- |
| `scripts/bootstrap.ps1` | Installazione dipendenze tramite `npm run bootstrap`. |
| `scripts/doctor.ps1` | Controllo prerequisiti tramite `npm run doctor`. |
| `scripts/compile.ps1` | Bundle client e manifest runtime tramite `npm run compile`. |
| `scripts/build.ps1` | `doctor` + `compile` tramite `npm run build`. |
| `scripts/test.ps1` | Verifiche automatiche tramite `npm run test`. |
| `scripts/pack.ps1` | Build MSI tramite `npm run pack`. |
| `scripts/publish.ps1` | Publish locale dei pacchetti tramite `npm run publish`. |
| `scripts/clean.ps1` | Cleanup output e runtime locali tramite `npm run clean`. |

## Internal

| Script | Responsabilita' |
| --- | --- |
| `scripts/helpers/common.ps1` | Funzioni condivise per script principali. |
| `scripts/helpers/build-client-bundle.mjs` | Helper esbuild richiamato da `compile.ps1`. |
| `scripts/assets/generate-brand-assets.ps1` | Generazione asset brand versionati. |
| `scripts/packaging/common.ps1` | Funzioni condivise per packaging e test MSI. |
| `scripts/packaging/build-msi.ps1` | Implementazione MSI richiamata da `pack.ps1`. |
| `scripts/packaging/provision-wix.ps1` | Provisioning WiX richiamato dal packaging. |
| `scripts/packaging/msi-install-test.ps1` | Test specialistico richiamato dal packaging validato. |
| `scripts/packaging/msi-upgrade-test.ps1` | Test specialistico richiamato dal packaging validato. |
| `scripts/packaging/msi-uninstall-test.ps1` | Test specialistico richiamato dal packaging validato. |

## Windows service

| Script | Responsabilita' |
| --- | --- |
| `scripts/windows/install-service.ps1` | Installazione servizio Windows tramite NSSM. |
| `scripts/windows/uninstall-service.ps1` | Rimozione servizio Windows. |
| `scripts/windows/start-service.ps1` | Avvio servizio Windows. |
| `scripts/windows/stop-service.ps1` | Stop servizio Windows. |
| `scripts/windows/services-cleanup.ps1` | Cleanup servizio e log runtime. |

## Agents, legacy e rimovibili

Non ci sono script agent o legacy supportati in `scripts/`.

Gli artefatti agent e temporanei non fanno parte del prodotto e sono ignorati o rimossi da `npm run clean`:

- `.playwright-cli/`
- `output/`
- `playwright-report/`
- `tmp/`
- `build/`, `dist/`, `out/`, `publish/`
