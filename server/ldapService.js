const { Client } = require('ldapts');

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function escapeLdapFilterValue(value) {
  return String(value)
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\0/g, '\\00');
}

function buildUserFilter(template, userId) {
  const safeUser = escapeLdapFilterValue(userId);
  return template.replace(/\{\{\s*username\s*\}\}/g, safeUser);
}

function bufferSidToString(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  const revision = buffer.readUInt8(0);
  const subAuthorityCount = buffer.readUInt8(1);
  const authority = buffer.readUIntBE(2, 6);
  const parts = [`S-${revision}-${authority}`];
  for (let i = 0; i < subAuthorityCount; i += 1) {
    const offset = 8 + i * 4;
    parts.push(buffer.readUInt32LE(offset));
  }
  return parts.join('-');
}

function extractRidFromSid(sid) {
  if (!sid) return null;
  const sidString = Buffer.isBuffer(sid) ? bufferSidToString(sid) : String(sid);
  if (!sidString) return null;
  const segments = sidString.split('-');
  const last = segments[segments.length - 1];
  const rid = Number(last);
  return Number.isNaN(rid) ? null : rid;
}

function pickAttribute(entry, attribute) {
  const value = entry?.[attribute];
  if (Array.isArray(value)) {
    return value.length > 0 ? value[0] : null;
  }
  return value ?? null;
}

function normalizeMemberOf(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function buildConfigFromEnv(env = process.env) {
  return {
    enabled: parseBoolean(env.LDAP_ENABLED),
    log: parseBoolean(env.LOG_LDAP),
    url: env.LDAP_URL || '',
    bindDn: env.LDAP_BIND_DN || '',
    bindPassword: env.LDAP_BIND_PASSWORD || '',
    baseDn: env.LDAP_BASE_DN || '',
    userFilter: env.LDAP_USER_FILTER || '(sAMAccountName={{username}})',
    requiredGroupDn: env.LDAP_REQUIRED_GROUP || '',
    groupSearchBase: env.LDAP_GROUP_SEARCH_BASE || '',
    localFallback: parseBoolean(env.LDAP_LOCAL_FALLBACK)
  };
}

function logIfEnabled(config, ...messages) {
  if (config.log) {
    console.info('[LDAP]', ...messages);
  }
}

async function withClient(config, callback) {
  const client = new Client({ url: config.url, timeout: 10000, connectTimeout: 10000 });
  try {
    return await callback(client);
  } finally {
    try {
      await client.unbind();
    } catch (err) {}
  }
}

async function resolveRequiredGroup(client, groupNameOrDn, groupSearchBase, baseDn) {
  if (!groupNameOrDn) return { dn: null, rid: null };
  const isDn = groupNameOrDn.includes('=');
  const safeValue = escapeLdapFilterValue(groupNameOrDn);
  const searchBase = groupSearchBase || baseDn;
  if (!searchBase) {
    return { dn: isDn ? groupNameOrDn : null, rid: null };
  }

  const filter = isDn
    ? `(|(distinguishedName=${safeValue})(cn=${safeValue})(sAMAccountName=${safeValue}))`
    : `(|(cn=${safeValue})(sAMAccountName=${safeValue}))`;

  const { searchEntries } = await client.search(searchBase, {
    scope: 'sub',
    filter,
    attributes: ['distinguishedName', 'dn', 'objectSid']
  });
  const entry = searchEntries[0];
  if (!entry) {
    return { dn: isDn ? groupNameOrDn : null, rid: null };
  }
  const dn = entry.dn || entry.distinguishedName || groupNameOrDn;
  const rid = extractRidFromSid(pickAttribute(entry, 'objectSid'));
  return { dn, rid };
}

function userInRequiredGroup(entry, requiredGroupDn, requiredGroupRid) {
  if (!requiredGroupDn) return true;
  const normalizedRequired = requiredGroupDn.toLowerCase();
  const memberOf = normalizeMemberOf(entry.memberOf).map((dn) => String(dn).toLowerCase());
  if (memberOf.includes(normalizedRequired)) {
    return true;
  }
  const primaryGroupId = Number(entry.primaryGroupID);
  if (Number.isNaN(primaryGroupId) || primaryGroupId <= 0) return false;
  if (!requiredGroupRid) return false;
  return primaryGroupId === requiredGroupRid;
}

async function authenticateLdapUser(credentials, configOverride = {}) {
  const config = { ...buildConfigFromEnv(), ...configOverride };
  if (!config.url || !config.baseDn) {
    return { ok: false, code: 'LDAP_CONFIG_ERROR', message: 'LDAP configuration missing' };
  }

  if (!credentials?.userId || !credentials?.password) {
    return { ok: false, code: 'INVALID_CREDENTIALS', message: 'Missing credentials' };
  }

  const userId = credentials.userId.trim();
  const filter = buildUserFilter(config.userFilter, userId);
  const attributes = [
    'dn',
    'displayName',
    'cn',
    'mail',
    'department',
    'memberOf',
    'primaryGroupID',
    'objectSid'
  ];

  return withClient(config, async (client) => {
    try {
      logIfEnabled(config, 'Binding service account', config.bindDn);
      await client.bind(config.bindDn, config.bindPassword);
    } catch (err) {
      logIfEnabled(config, 'Service bind failed', err.message);
      return { ok: false, code: 'LDAP_DOWN', message: 'LDAP bind failed' };
    }

    logIfEnabled(config, 'Searching user', userId);
    const { searchEntries } = await client.search(config.baseDn, {
      scope: 'sub',
      filter,
      attributes
    });

    if (!searchEntries || searchEntries.length === 0) {
      return { ok: false, code: 'INVALID_CREDENTIALS', message: 'User not found' };
    }

    const entry = searchEntries[0];
    const userDn = entry.dn || entry.distinguishedName;

    let requiredGroupRid = null;
    let requiredGroupDn = null;
    if (config.requiredGroupDn) {
      try {
        const resolved = await resolveRequiredGroup(
          client,
          config.requiredGroupDn,
          config.groupSearchBase,
          config.baseDn
        );
        requiredGroupDn = resolved.dn;
        requiredGroupRid = resolved.rid;
      } catch (err) {
        logIfEnabled(config, 'Failed to read required group RID', err.message);
      }
      const groupToCheck = requiredGroupDn || config.requiredGroupDn;
      if (!userInRequiredGroup(entry, groupToCheck, requiredGroupRid)) {
        return { ok: false, code: 'GROUP_REQUIRED', message: 'User not in required group' };
      }
    }

    try {
      logIfEnabled(config, 'Binding user', userDn);
      await client.bind(userDn, credentials.password);
    } catch (err) {
      logIfEnabled(config, 'User bind failed', err.message);
      return { ok: false, code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' };
    }

    const displayName = pickAttribute(entry, 'displayName') || pickAttribute(entry, 'cn');
    const mail = pickAttribute(entry, 'mail');
    const department = pickAttribute(entry, 'department');

    return {
      ok: true,
      profile: {
        displayName: displayName || userId,
        mail: mail || null,
        department: department || null
      }
    };
  });
}

async function testLdapConnection({ configOverride = {}, testUserId } = {}) {
  const config = { ...buildConfigFromEnv(), ...configOverride };
  if (!config.url || !config.baseDn) {
    return { ok: false, code: 'LDAP_CONFIG_ERROR', message: 'LDAP configuration missing' };
  }

  const filter = testUserId
    ? buildUserFilter(config.userFilter, testUserId)
    : config.userFilter;

  return withClient(config, async (client) => {
    try {
      logIfEnabled(config, 'Testing service bind', config.bindDn);
      await client.bind(config.bindDn, config.bindPassword);
    } catch (err) {
      logIfEnabled(config, 'Service bind test failed', err.message);
      return { ok: false, code: 'LDAP_DOWN', message: 'LDAP bind failed' };
    }

    if (!testUserId) {
      return { ok: true, message: 'Bind OK' };
    }

    const { searchEntries } = await client.search(config.baseDn, {
      scope: 'sub',
      filter,
      attributes: ['dn', 'displayName', 'memberOf', 'primaryGroupID', 'objectSid']
    });

    if (!searchEntries || searchEntries.length === 0) {
      return { ok: false, code: 'USER_NOT_FOUND', message: 'User not found' };
    }

    const entry = searchEntries[0];
    let requiredGroupRid = null;
    let requiredGroupDn = null;
    if (config.requiredGroupDn) {
      try {
        const resolved = await resolveRequiredGroup(
          client,
          config.requiredGroupDn,
          config.groupSearchBase,
          config.baseDn
        );
        requiredGroupDn = resolved.dn;
        requiredGroupRid = resolved.rid;
      } catch (err) {
        logIfEnabled(config, 'Failed to read required group RID', err.message);
      }
    }

    const groupToCheck = requiredGroupDn || config.requiredGroupDn;
    const groupOk = userInRequiredGroup(entry, groupToCheck, requiredGroupRid);
    return {
      ok: groupOk,
      message: groupOk ? 'Bind/search OK' : 'User not in required group',
      details: {
        dn: entry.dn,
        groupCheck: groupOk,
        requiredGroupDn: groupToCheck || null
      },
      code: groupOk ? null : 'GROUP_REQUIRED'
    };
  });
}

module.exports = {
  buildConfigFromEnv,
  authenticateLdapUser,
  testLdapConnection
};
