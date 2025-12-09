const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, '..', 'data');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.json'];
const MAX_DEPARTMENT_NAME_LENGTH = 50;
const MAX_PASSWORD_LENGTH = 100;
const MIN_PASSWORD_LENGTH = 4;
const RESERVED_NAMES = ['CON', 'PRN', 'AUX', 'NUL'];

let departmentsData = [];
let departmentPasswords = {};
let projectsData = {};
let locksData = {};
let departmentsNeedingPasswordSetup = {};

const validateDepartmentName = (name) => {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Nome reparto non valido' };
  }

  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Nome reparto vuoto' };
  }

  if (trimmed.length > MAX_DEPARTMENT_NAME_LENGTH) {
    return { valid: false, error: 'Nome reparto troppo lungo' };
  }

  if (!/^[a-zA-Z0-9À-ÿ\s_-]+$/.test(trimmed)) {
    return { valid: false, error: 'Nome reparto contiene caratteri non validi' };
  }

  if (RESERVED_NAMES.includes(trimmed)) {
    return { valid: false, error: 'Nome reparto riservato' };
  }

  return { valid: true, name: trimmed };
};

const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password non valida' };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `Password troppo corta (minimo ${MIN_PASSWORD_LENGTH} caratteri)` };
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return { valid: false, error: 'Password troppo lunga' };
  }

  return { valid: true };
};

const validateProjects = (projects) => {
  if (!Array.isArray(projects)) {
    return { valid: false, error: 'I dati devono essere un array' };
  }

  if (projects.length > 1000) {
    return { valid: false, error: 'Troppi progetti (max 1000)' };
  }

  return { valid: true };
};

const ensureDataDir = async () => {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('Errore creazione cartella data:', error);
    throw error;
  }
};

const loadAllData = async () => {
  try {
    await ensureDataDir();

    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    departmentsData = [];
    projectsData = {};
    departmentPasswords = {};
    departmentsNeedingPasswordSetup = {};

    const loadPromises = jsonFiles.map(async (file) => {
      const depName = file.replace('.json', '');
      try {
        const filePath = path.join(DATA_DIR, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        if (data && typeof data === 'object') {
          if (Array.isArray(data)) {
            departmentsData.push(depName);
            projectsData[depName] = data;
            departmentPasswords[depName] = '';
            departmentsNeedingPasswordSetup[depName] = true;
          } else if (data.projects && Array.isArray(data.projects)) {
            departmentsData.push(depName);
            projectsData[depName] = data.projects;
            const hasPassword = typeof data.password === 'string' && data.password.trim() !== '';
            departmentPasswords[depName] = hasPassword ? data.password : '';
            departmentsNeedingPasswordSetup[depName] = !hasPassword;
          }
        }
      } catch (err) {
        console.error(`Errore caricamento ${file}:`, err.message);
      }
    });

    await Promise.all(loadPromises);

    if (!departmentsData.includes('Home')) {
      departmentsData.unshift('Home');
      projectsData['Home'] = [];
      departmentPasswords['Home'] = '';
      departmentsNeedingPasswordSetup['Home'] = false;
      await saveProjects('Home');
    } else {
      departmentsNeedingPasswordSetup['Home'] = false;
    }

    console.log(`✅ Dati caricati: ${departmentsData.length} reparti, ${Object.values(projectsData).reduce((sum, p) => sum + p.length, 0)} progetti totali`);
  } catch (error) {
    console.error('Errore critico nel caricamento dati:', error);
    departmentsData = ['Home'];
    projectsData = { 'Home': [] };
    departmentPasswords = { 'Home': '' };
    departmentsNeedingPasswordSetup = { 'Home': false };
  }
};

const saveProjects = async (department) => {
  const validation = validateDepartmentName(department);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const projectFile = path.join(DATA_DIR, `${validation.name}.json`);
  const projects = projectsData[department] || [];
  const password = departmentPasswords[department] || '';

  const validationResult = validateProjects(projects);
  if (!validationResult.valid) {
    throw new Error(validationResult.error);
  }

  const dataToSave = {
    password: password,
    projects: projects
  };

  try {
    await fs.writeFile(projectFile, JSON.stringify(dataToSave, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Errore salvataggio progetti per ${department}:`, error);
    throw error;
  }
};

const deleteProjectsFile = async (department) => {
  const validation = validateDepartmentName(department);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const projectFile = path.join(DATA_DIR, `${validation.name}.json`);

  try {
    await fs.unlink(projectFile);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Errore eliminazione file per ${department}:`, error);
      throw error;
    }
  }
};

app.use(express.json({ limit: '10mb' }));
app.use(express.static(PUBLIC_DIR));
app.use('/src', express.static(path.join(__dirname, '..', 'src')));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'JSON non valido' });
  }
  next();
});

const upload = multer({
  dest: path.join(__dirname, '..', 'uploads'),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error('Tipo di file non consentito'));
    }
    cb(null, true);
  }
});

app.get('/api/departments', (req, res) => {
  try {
    const missingPasswordDepartments = departmentsData.filter(dep => departmentsNeedingPasswordSetup[dep]);
    res.json({ departments: departmentsData, missingPasswordDepartments });
  } catch (error) {
    console.error('Errore get departments:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

app.post('/api/departments', async (req, res) => {
  try {
    const validation = validateDepartmentName(req.body.name);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const passwordValidation = validatePassword(req.body.password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    const trimmed = validation.name;

    if (departmentsData.includes(trimmed)) {
      return res.status(400).json({ error: 'Reparto già esistente' });
    }

    departmentsData.push(trimmed);
    projectsData[trimmed] = [];
    departmentPasswords[trimmed] = req.body.password;
    departmentsNeedingPasswordSetup[trimmed] = false;

    await saveProjects(trimmed);

    res.json({ ok: true, department: trimmed });
  } catch (error) {
    console.error('Errore creazione reparto:', error);
    res.status(500).json({ error: 'Errore nella creazione del reparto' });
  }
});

app.post('/api/departments/:name/verify', (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const { password } = req.body;

    const validation = validateDepartmentName(name);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    if (!departmentsData.includes(name)) {
      return res.status(404).json({ error: 'Reparto non trovato' });
    }

    const storedPassword = departmentPasswords[name] || '';

    if (storedPassword === '') {
      return res.json({ ok: true, authorized: true });
    }

    if (password === storedPassword) {
      return res.json({ ok: true, authorized: true });
    }

    res.status(401).json({ ok: false, authorized: false, error: 'Password errata' });
  } catch (error) {
    console.error('Errore verifica password:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

app.post('/api/departments/:name/change-password', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const { oldPassword, newPassword } = req.body;

    if (name === 'Home') {
      return res.status(400).json({ error: 'Non puoi cambiare la password del reparto Home' });
    }

    const validation = validateDepartmentName(name);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    if (!departmentsData.includes(name)) {
      return res.status(404).json({ error: 'Reparto non trovato' });
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    const storedPassword = departmentPasswords[name] || '';

    if (storedPassword !== '' && oldPassword !== storedPassword) {
      return res.status(401).json({ error: 'Password attuale errata' });
    }

    departmentPasswords[name] = newPassword;
    departmentsNeedingPasswordSetup[name] = false;
    await saveProjects(name);

    res.json({ ok: true });
  } catch (error) {
    console.error('Errore cambio password:', error);
    res.status(500).json({ error: 'Errore nel cambio password' });
  }
});

app.delete('/api/departments/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const { password } = req.body;

    if (name === 'Home') {
      return res.status(400).json({ error: 'Non puoi eliminare il reparto Home' });
    }

    const validation = validateDepartmentName(name);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const index = departmentsData.indexOf(name);
    if (index === -1) {
      return res.status(404).json({ error: 'Reparto non trovato' });
    }

    const storedPassword = departmentPasswords[name] || '';
    if (storedPassword !== '' && password !== storedPassword) {
      return res.status(401).json({ error: 'Password errata' });
    }

    departmentsData.splice(index, 1);
    delete projectsData[name];
    delete departmentPasswords[name];
    delete locksData[name];
    delete departmentsNeedingPasswordSetup[name];

    await deleteProjectsFile(name);

    res.json({ ok: true });
  } catch (error) {
    console.error('Errore eliminazione reparto:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione del reparto' });
  }
});

app.get('/api/projects/:department', (req, res) => {
  try {
    const dep = decodeURIComponent(req.params.department);
    const projects = projectsData[dep] || [];
    res.json(projects);
  } catch (error) {
    console.error('Errore get projects:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

app.post('/api/projects/:department', async (req, res) => {
  try {
    const dep = decodeURIComponent(req.params.department);
    const projects = req.body;

    const validation = validateProjects(projects);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    projectsData[dep] = projects;

    await saveProjects(dep);

    res.json({ ok: true });
  } catch (error) {
    console.error('Errore salvataggio progetti:', error);
    res.status(500).json({ error: 'Errore nel salvataggio dei progetti' });
  }
});

app.post('/api/lock/:department/acquire', (req, res) => {
  try {
    const dep = decodeURIComponent(req.params.department);
    const { userName } = req.body;

    if (!userName || typeof userName !== 'string' || userName.trim() === '') {
      return res.status(400).json({ error: 'Nome utente mancante' });
    }

    const trimmedUserName = userName.trim();
    if (trimmedUserName.length > 100) {
      return res.status(400).json({ error: 'Nome utente troppo lungo' });
    }

    const currentLock = locksData[dep];

    if (currentLock && currentLock.lockedBy !== trimmedUserName) {
      return res.status(423).json({
        lockedBy: currentLock.lockedBy,
        lockedAt: currentLock.lockedAt
      });
    }

    locksData[dep] = {
      lockedBy: trimmedUserName,
      lockedAt: new Date().toISOString()
    };

    res.json({ ok: true });
  } catch (error) {
    console.error('Errore acquisizione lock:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

app.post('/api/lock/:department/release', (req, res) => {
  try {
    const dep = decodeURIComponent(req.params.department);
    const { userName } = req.body;

    const currentLock = locksData[dep];
    if (currentLock && currentLock.lockedBy === userName?.trim()) {
      delete locksData[dep];
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Errore rilascio lock:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

app.post('/api/upload/:department', upload.single('file'), async (req, res) => {
  const filePath = req.file?.path;

  try {
    const dep = decodeURIComponent(req.params.department);

    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    const fileContent = await fs.readFile(filePath, 'utf-8');
    const projects = JSON.parse(fileContent);

    const validation = validateProjects(projects);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    projectsData[dep] = projects;

    await saveProjects(dep);
    await fs.unlink(filePath);

    res.json({ ok: true });
  } catch (error) {
    if (filePath) {
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        console.error('Errore eliminazione file temporaneo:', unlinkError);
      }
    }

    const errorMessage = error.message || 'Errore nel parsing del JSON';
    console.error('Errore upload:', errorMessage);
    res.status(400).json({ error: errorMessage });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint non trovato' });
});

app.use((err, req, res, next) => {
  console.error('Errore non gestito:', err);
  res.status(500).json({ error: 'Errore interno del server' });
});

const startServer = async () => {
  try {
    await loadAllData();

    app.listen(PORT, () => {
      console.log(`\n🚀 Server Only GANTT avviato su http://localhost:${PORT}`);
      console.log(`📂 Cartella corrente: ${__dirname}`);
      console.log(`💾 Dati persistenti in: ${DATA_DIR}\n`);
    });
  } catch (error) {
    console.error('Errore fatale all\'avvio:', error);
    process.exit(1);
  }
};

process.on('uncaughtException', (error) => {
  console.error('Eccezione non catturata:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promise rejection non gestita:', reason);
  process.exit(1);
});

startServer();
