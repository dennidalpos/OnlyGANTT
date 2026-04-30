const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const SERVER_ENTRY = path.join(__dirname, '..', 'src', 'server', 'server.js');
const HOST = '127.0.0.1';
const PORT = 3321;
const ADMIN_PASSWORD = 'SmokePass123';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createTempDataDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'onlygantt-smoke-'));
  ['reparti', 'config', 'utenti', 'log'].forEach((segment) => {
    fs.mkdirSync(path.join(root, segment), { recursive: true });
  });

  const demoDepartmentPath = path.join(root, 'reparti', 'Demo.json');
  fs.writeFileSync(demoDepartmentPath, JSON.stringify({
    password: null,
    projects: [],
    meta: {
      updatedAt: new Date().toISOString(),
      updatedBy: 'smoke-seed',
      revision: 1
    }
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

function requestText(method, requestPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: HOST,
      port: PORT,
      path: requestPath,
      method,
      headers
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 400) {
          const error = new Error(`HTTP ${res.statusCode}`);
          error.status = res.statusCode;
          error.body = text;
          reject(error);
          return;
        }
        resolve({ status: res.statusCode, text });
      });
    });

    req.on('error', reject);
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
  const server = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      ONLYGANTT_DATA_DIR: dataDir,
      ONLYGANTT_ADMIN_PASSWORD: ADMIN_PASSWORD
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';
  server.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
  server.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });

  try {
    await waitForServerReady();

    const landingPage = await requestText('GET', '/');
    if (!landingPage.text.includes('/assets/app.bundle.js')) {
      throw new Error('Expected landing page to reference the local bundled client asset');
    }
    if (landingPage.text.includes('unpkg.com') || landingPage.text.includes('@babel/standalone')) {
      throw new Error('Landing page must not depend on CDN assets or Babel standalone at runtime');
    }

    const clientBundle = await requestText('GET', '/assets/app.bundle.js');
    if (!clientBundle.text.includes('OnlyGantt')) {
      throw new Error('Expected local client bundle to be served by the application runtime');
    }

    const authConfig = await requestJson('GET', '/api/auth/config');
    if (!authConfig.data?.adminConfigured) {
      throw new Error('Expected admin to be configured during smoke run');
    }

    const adminLogin = await requestJson('POST', '/api/admin/login', {
      userId: 'admin',
      password: ADMIN_PASSWORD
    });

    const userToken = adminLogin.data?.userToken;
    if (!userToken) {
      throw new Error('Admin login did not return a user token');
    }

    const restoredSession = await requestJson('GET', '/api/auth/session', null, {
      'X-User-Token': userToken
    });
    if (restoredSession.data?.userName !== 'admin' || restoredSession.data?.userType !== 'admin') {
      throw new Error('Auth session restore did not return the expected admin user session');
    }

    await requestJson('POST', '/api/departments/Demo/reset-password', {
      newPassword: 'demo-pass'
    }, {
      Authorization: `Bearer ${adminLogin.data?.token}`
    });

    await requestJson('POST', '/api/lock/Demo/acquire', {
      userName: 'admin',
      clientHost: 'smoke-check'
    }, {
      'X-User-Token': userToken
    });

    let unauthorizedReleaseStatus = null;
    try {
      await requestJson('POST', '/api/lock/Demo/release', { userName: 'admin' });
    } catch (err) {
      unauthorizedReleaseStatus = err.status;
    }
    if (unauthorizedReleaseStatus !== 401) {
      throw new Error(`Expected unauthorized release to return 401, got ${unauthorizedReleaseStatus}`);
    }

    await requestJson('POST', '/api/lock/Demo/release', {
      userName: 'admin'
    }, {
      'X-User-Token': userToken
    });

    await requestJson('POST', '/api/auth/logout', {}, {
      'X-User-Token': userToken
    });

    const verifyDepartment = await requestJson('POST', '/api/departments/Demo/verify', {
      password: 'demo-pass'
    });
    if (!verifyDepartment.data?.ok) {
      throw new Error('Department password verification failed');
    }

    const persistedDepartment = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'reparti', 'Demo.json'), 'utf8')
    );
    if (!persistedDepartment.password || typeof persistedDepartment.password !== 'object' || !persistedDepartment.password.hash) {
      throw new Error('Expected hashed department password');
    }

    console.log('Smoke check passed');
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
