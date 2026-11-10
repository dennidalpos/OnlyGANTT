function createBackupService({ configService, departmentStore, userStore, lockStore, validateDepartmentData, normalizeDepartmentName, writeDepartmentData }) {
  function normalizeModules(modules = {}) {
    return {
      departments: !!modules.departments,
      users: !!modules.users,
      settings: !!modules.settings
    };
  }

  function hasSelectedModules(modules) {
    return Object.values(modules).some(Boolean);
  }

  function collectDepartmentBackups() {
    const names = departmentStore.list();
    const departments = [];

    for (const deptName of names) {
      const data = departmentStore.get(deptName);
      if (!data) continue;
      departments.push({
        name: deptName,
        data
      });
    }

    return departments;
  }

  function buildModularBackup(modules) {
    return {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      modules: {
        departments: modules.departments ? { data: collectDepartmentBackups() } : { data: null },
        users: modules.users ? { data: userStore.exportUsers() } : { data: null },
        settings: modules.settings ? {
          data: {
            systemConfig: configService.getSystemConfigState(),
            serverConfig: {
              lockTimeoutMinutes: configService.CONFIG.lockTimeoutMinutes,
              userSessionTtlHours: configService.CONFIG.userSessionTtlHours,
              adminSessionTtlHours: configService.CONFIG.adminSessionTtlHours,
              maxUploadBytes: configService.CONFIG.maxUploadBytes,
              enableBak: configService.CONFIG.enableBak
            },
            adminCredentials: {
              adminUser: configService.CONFIG.adminUser
            }
          }
        } : { data: null }
      }
    };
  }

  function applyImportedSettings(payload = {}) {
    const serverConfig = payload.serverConfig || {};
    const adminCredentials = payload.adminCredentials || {};
    const systemConfig = payload.systemConfig || {};
    const applied = {};

    if (systemConfig && typeof systemConfig === 'object') {
      configService.applySystemConfig(systemConfig);
      configService.writeSystemConfig(configService.getSystemConfigState());
      if (Object.keys(systemConfig).length > 0) {
        applied.systemConfig = true;
      }
    }

    if (typeof serverConfig.lockTimeoutMinutes === 'number') {
      configService.CONFIG.lockTimeoutMinutes = serverConfig.lockTimeoutMinutes;
      applied.lockTimeoutMinutes = configService.CONFIG.lockTimeoutMinutes;
    }
    if (typeof serverConfig.userSessionTtlHours === 'number') {
      configService.CONFIG.userSessionTtlHours = serverConfig.userSessionTtlHours;
      applied.userSessionTtlHours = configService.CONFIG.userSessionTtlHours;
    }
    if (typeof serverConfig.adminSessionTtlHours === 'number') {
      configService.CONFIG.adminSessionTtlHours = serverConfig.adminSessionTtlHours;
      applied.adminSessionTtlHours = configService.CONFIG.adminSessionTtlHours;
    }
    if (typeof serverConfig.maxUploadBytes === 'number') {
      configService.CONFIG.maxUploadBytes = serverConfig.maxUploadBytes;
      applied.maxUploadBytes = configService.CONFIG.maxUploadBytes;
    }
    if (typeof serverConfig.enableBak === 'boolean') {
      configService.CONFIG.enableBak = serverConfig.enableBak;
      applied.enableBak = configService.CONFIG.enableBak;
    }
    if (typeof adminCredentials.adminUser === 'string' && adminCredentials.adminUser.trim()) {
      configService.persistAdminUser(adminCredentials.adminUser);
      applied.adminUser = configService.CONFIG.adminUser;
    }

    if (Object.keys(applied).length > 0) {
      configService.writeSystemConfig(configService.getSystemConfigState());
    }

    return applied;
  }

  function importDepartmentsBackup(departments, overwriteExisting) {
    const results = {
      imported: [],
      skipped: [],
      errors: []
    };

    for (const dept of departments) {
      if (!dept.name || !dept.data) {
        results.errors.push({
          department: dept.name || 'unknown',
          error: 'Missing name or data'
        });
        continue;
      }

      const normalized = normalizeDepartmentName(dept.name);
      if (!normalized) {
        results.errors.push({
          department: dept.name,
          error: 'Invalid department name'
        });
        continue;
      }

      if (departmentStore.exists(normalized) && !overwriteExisting) {
        results.skipped.push({
          department: normalized,
          reason: 'Already exists (use overwriteExisting flag to replace)'
        });
        continue;
      }

      try {
        const errors = validateDepartmentData(dept.data);
        if (errors.length > 0) {
          results.errors.push({
            department: normalized,
            error: 'Validation failed',
            details: errors
          });
          continue;
        }

        const dataToWrite = {
          ...dept.data,
          meta: {
            ...dept.data.meta,
            importedAt: new Date().toISOString(),
            importedBy: 'admin'
          }
        };

        writeDepartmentData(normalized, dataToWrite);
        results.imported.push(normalized);

        lockStore.remove(normalized);
      } catch (err) {
        results.errors.push({
          department: normalized,
          error: err.message
        });
      }
    }

    return results;
  }

  return {
    normalizeModules,
    hasSelectedModules,
    collectDepartmentBackups,
    buildModularBackup,
    applyImportedSettings,
    importDepartmentsBackup
  };
}

module.exports = { createBackupService };
