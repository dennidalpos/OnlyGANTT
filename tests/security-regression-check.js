const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');

const SERVER_ENTRY = path.join(__dirname, '..', 'src', 'server', 'server.js');
const HOST = '127.0.0.1';
const PORT = 3322;
const ADMIN_PASSWORD = 'AdminPass123';
const LOCAL_USER_PASSWORD = 'LocalPass123';
const LDAP_BIND_PASSWORD = 'SuperSecretBindPassword';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashLegacyPassword(password) {
  return crypto.createHash('sha256').update(password, 'utf8').digest('hex');
}

function createTempDataDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'onlygantt-security-'));
  ['reparti', 'config', 'utenti', 'log'].forEach((segment) => {
    fs.mkdirSync(path.join(root, segment), { recursive: true });
  });

  fs.writeFileSync(path.join(root, 'reparti', 'Demo.json'), JSON.stringify({
    password: null,
    projects: [],
    meta: {
      updatedAt: '2026-01-01T00:00:00.000Z',
      updatedBy: 'security-seed',
      revision: 1
    }
  }, null, 2), 'utf8');

  fs.writeFileSync(path.join(root, 'utenti', 'local.user.json'), JSON.stringify({
    userId: 'local.user',
    userIdNormalized: 'local.user',
    type: 'local',
    displayName: 'Local User',
    department: 'Demo',
    passwordHash: hashLegacyPassword(LOCAL_USER_PASSWORD),
    createdAt: '2026-01-01T00:00:00.000Z',
    lastLoginAt: null,
    loginHistory: []
  }, null, 2), 'utf8');

  return root;
}

function requestJson(method, requestPath, body = null, headers = {}) {
  const payload = body == null ? null : JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: HOST,
      port: PORT,
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

async function waitForServerReady() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    try {
      await requestJson('GET', '/api/auth/config');
      return;
    } catch (err) {
      await sleep(250);
    }
  }

  throw new Error('Server did not start within 15 seconds');
}

async function main() {
  const dataDir = createTempDataDir();
  const systemConfigPath = path.join(dataDir, 'config', 'system-config.json');
  const systemConfigLocalPath = path.join(dataDir, 'config', 'system-config.local.json');
  const server = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      ONLYGANTT_DATA_DIR: dataDir,
      ONLYGANTT_ADMIN_PASSWORD: ADMIN_PASSWORD,
      LDAP_ENABLED: 'false',
      LDAP_URL: 'ldap://example.local:389',
      LDAP_BIND_DN: 'CN=svc-onlygantt,OU=Service Accounts,DC=example,DC=local',
      LDAP_BASE_DN: 'DC=example,DC=local',
      LDAP_USER_FILTER: '(sAMAccountName={{username}})'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';
  server.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
  server.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });

  try {
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

    const updatedConfig = await requestJson('POST', '/api/admin/system-config', {
      server: {
        lockTimeoutMinutes: 45,
        userSessionTtlHours: 6,
        adminSessionTtlHours: 4,
        maxUploadBytes: 3145728,
        enableBak: true
      },
      ldap: {
        enabled: false,
        log: false,
        url: 'ldap://example.local:389',
        bindDn: 'CN=svc-onlygantt,OU=Service Accounts,DC=example,DC=local',
        bindPassword: LDAP_BIND_PASSWORD,
        baseDn: 'DC=example,DC=local',
        userFilter: '(sAMAccountName={{username}})',
        requiredGroupDn: '',
        groupSearchBase: '',
        localFallback: false
      },
      https: {
        enabled: false,
        keyPath: '',
        certPath: ''
      }
    }, authHeaders);
    if (updatedConfig.data?.server?.lockTimeoutMinutes !== 45) {
      throw new Error('Expected server settings update to persist via /api/admin/system-config');
    }

    const systemConfig = await requestJson('GET', '/api/admin/system-config', null, authHeaders);
    if (systemConfig.data?.ldap?.bindPasswordSet !== true) {
      throw new Error('Expected bindPasswordSet to report saved LDAP secret');
    }
    if (Object.prototype.hasOwnProperty.call(systemConfig.data?.ldap || {}, 'bindPassword')) {
      throw new Error('LDAP bind password must not be exposed by /api/admin/system-config');
    }

    const persistedSystemConfig = JSON.parse(fs.readFileSync(systemConfigPath, 'utf8'));
    if (Object.prototype.hasOwnProperty.call(persistedSystemConfig.ldap || {}, 'bindPassword')) {
      throw new Error('Tracked system-config.json must not persist the LDAP bind password');
    }

    const persistedLocalSystemConfig = JSON.parse(fs.readFileSync(systemConfigLocalPath, 'utf8'));
    if (persistedLocalSystemConfig?.ldap?.bindPassword !== LDAP_BIND_PASSWORD) {
      throw new Error('Expected local system config sidecar to retain the LDAP bind password');
    }

    const exportResult = await requestJson('POST', '/api/admin/export', {
      modules: {
        departments: false,
        users: false,
        settings: true
      }
    }, authHeaders);

    const exportedLdapConfig = exportResult.data?.modules?.settings?.data?.systemConfig?.ldap;
    if (!exportedLdapConfig || exportedLdapConfig.bindPasswordSet !== true) {
      throw new Error('Expected exported settings to retain bindPasswordSet metadata');
    }
    if (Object.prototype.hasOwnProperty.call(exportedLdapConfig, 'bindPassword')) {
      throw new Error('LDAP bind password must not be exported in modular settings backup');
    }

    const legacyBackup = await requestJson('GET', '/api/admin/server-backup', null, authHeaders);
    if (!Array.isArray(legacyBackup.data?.departments)) {
      throw new Error('Expected legacy server backup to include departments');
    }
    if (legacyBackup.data?.serverConfig?.lockTimeoutMinutes !== 45) {
      throw new Error('Expected legacy server backup to include persisted server settings');
    }

    let unsupportedModuleError = null;
    try {
      await requestJson('POST', '/api/admin/export', {
        modules: {
          integrations: true
        }
      }, authHeaders);
    } catch (err) {
      unsupportedModuleError = err;
    }
    if (!unsupportedModuleError || unsupportedModuleError.status !== 400 || unsupportedModuleError.code !== 'INVALID_REQUEST') {
      throw new Error('Expected unsupported modular export selection to be rejected');
    }

    await requestJson('POST', '/api/admin/import', {
      backup: exportResult.data,
      modules: {
        departments: false,
        users: false,
        settings: true
      },
      overwriteExisting: true
    }, authHeaders);

    const importedSystemConfig = await requestJson('GET', '/api/admin/system-config', null, authHeaders);
    if (importedSystemConfig.data?.ldap?.bindPasswordSet !== true) {
      throw new Error('Expected LDAP bind password metadata to survive settings import');
    }

    const importedLocalSystemConfig = JSON.parse(fs.readFileSync(systemConfigLocalPath, 'utf8'));
    if (importedLocalSystemConfig?.ldap?.bindPassword !== LDAP_BIND_PASSWORD) {
      throw new Error('Expected local LDAP bind password sidecar to survive settings import');
    }

    await requestJson('POST', '/api/admin/system-config', {
      server: {
        lockTimeoutMinutes: 99,
        userSessionTtlHours: 12,
        adminSessionTtlHours: 10,
        maxUploadBytes: 1048576,
        enableBak: false
      },
      ldap: {
        enabled: false,
        log: false,
        url: 'ldap://mutated.example.local:389',
        bindDn: 'CN=mutated,DC=example,DC=local',
        bindPassword: LDAP_BIND_PASSWORD,
        baseDn: 'DC=example,DC=local',
        userFilter: '(uid={{username}})',
        requiredGroupDn: '',
        groupSearchBase: '',
        localFallback: false
      },
      https: {
        enabled: false,
        keyPath: '',
        certPath: ''
      }
    }, authHeaders);

    const legacyRestore = await requestJson('POST', '/api/admin/server-restore', {
      backup: legacyBackup.data,
      overwriteExisting: true
    }, authHeaders);
    if ((legacyRestore.data?.summary?.settingsApplied || 0) < 1) {
      throw new Error('Expected legacy server restore to re-apply stored settings');
    }

    const restoredFromLegacy = await requestJson('GET', '/api/admin/system-config', null, authHeaders);
    if (restoredFromLegacy.data?.server?.lockTimeoutMinutes !== 45) {
      throw new Error('Expected legacy restore to roll back server settings to the backup snapshot');
    }
    if (restoredFromLegacy.data?.ldap?.bindPasswordSet !== true) {
      throw new Error('Expected legacy restore to preserve LDAP bind password metadata');
    }

    let invalidUserError = null;
    try {
      await requestJson('POST', '/api/admin/users/local', {
        userId: '../escape',
        displayName: 'Escape',
        password: 'EscapePass123'
      }, authHeaders);
    } catch (err) {
      invalidUserError = err;
    }
    if (!invalidUserError || invalidUserError.status !== 400 || invalidUserError.code !== 'INVALID_USER') {
      throw new Error('Expected invalid local user id creation to be rejected with INVALID_USER');
    }
    if (fs.existsSync(path.join(dataDir, 'escape.json'))) {
      throw new Error('Invalid local user id must not create files outside the user store');
    }

    const invalidImport = await requestJson('POST', '/api/admin/import', {
      backup: {
        version: '2.0',
        modules: {
          users: {
            data: [{
              userId: '../escape',
              userIdNormalized: '../escape',
              type: 'local',
              displayName: 'Escape',
              passwordHash: hashLegacyPassword('EscapePass123')
            }]
          }
        }
      },
      modules: {
        departments: false,
        users: true,
        settings: false
      },
      overwriteExisting: true
    }, authHeaders);
    if ((invalidImport.data?.results?.users?.skipped || []).length !== 1) {
      throw new Error('Expected invalid imported user ids to be skipped');
    }
    if ((invalidImport.data?.results?.users?.errors || []).length !== 0) {
      throw new Error('Invalid imported user ids should be rejected cleanly without write errors');
    }

    const userLogin = await requestJson('POST', '/api/auth/login', {
      userId: 'local.user',
      password: LOCAL_USER_PASSWORD,
      department: 'Demo'
    });
    if (userLogin.data?.authType !== 'local' || !userLogin.data?.token) {
      throw new Error('Expected local user login to succeed');
    }

    const storedUser = JSON.parse(fs.readFileSync(path.join(dataDir, 'utenti', 'local.user.json'), 'utf8'));
    if (!storedUser.passwordHash || typeof storedUser.passwordHash !== 'object' || storedUser.passwordHash.algorithm !== 'scrypt') {
      throw new Error('Expected successful local login to migrate legacy password hash to scrypt');
    }

    console.log('Security regression check passed');
  } finally {
    server.kill('SIGTERM');
    await sleep(250);
    fs.rmSync(dataDir, { recursive: true, force: true });
    if (server.exitCode && server.exitCode !== 0) {
      console.error(stdout);
      console.error(stderr);
      process.exit(server.exitCode);
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
