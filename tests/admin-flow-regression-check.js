const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const SERVER_ENTRY = path.join(__dirname, '..', 'src', 'server', 'server.js');
const HOST = '127.0.0.1';
const PORT = 3323;
const ADMIN_PASSWORD = 'AdminPass123';
const LOCAL_USER_ID = 'local.test';
const LOCAL_USER_PASSWORD = 'LocalPass123';
const DEPARTMENT_NAME = 'Demo';
const RESET_DEPARTMENT_PASSWORD = 'DeptReset123';
const CHANGED_DEPARTMENT_PASSWORD = 'DeptChanged123';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createTempDataDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'onlygantt-admin-flow-'));
  ['reparti', 'config', 'utenti', 'log'].forEach((segment) => {
    fs.mkdirSync(path.join(root, segment), { recursive: true });
  });

  fs.writeFileSync(path.join(root, 'reparti', 'Demo.json'), JSON.stringify({
    password: null,
    projects: [],
    meta: {
      updatedAt: '2026-01-01T00:00:00.000Z',
      updatedBy: 'admin-flow-seed',
      revision: 1
    }
  }, null, 2), 'utf8');

  return root;
}

function requestJson(method, requestPath, body = null, headers = {}, port = PORT) {
  const payload = body == null ? null : JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: HOST,
      port,
      path: requestPath,
      method,
      headers: {
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers
      }
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        const data = text ? JSON.parse(text) : null;
        if (res.statusCode >= 400) {
          const error = new Error(data?.error?.message || `HTTP ${res.statusCode}`);
          error.status = res.statusCode;
          error.code = data?.error?.code;
          error.data = data;
          reject(error);
          return;
        }

        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function waitForServerReady(port = PORT) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    try {
      await requestJson('GET', '/api/auth/config', null, {}, port);
      return;
    } catch (err) {
      await sleep(250);
    }
  }

  throw new Error(`Server did not start on port ${port} within 15 seconds`);
}

function startServer(dataDir, envOverrides = {}, port = PORT) {
  const server = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      ONLYGANTT_DATA_DIR: dataDir,
      ONLYGANTT_ADMIN_PASSWORD: ADMIN_PASSWORD,
      ...envOverrides
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';
  server.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
  server.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });

  return { server, getStdout: () => stdout, getStderr: () => stderr };
}

async function stopServer(serverContext) {
  if (!serverContext?.server) {
    return;
  }

  serverContext.server.kill('SIGTERM');
  await sleep(300);

  if (serverContext.server.exitCode && serverContext.server.exitCode !== 0) {
    throw new Error([
      'Server exited with an error during admin flow regression check.',
      serverContext.getStdout(),
      serverContext.getStderr()
    ].filter(Boolean).join('\n'));
  }
}

async function main() {
  const dataDir = createTempDataDir();
  let serverContext = null;

  try {
    serverContext = startServer(dataDir);
    await waitForServerReady();

    const adminLogin = await requestJson('POST', '/api/admin/login', {
      userId: 'admin',
      password: ADMIN_PASSWORD
    });
    const adminToken = adminLogin.data?.token;
    if (!adminToken) {
      throw new Error('Admin login did not return an admin token');
    }

    const authHeaders = {
      Authorization: `Bearer ${adminToken}`
    };

    const createdUser = await requestJson('POST', '/api/admin/users/local', {
      userId: LOCAL_USER_ID,
      displayName: 'Local Test User',
      department: DEPARTMENT_NAME,
      password: LOCAL_USER_PASSWORD
    }, authHeaders);
    if (!createdUser.data?.ok || createdUser.data?.created !== true) {
      throw new Error('Expected local user creation to succeed');
    }

    const localUsers = await requestJson('GET', '/api/admin/users', null, authHeaders);
    const listedLocalUser = (localUsers.data?.users || []).find((user) => user.userId === LOCAL_USER_ID);
    if (!listedLocalUser || listedLocalUser.userType !== 'local') {
      throw new Error('Expected local user to appear in admin user listing');
    }

    const localLogin = await requestJson('POST', '/api/auth/login', {
      userId: LOCAL_USER_ID,
      password: LOCAL_USER_PASSWORD,
      department: DEPARTMENT_NAME
    });
    if (localLogin.data?.authType !== 'local' || !localLogin.data?.token) {
      throw new Error('Expected local user login to succeed');
    }

    await requestJson('POST', `/api/departments/${encodeURIComponent(DEPARTMENT_NAME)}/reset-password`, {
      newPassword: RESET_DEPARTMENT_PASSWORD
    }, authHeaders);

    const verifyResetPassword = await requestJson('POST', `/api/departments/${encodeURIComponent(DEPARTMENT_NAME)}/verify`, {
      password: RESET_DEPARTMENT_PASSWORD
    });
    if (!verifyResetPassword.data?.ok) {
      throw new Error('Expected reset department password to be immediately valid');
    }

    await requestJson('POST', `/api/departments/${encodeURIComponent(DEPARTMENT_NAME)}/change-password`, {
      oldPassword: RESET_DEPARTMENT_PASSWORD,
      newPassword: CHANGED_DEPARTMENT_PASSWORD
    });

    let oldDepartmentPasswordError = null;
    try {
      await requestJson('POST', `/api/departments/${encodeURIComponent(DEPARTMENT_NAME)}/verify`, {
        password: RESET_DEPARTMENT_PASSWORD
      });
    } catch (err) {
      oldDepartmentPasswordError = err;
    }
    if (!oldDepartmentPasswordError || oldDepartmentPasswordError.status !== 401) {
      throw new Error('Expected previous department password to stop working after change');
    }

    const verifyChangedPassword = await requestJson('POST', `/api/departments/${encodeURIComponent(DEPARTMENT_NAME)}/verify`, {
      password: CHANGED_DEPARTMENT_PASSWORD
    });
    if (!verifyChangedPassword.data?.ok) {
      throw new Error('Expected changed department password to be valid');
    }

    const exportResult = await requestJson('POST', '/api/admin/export', {
      modules: {
        departments: false,
        users: true,
        settings: false
      }
    }, authHeaders);

    const exportedUsers = exportResult.data?.modules?.users?.data || [];
    if (!Array.isArray(exportedUsers) || !exportedUsers.some((user) => user.userId === LOCAL_USER_ID)) {
      throw new Error('Expected modular export to include the managed local user');
    }

    await requestJson('DELETE', `/api/admin/users/local/${encodeURIComponent(LOCAL_USER_ID)}`, null, authHeaders);

    let deletedUserLoginError = null;
    try {
      await requestJson('POST', '/api/auth/login', {
        userId: LOCAL_USER_ID,
        password: LOCAL_USER_PASSWORD,
        department: DEPARTMENT_NAME
      });
    } catch (err) {
      deletedUserLoginError = err;
    }
    if (!deletedUserLoginError || deletedUserLoginError.status !== 401 || deletedUserLoginError.code !== 'INVALID_CREDENTIALS') {
      throw new Error('Expected deleted local users to be unable to log in');
    }

    const importResult = await requestJson('POST', '/api/admin/import', {
      backup: exportResult.data,
      modules: {
        departments: false,
        users: true,
        settings: false
      },
      overwriteExisting: true
    }, authHeaders);
    if ((importResult.data?.results?.users?.imported || []).length !== 1) {
      throw new Error('Expected modular import to restore the exported local user');
    }

    const restoredLogin = await requestJson('POST', '/api/auth/login', {
      userId: LOCAL_USER_ID,
      password: LOCAL_USER_PASSWORD,
      department: DEPARTMENT_NAME
    });
    if (restoredLogin.data?.authType !== 'local' || !restoredLogin.data?.token) {
      throw new Error('Expected restored local user to log in successfully');
    }

    await stopServer(serverContext);
    serverContext = null;

    serverContext = startServer(dataDir, {
      LDAP_ENABLED: 'true',
      LDAP_LOCAL_FALLBACK: 'true',
      LDAP_URL: 'ldap://127.0.0.1:1',
      LDAP_BIND_DN: 'CN=svc-onlygantt,OU=Service Accounts,DC=example,DC=local',
      LDAP_BIND_PASSWORD: 'irrelevant-secret',
      LDAP_BASE_DN: 'DC=example,DC=local',
      LDAP_USER_FILTER: '(sAMAccountName={{username}})'
    }, PORT + 1);
    await waitForServerReady(PORT + 1);

    const fallbackLogin = await requestJson('POST', '/api/auth/login', {
      userId: LOCAL_USER_ID,
      password: LOCAL_USER_PASSWORD,
      department: DEPARTMENT_NAME
    }, {}, PORT + 1);
    if (fallbackLogin.data?.authType !== 'local' || !fallbackLogin.data?.token) {
      throw new Error('Expected LDAP local fallback login to return a local session');
    }

    console.log('Admin flow regression check passed');
  } finally {
    await stopServer(serverContext).catch(() => {});
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
