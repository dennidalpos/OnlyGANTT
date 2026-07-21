---
name: express-react-app
description: Development, bundling, routing, authentication, and state management for the Express 5 and React 19 web application using official Express.js and React documentation.
---

# Express 5 & React 19 Web Application Skill

This skill provides developer guidelines and official documentation standards for developing, maintaining, and testing the Express 5 server and React 19 frontend in the OnlyGANTT repository.

## Official Documentation References

- **Express 5 Official Documentation**: [Express.js v5 Guide & API Reference](https://expressjs.com/en/5x/api.html)
- **React 19 Official Documentation**: [React Documentation & Hooks Reference](https://react.dev/)
- **`ldapts` Documentation**: [ldapts - Pure TypeScript LDAP client](https://github.com/vesse/node-ldapts)
- **`esbuild` Documentation**: [esbuild - An extremely fast bundler](https://esbuild.github.io/)

---

## Client-Side Architecture (`src/client/`)

### Technology Stack & Bundling
- **Framework**: React 19 (`react^19.2.7`, `react-dom^19.2.7`).
- **Entrypoint**: `src/client/bundle-entry.jsx`.
- **Bundler**: `esbuild^0.28.1` configured via `scripts/support/build-client-bundle.mjs`.
- **Output Bundle**: `artifacts/build/client/app.bundle.js`.
- **Styling**: Vanilla CSS modular system loaded from `src/public/styles/`.

### Component Map
- `HeaderBar`: Brand header, active user status, theme/view toggles.
- `GanttCanvas`: Core SVG/HTML Gantt chart timeline rendering.
- `GanttControls`: Timeline zoom, filter, date range, and view controls.
- `ProjectSidebar`: Department navigation, project tree, and filter sidebar.
- `ProjectForm`: Project creation and editing dialogs.
- `LoginScreen`: Authentication interface supporting local and LDAP authentication.
- `UserManagement` & `SystemSettings`: Administrative configuration tools.
- `AlertsDrawer` & `DialogHost`: Toast alerts, notifications, and modal dialog hosting.

### Key Custom Hooks
- `useAuth`: Encapsulates authentication, user/admin tokens, department selection, and read-only state.
- `useGanttFilters`: Controls view modes, Gantt timeline filters, milestone-only toggles, and scroll state.
- `useProjectDraft`: Manages project creation/editing draft states, form visibility, and dirty flags.
- `useNotifications`: Manages toast alerts, dialog promises, and confirmation flows.
- `useDepartmentLock`: Handles department lock acquisition, heartbeat renewal, release, and conflict handling.
- `useProjects`: Manages project list state, fetching, mutation, and department scoping.

---

## Server-Side Architecture (`src/server/`)

### Technology Stack & Routes
- **Framework**: Express 5 (`express^5.2.1`).
- **Main Server Entry**: `src/server/server.js`.
- **Admin Routing**: `src/server/routes/adminRoutes.js`.
- **File Uploads**: `multer^2.2.0` handling project asset attachments.
- **LDAP Authentication**: `ldapts^9.0.0` providing active directory / LDAP user validation with fallback to local JSON configuration.

### Data Storage & Concurrency Control
- **Database Engine**: 100% SQLite backend persistence using Node.js `node:sqlite` (`DatabaseSync`):
  - **Departments**: `Data/reparti.db` (`departments` table).
  - **User Accounts**: `Data/users/users.db` (`users` table).
  - **Lock Management**: `Data/config/locks.db` (`locks` table).
- **Lock Rules**:
  - Default lock expiration: 60 minutes.
  - Multi-user write safety: All write endpoints must verify lock ownership prior to saving department projects.

---

## Verification & Automated Test Suite

Run the full web application test suite using official PowerShell scripts or direct Node.js calls:

### Official Script:
```powershell
pwsh scripts/test-project.ps1
# or
npm run test
```

### Direct Test Runners:
- **Smoke Check**: `node tests/smoke-check.js`
- **Security Check**: `node tests/security-regression-check.js`
- **Admin Flow Check**: `node tests/admin-flow-regression-check.js`
- **Client Logic Check**: `node tests/client-logic-regression-check.js`
