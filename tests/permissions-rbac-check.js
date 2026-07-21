const assert = require('assert');
const path = require('path');
const { createUserStore } = require('../src/server/userStore');

console.log('Running RBAC & Department Permissions Check...');

const tmpDir = path.join(__dirname, '../artifacts/build/test-tmp-rbac');
const userStore = createUserStore({ dataDir: tmpDir });

// 1. Create a local user
const createRes = userStore.upsertLocalUser('test.supervisor', {
  displayName: 'Test Supervisor',
  password: 'Password123!'
});
assert.strictEqual(createRes.ok, true, 'User creation failed');

// 2. Set department permissions
const permRes = userStore.setUserDepartmentPermissions('test.supervisor', {
  'Reparto A': 'supervisor',
  'Reparto B': 'editor',
  'Reparto C': 'viewer'
});
assert.strictEqual(permRes.ok, true, 'Setting permissions failed');

// 3. Retrieve permissions
const storedPerms = userStore.getUserDepartmentPermissions('test.supervisor');
assert.strictEqual(storedPerms['Reparto A'], 'supervisor');
assert.strictEqual(storedPerms['Reparto B'], 'editor');
assert.strictEqual(storedPerms['Reparto C'], 'viewer');

// 4. Verify in listLocalUsers
const localUsers = userStore.listLocalUsers();
const userItem = localUsers.find(u => u.userId === 'test.supervisor');
assert.ok(userItem, 'User not found in listLocalUsers');
assert.strictEqual(userItem.departmentPermissions['Reparto A'], 'supervisor');

userStore.close();
console.log('RBAC & Department Permissions Check PASSED!');
