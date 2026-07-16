# Implementation Plan — SQLite & Real-Time Gantt Sync

This plan details the technical changes to migrate department storage to SQLite, enable real-time synchronization of Gantt chart modifications for users consulting the department, require a mandatory initial setup of the admin password on the first start, and remove legacy reset password code.

## User Review Required

> [!IMPORTANT]
> - **Initial Setup Screen**: The application will block access on first startup if the admin password is not set (either in `ONLYGANTT_ADMIN_PASSWORD` env variable or locally configured). It will present a mandatory setup screen to configure the administrator password.
> - **Legacy Reset Code Removal**: `ONLYGANTT_ADMIN_RESET_CODE` and the related reset/recovery flows are removed.
> - **Simultaneous Department Access**: Multiple users can enter a department. The first one to request modification acquires the lock. Others can view (consult) the department and will receive updates in real-time as the modifier saves their work.

---

## Proposed Changes

### 1. Database Store

#### [NEW] [departmentStore.js](file:///d:/GITHUB/OnlyGANTT/src/server/departmentStore.js)
Implement a SQLite store for departments using Node's native `node:sqlite` (`DatabaseSync`):
- `reparti.db` database in `Data/`.
- Schema: `departments` table storing name and data (JSON representation).
- Legacy JSON migration: Read existing JSON files from `Data/reparti/`, import them into SQLite if not present, and rename files to `.json.migrated`.

---

### 2. Server Real-Time Updates & Admin Setup

#### [MODIFY] [server.js](file:///d:/GITHUB/OnlyGANTT/src/server/server.js)
- Import and initialize `departmentStore` on startup. Run legacy migrations.
- Replace all file-based department CRUD operations with `departmentStore`.
- Implement SSE (Server-Sent Events) endpoint: `/api/projects/:department/events`.
- Broadcast department updates to all listening SSE clients on every save, import, and upload.
- Implement `/api/admin/setup` endpoint to configure the admin password when first run.
- Remove `/api/admin/reset-password` and `ONLYGANTT_ADMIN_RESET_CODE` validation logic.

---

### 3. Client Real-Time Sync & Setup UI

#### [MODIFY] [useProjects.js](file:///d:/GITHUB/OnlyGANTT/src/client/hooks/useProjects.js)
- Open an `EventSource` connection to `/api/projects/:department/events` on load.
- When an update event is received, if the user is in `readOnly` mode (consulting), update the projects state, revision metadata, and validation errors in real-time.

#### [MODIFY] [api.js](file:///d:/GITHUB/OnlyGANTT/src/client/api.js)
- Add `setupAdminPassword` function pointing to `/api/admin/setup`.

#### [MODIFY] [LoginScreen.jsx](file:///d:/GITHUB/OnlyGANTT/src/client/components/LoginScreen.jsx)
- If `authConfig.adminConfigured` is false, render a full-screen Setup form requiring the user to set the admin password before unlocking the normal login screen.
- Remove legacy reset password recovery button and forms.

#### [MODIFY] [HeaderBar.jsx](file:///d:/GITHUB/OnlyGANTT/src/client/components/HeaderBar.jsx)
- Ensure the Lock button is never disabled when read-only unless locked by another user.
- If locked by another user, show their name clearly. If free, show "📝 Abilita Modifica" to let the user start modifying.

---

### 4. Tests

#### [MODIFY] [smoke-check.js](file:///d:/GITHUB/OnlyGANTT/tests/smoke-check.js)
- Update to query the SQLite DB to assert that department passwords are encrypted.
- Remove reset code/recovery test flow and replace it with initial setup API check.

---

## Verification Plan

### Automated Tests
Run full test suite to guarantee compile and regression check pass:
- `npm run test`
- `npm run gate`

### Manual Verification
1. Run application without an admin password configured. Confirm that the mandatory Setup screen appears and blocks access.
2. Open two browser windows on the same department.
   - User A enables editing (gets the lock) and edits a task.
   - User B (consulting) should see the Gantt chart and task list update in real-time when A clicks Save.
