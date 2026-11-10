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

function buildListFilter(template) {
  if (!template) return '(objectClass=person)';
  if (!/\{\{\s*username\s*\}\}/.test(template)) return template;
  return template.replace(/\{\{\s*username\s*\}\}/g, '*');
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

function buildSidWithRid(objectSid, rid) {
  const sidString = Buffer.isBuffer(objectSid) ? bufferSidToString(objectSid) : String(objectSid || '');
  if (!sidString) return null;
  const parts = sidString.split('-');
  if (parts.length < 2) return null;
  parts[parts.length - 1] = String(rid);
  return parts.join('-');
}

const PRIMARY_GROUP_RID_ALIASES = new Map([
  [513, 'Domain Users'],
  [512, 'Domain Admins'],
  [514, 'Domain Guests'],
  [515, 'Domain Computers'],
  [516, 'Domain Controllers']
]);

async function resolvePrimaryGroupName(client, entry, config) {
  const primaryGroupId = normalizePrimaryGroupId(entry.primaryGroupID);
  if (!primaryGroupId) return null;

  const alias = PRIMARY_GROUP_RID_ALIASES.get(primaryGroupId);
  if (alias) return alias;

  const groupSid = buildSidWithRid(entry.objectSid, primaryGroupId);
  if (!groupSid) return null;
  const searchBase = config.groupSearchBase || config.baseDn;
  if (!searchBase) return null;

  const filter = `(objectSid=${groupSid})`;
  const { searchEntries } = await client.search(searchBase, {
    scope: 'sub',
    filter,
    attributes: ['distinguishedName', 'dn', 'cn']
  });
  const groupEntry = searchEntries[0];
  if (!groupEntry) return null;
  return groupEntry.cn || extractGroupNameFromDn(groupEntry.dn || groupEntry.distinguishedName);
}

function pickAttribute(entry, attribute) {
  const value = entry?.[attribute];
  if (Array.isArray(value)) {
    return value.length > 0 ? value[0] : null;
  }
  return value ?? null;
}

function pickUserIdentifier(entry) {
  return (
    pickAttribute(entry, 'sAMAccountName')
    || pickAttribute(entry, 'userPrincipalName')
    || pickAttribute(entry, 'cn')
    || pickAttribute(entry, 'displayName')
    || null
  );
}

function normalizeMemberOf(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

const GROUP_ALIASES = new Map([
  ['domain users', ['utenti di dominio']],
  ['utenti di dominio', ['domain users']]
]);

function extractGroupNameFromDn(dn) {
  if (!dn) return null;
  const match = /CN=([^,]+)/i.exec(String(dn));
  return match ? match[1] : null;
}

function normalizeGroupName(name) {
  if (!name) return null;
  return String(name).trim().toLowerCase();
}

function buildGroupNameVariants(name) {
  const normalized = normalizeGroupName(name);
  if (!normalized) return [];
  const variants = new Set([normalized]);
  const aliases = GROUP_ALIASES.get(normalized) || [];
  aliases.forEach((alias) => variants.add(normalizeGroupName(alias)));
  return Array.from(variants);
}

function isGroupNameMatch(requiredName, memberName) {
  const requiredVariants = buildGroupNameVariants(requiredName);
  const memberNormalized = normalizeGroupName(memberName);
  if (!memberNormalized) return false;
  return requiredVariants.includes(memberNormalized);
}

function normalizePrimaryGroupId(value) {
  if (value == null) return null;
  const str = String(value);
  if (!/^\d+$/.test(str)) return null;
  const num = Number(str);
  return Number.isNaN(num) ? null : num;
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
  if (!groupNameOrDn) return { dn: null, rid: null, name: null };
  const isDn = groupNameOrDn.includes('=');
  const safeValue = escapeLdapFilterValue(groupNameOrDn);
  const searchBase = groupSearchBase || baseDn;
  if (!searchBase) {
    return { dn: isDn ? groupNameOrDn : null, rid: null, name: isDn ? extractGroupNameFromDn(groupNameOrDn) : groupNameOrDn };
  }

  const filter = isDn
    ? `(|(distinguishedName=${safeValue})(cn=${safeValue})(sAMAccountName=${safeValue}))`
    : `(|(cn=${safeValue})(sAMAccountName=${safeValue}))`;

  const { searchEntries } = await client.search(searchBase, {
    scope: 'sub',
    filter,
    attributes: ['distinguishedName', 'dn', 'objectSid', 'cn']
  });
  const entry = searchEntries[0];
  if (!entry) {
    return { dn: isDn ? groupNameOrDn : null, rid: null, name: isDn ? extractGroupNameFromDn(groupNameOrDn) : groupNameOrDn };
  }
  const dn = entry.dn || entry.distinguishedName || groupNameOrDn;
  const rid = extractRidFromSid(pickAttribute(entry, 'objectSid'));
  const name = entry.cn || extractGroupNameFromDn(dn) || groupNameOrDn;
  return { dn, rid, name };
}

function isMemberOfGroupByName(entry, requiredGroupName) {
  if (!requiredGroupName) return false;
  const memberOf = normalizeMemberOf(entry.memberOf);
  for (const dn of memberOf) {
    const memberName = extractGroupNameFromDn(dn) || dn;
    if (isGroupNameMatch(requiredGroupName, memberName)) {
      return true;
    }
  }
  return false;
}

function isMemberOfGroupByDn(entry, requiredGroupDn) {
  if (!requiredGroupDn) return false;
  const normalizedRequired = requiredGroupDn.toLowerCase();
  return normalizeMemberOf(entry.memberOf).some((dn) => String(dn).toLowerCase() === normalizedRequired);
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
    let requiredGroupName = null;
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
        requiredGroupName = resolved.name;
      } catch (err) {
        logIfEnabled(config, 'Failed to read required group RID', err.message);
      }
      const groupNameToCheck = requiredGroupName || extractGroupNameFromDn(config.requiredGroupDn) || config.requiredGroupDn;
      const groupDnToCheck = requiredGroupDn || (config.requiredGroupDn.includes('=') ? config.requiredGroupDn : null);
      let inGroup = isMemberOfGroupByName(entry, groupNameToCheck);
      if (!inGroup && groupDnToCheck) {
        inGroup = isMemberOfGroupByDn(entry, groupDnToCheck);
      }
      if (!inGroup && requiredGroupRid) {
        const primaryGroupId = normalizePrimaryGroupId(entry.primaryGroupID);
        inGroup = primaryGroupId === requiredGroupRid;
      }
      if (!inGroup) {
        const primaryGroupName = await resolvePrimaryGroupName(client, entry, config);
        if (primaryGroupName) {
          inGroup = isGroupNameMatch(groupNameToCheck, primaryGroupName);
        }
      }
      if (!inGroup) {
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
    let requiredGroupName = null;
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
        requiredGroupName = resolved.name;
      } catch (err) {
        logIfEnabled(config, 'Failed to read required group RID', err.message);
      }
    }

    const groupNameToCheck = requiredGroupName || extractGroupNameFromDn(config.requiredGroupDn) || config.requiredGroupDn;
    const groupDnToCheck = requiredGroupDn || (config.requiredGroupDn.includes('=') ? config.requiredGroupDn : null);
    let groupOk = !config.requiredGroupDn;
    if (config.requiredGroupDn) {
      groupOk = isMemberOfGroupByName(entry, groupNameToCheck);
      if (!groupOk && groupDnToCheck) {
        groupOk = isMemberOfGroupByDn(entry, groupDnToCheck);
      }
      if (!groupOk && requiredGroupRid) {
        const primaryGroupId = normalizePrimaryGroupId(entry.primaryGroupID);
        groupOk = primaryGroupId === requiredGroupRid;
      }
      if (!groupOk) {
        const primaryGroupName = await resolvePrimaryGroupName(client, entry, config);
        if (primaryGroupName) {
          groupOk = isGroupNameMatch(groupNameToCheck, primaryGroupName);
        }
      }
    }
    return {
      ok: groupOk,
      message: groupOk ? 'Bind/search OK' : 'User not in required group',
      details: {
        dn: entry.dn,
        groupCheck: groupOk,
        requiredGroupDn: groupDnToCheck || null,
        requiredGroupName: groupNameToCheck || null
      },
      code: groupOk ? null : 'GROUP_REQUIRED'
    };
  });
}

async function listLdapUsers(configOverride = {}) {
  const config = { ...buildConfigFromEnv(), ...configOverride };
  if (!config.url || !config.baseDn) {
    return { ok: false, code: 'LDAP_CONFIG_ERROR', message: 'LDAP configuration missing' };
  }

  const filter = buildListFilter(config.userFilter);
  const attributes = [
    'dn',
    'displayName',
    'cn',
    'mail',
    'department',
    'sAMAccountName',
    'userPrincipalName',
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

    let requiredGroupRid = null;
    let requiredGroupDn = null;
    let requiredGroupName = null;
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
        requiredGroupName = resolved.name;
      } catch (err) {
        logIfEnabled(config, 'Failed to resolve required group', err.message);
      }
    }

    const groupNameToCheck = requiredGroupName || extractGroupNameFromDn(config.requiredGroupDn) || config.requiredGroupDn;
    const groupDnToCheck = requiredGroupDn || (config.requiredGroupDn?.includes('=') ? config.requiredGroupDn : null);

    const { searchEntries } = await client.search(config.baseDn, {
      scope: 'sub',
      filter,
      attributes
    });

    const users = [];
    const entries = searchEntries || [];
    for (const entry of entries) {
      if (config.requiredGroupDn) {
        let inGroup = isMemberOfGroupByName(entry, groupNameToCheck);
        if (!inGroup && groupDnToCheck) {
          inGroup = isMemberOfGroupByDn(entry, groupDnToCheck);
        }
        if (!inGroup && requiredGroupRid) {
          const primaryGroupId = normalizePrimaryGroupId(entry.primaryGroupID);
          inGroup = primaryGroupId === requiredGroupRid;
        }
        if (!inGroup) {
          const primaryGroupName = await resolvePrimaryGroupName(client, entry, config);
          if (primaryGroupName) {
            inGroup = isGroupNameMatch(groupNameToCheck, primaryGroupName);
          }
        }
        if (!inGroup) {
          continue;
        }
      }

      const userId = pickUserIdentifier(entry);
      if (!userId) continue;
      const displayName = pickAttribute(entry, 'displayName') || pickAttribute(entry, 'cn') || userId;
      const mail = pickAttribute(entry, 'mail');
      const department = pickAttribute(entry, 'department');
      users.push({
        userId,
        displayName,
        mail: mail || null,
        department: department || null,
        userType: 'ad'
      });
    }

    return { ok: true, users };
  });
}

module.exports = {
  buildConfigFromEnv,
  authenticateLdapUser,
  testLdapConnection,
  listLdapUsers
};
