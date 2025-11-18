// app.jsx - Componente React principale

const { useState, useEffect, useRef, useCallback, useMemo, memo } = React;

// Componente GanttCanvas
const GanttCanvas = memo(({ projects, canvasRef, zoomLevel, theme }) => {
    const hoverDataRef = useRef({ phases: [], config: null });
    const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, text: '' });
    const wrapperRef = useRef(null);

    useEffect(() => {
        const render = () => window.drawGanttOnCanvas(canvasRef.current, projects, zoomLevel, hoverDataRef, theme);
        render();

        let resizeRaf = null;
        const handleResize = () => {
            if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
            resizeRaf = requestAnimationFrame(render);
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
        };
    }, [projects, zoomLevel, canvasRef, theme]);

    const handleMouseMove = useCallback((e) => {
        const canvas = canvasRef.current;
        const wrapper = wrapperRef.current;
        if (!canvas || !wrapper) return;

        const canvasRect = canvas.getBoundingClientRect();
        const wrapperRect = wrapper.getBoundingClientRect();
        const xCanvas = e.clientX - canvasRect.left;
        const yCanvas = e.clientY - canvasRect.top;
        const xWrapper = e.clientX - wrapperRect.left;
        const yWrapper = e.clientY - wrapperRect.top;

        const data = hoverDataRef.current || {};
        const phases = data.phases || [];
        const config = data.config;

        let text = '';

        for (let ph of phases) {
            if (xCanvas >= ph.x1 && xCanvas <= ph.x2 && yCanvas >= ph.y1 && yCanvas <= ph.y2) {
                const percentLabel = typeof ph.percentuale === 'number' ? `${ph.percentuale}%` : '';
                text = {
                    nomeFase: ph.nome || 'Fase',
                    percentuale: percentLabel,
                    progetto: ph.progetto || '',
                    dataInizio: ph.dataInizio || '',
                    dataFine: ph.dataFine || '',
                    stato: ph.stato || ''
                };
                break;
            }
        }

        if (!text && config) {
            const { marginLeft, plotWidth, topMargin, bottomMargin, cssHeight, minDate, maxDate } = config;
            if (
                xCanvas >= marginLeft &&
                xCanvas <= marginLeft + plotWidth &&
                yCanvas >= topMargin &&
                yCanvas <= cssHeight - bottomMargin
            ) {
                const totalDays = Math.max(0, window.diffInDays(minDate, maxDate));
                if (totalDays >= 0) {
                    const ratio = (xCanvas - marginLeft) / plotWidth;
                    let dayIndex = Math.round(ratio * totalDays);
                    dayIndex = Math.max(0, Math.min(totalDays, dayIndex));
                    const date = window.addDays(minDate, dayIndex);
                    const label = date.toLocaleString('it-IT', {
                        weekday: 'long',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                    });
                    text = label;
                }
            }
        }

        if (text) {
            let tooltipX = xWrapper + 10;
            let tooltipY = yWrapper + 10;
            const maxWidth = wrapperRect.width;
            const maxHeight = wrapperRect.height;
            const estimatedWidth = 220;
            const estimatedHeight = 70;
            if (tooltipX + estimatedWidth > maxWidth) tooltipX = maxWidth - estimatedWidth - 8;
            if (tooltipY + estimatedHeight > maxHeight) tooltipY = maxHeight - estimatedHeight - 8;
            setTooltip({ visible: true, x: tooltipX, y: tooltipY, text });
        } else {
            setTooltip(prev => prev.visible ? { ...prev, visible: false } : prev);
        }
    }, [canvasRef]);

    const handleMouseLeave = useCallback(() => {
        setTooltip(prev => prev.visible ? { ...prev, visible: false } : prev);
    }, []);

    return (
        <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
            <canvas
                id="ganttCanvas"
                ref={canvasRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                aria-label="Diagramma di Gantt interattivo dei progetti"
                role="img"
            />
            {tooltip.visible && (
                <div
                    role="tooltip"
                    style={{
                        position: 'absolute',
                        left: tooltip.x,
                        top: tooltip.y,
                        background: 'rgba(15, 23, 42, 0.95)',
                        color: '#f9fafb',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        maxWidth: '260px',
                        boxShadow: '0 8px 20px rgba(15, 23, 42, 0.5)',
                        pointerEvents: 'none',
                        zIndex: 30,
                        lineHeight: 1.5
                    }}
                >
                    {typeof tooltip.text === 'string' ? (
                        <div style={{ whiteSpace: 'pre-line' }}>{tooltip.text}</div>
                    ) : (
                        <>
                            <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '6px' }}>
                                {tooltip.text.nomeFase}
                                {tooltip.text.percentuale && <span style={{ fontSize: '13px', fontWeight: '500', marginLeft: '4px' }}>({tooltip.text.percentuale})</span>}
                            </div>
                            {tooltip.text.progetto && <div><strong>Progetto:</strong> {tooltip.text.progetto}</div>}
                            {(tooltip.text.dataInizio && tooltip.text.dataFine) && (
                                <div>
                                    Dal {window.formatDateDisplay(tooltip.text.dataInizio)} al {window.formatDateDisplay(tooltip.text.dataFine)}
                                </div>
                            )}
                            {tooltip.text.stato && <div><strong>Stato:</strong> {tooltip.text.stato}</div>}
                        </>
                    )}
                </div>
            )}
        </div>
    );
});

// Funzioni API
async function loadDepartments() {
    const res = await fetch('/api/departments', { cache: 'no-store' });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
        return window.filterDepartments(data);
    }
    return [window.CONFIG.DEFAULT_DEPARTMENT];
}

async function loadProjects(department) {
    const res = await fetch(`/api/projects/${encodeURIComponent(department)}`, { cache: 'no-store' });
    const data = await res.json();
    return Array.isArray(data) ? window.ensureProjectIds(data) : [];
}

async function saveProjectsToServer(department, projects) {
    await fetch(`/api/projects/${encodeURIComponent(department)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projects)
    });
}

async function acquireLock(department, userName) {
    const res = await fetch(`/api/lock/${encodeURIComponent(department)}/acquire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName })
    });

    if (res.status === 423) {
        const data = await res.json();
        return {
            success: false,
            lockedBy: data?.lockedBy || 'utente sconosciuto',
            lockedAt: data?.lockedAt || null
        };
    }

    if (res.ok) {
        return { success: true };
    }

    const text = await res.text();
    throw new Error(text || 'Errore lock');
}

async function releaseLock(department, userName) {
    await fetch(`/api/lock/${encodeURIComponent(department)}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName })
    });
}

async function createDepartment(name) {
    const res = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    return await res.json();
}

async function deleteDepartment(department) {
    const res = await fetch(`/api/departments/${encodeURIComponent(department)}`, {
        method: 'DELETE'
    });
    return await res.json();
}

async function uploadProjectsFile(department, file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`/api/upload/${encodeURIComponent(department)}`, {
        method: 'POST',
        body: formData
    });
    return await res.json();
}

// Componente App
function App() {
    const [projects, setProjects] = useState([]);
    const [departments, setDepartments] = useState([window.CONFIG.DEFAULT_DEPARTMENT]);
    const [department, setDepartment] = useState(window.CONFIG.DEFAULT_DEPARTMENT);
    const [editingProjectId, setEditingProjectId] = useState(null);
    const [expandedProjectId, setExpandedProjectId] = useState(null);
    const [screensaverEnabled, setScreensaverEnabled] = useState(true);
    const [isScreensaverVisible, setIsScreensaverVisible] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(window.ZOOM_LEVELS.WEEKS);
    const [selectedProjectIds, setSelectedProjectIds] = useState([]);
    const [theme, setTheme] = useState(() => {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    });
    const [userName, setUserName] = useState('');
    const [lockInfo, setLockInfo] = useState({
        hasLock: false,
        lockedBy: null,
        lockedAt: null,
        loading: false,
        error: null
    });

    const [projectName, setProjectName] = useState('');
    const [projectColor, setProjectColor] = useState(window.COLOR_PALETTE[0]);
    const [projectStart, setProjectStart] = useState('');
    const [projectEnd, setProjectEnd] = useState('');
    const [projectStatus, setProjectStatus] = useState('da_iniziare');
    const [projectPercent, setProjectPercent] = useState('');
    const [phaseTemplate, setPhaseTemplate] = useState('Analisi');
    const [phases, setPhases] = useState([]);
    const [currentTime, setCurrentTime] = useState(() => {
        return new Date().toLocaleTimeString('it-IT', { hour12: false });
    });

    const idleTimeoutRef = useRef(null);
    const currentLockRef = useRef({ department: null, userName: null });
    const canvasRef = useRef(null);
    const paletteIndexRef = useRef(0);

    const todayStr = window.formatToday();
    const todayDisplay = window.formatDateDisplay(todayStr);

    const autoData = useMemo(() => window.applyAutomaticStatusRules(projects), [projects]);
    const autoProjects = autoData.projectsWithAuto;
    const autoAnomalies = autoData.anomalies;

    const zippedProjects = autoProjects.map((ap, index) => ({
        project: projects[index],
        autoProject: ap
    }));

    const filteredProjectsForGantt = zippedProjects
        .filter(({ autoProject }) => selectedProjectIds.includes(autoProject?.id))
        .map(({ autoProject }) => autoProject);

    const lateProjects = zippedProjects.filter(({ autoProject }) =>
        autoProject && window.isItemLate(autoProject)
    );

    const latePhases = [];
    zippedProjects.forEach(({ autoProject: p }) => {
        if (p && Array.isArray(p.fasi)) {
            p.fasi.forEach(f => {
                if (window.isItemLate(f)) {
                    latePhases.push({ phase: f, project: p });
                }
            });
        }
    });

    const dateConflicts = [];
    zippedProjects.forEach(({ autoProject: p }) => {
        if (!p) return;
        const pStart = window.parseDateStr(p.dataInizio);
        const pEnd = window.parseDateStr(p.dataFine);
        if (!pStart || !pEnd || !Array.isArray(p.fasi)) return;

        p.fasi.forEach(f => {
            const fs = window.parseDateStr(f.dataInizio);
            const fe = window.parseDateStr(f.dataFine);
            if (!fs || !fe) return;
            if (fs < pStart || fe > pEnd) {
                dateConflicts.push({
                    project: p,
                    phase: f,
                    startsBefore: fs < pStart,
                    endsAfter: fe > pEnd
                });
            }
        });
    });

    const allSelectedForGantt = projects.length > 0 && selectedProjectIds.length === projects.length;
    const canEdit = userName.trim() !== '' && (department === window.CONFIG.DEFAULT_DEPARTMENT || lockInfo.hasLock);

    function getNextPaletteColor() {
        const idx = paletteIndexRef.current;
        paletteIndexRef.current = idx + 1;
        return window.COLOR_PALETTE[idx % window.COLOR_PALETTE.length];
    }

    const resetIdleTimer = useCallback(() => {
        if (!screensaverEnabled) {
            setIsScreensaverVisible(false);
            if (idleTimeoutRef.current) {
                clearTimeout(idleTimeoutRef.current);
                idleTimeoutRef.current = null;
            }
            return;
        }
        setIsScreensaverVisible(false);
        if (idleTimeoutRef.current) {
            clearTimeout(idleTimeoutRef.current);
        }
        idleTimeoutRef.current = setTimeout(() => {
            setIsScreensaverVisible(true);
            idleTimeoutRef.current = null;
        }, window.CONFIG.IDLE_TIMEOUT);
    }, [screensaverEnabled]);

    const saveProjects = useCallback((data) => {
        setProjects(data);
        if (!department || department === window.CONFIG.DEFAULT_DEPARTMENT || !userName.trim()) return;
        saveProjectsToServer(department, data).catch(() => { });
    }, [department, userName]);

    const resetForm = useCallback(() => {
        setProjectName('');
        setProjectStart('');
        setProjectEnd('');
        setPhases([]);
        setEditingProjectId(null);
        setProjectColor(getNextPaletteColor());
        setProjectStatus('da_iniziare');
        setProjectPercent('');
    }, []);

    useEffect(() => {
        setProjectColor(getNextPaletteColor());
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString('it-IT', { hour12: false }));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        document.body.dataset.theme = theme;
    }, [theme]);

    useEffect(() => {
        loadDepartments()
            .then(merged => {
                setDepartments(merged);
                setDepartment(prev => {
                    if (prev && merged.indexOf(prev) !== -1) return prev;
                    return window.CONFIG.DEFAULT_DEPARTMENT;
                });
            })
            .catch(() => {
                setDepartments([window.CONFIG.DEFAULT_DEPARTMENT]);
                setDepartment(window.CONFIG.DEFAULT_DEPARTMENT);
            });
    }, []);

    useEffect(() => {
        if (!department || department === window.CONFIG.DEFAULT_DEPARTMENT || !userName.trim()) {
            setProjects([]);
            return;
        }
        loadProjects(department)
            .then(data => setProjects(data))
            .catch(() => setProjects([]));
    }, [department, userName]);

    useEffect(() => {
        setSelectedProjectIds(prev => {
            if (!projects || projects.length === 0) return [];
            if (!prev || prev.length === 0) {
                return projects.map(p => p.id);
            }
            const availableIds = new Set(projects.map(p => p.id));
            const next = prev.filter(id => availableIds.has(id));
            if (next.length === 0) {
                return projects.map(p => p.id);
            }
            return next;
        });
    }, [projects]);

    useEffect(() => {
        const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'];
        const handleActivity = () => resetIdleTimer();
        events.forEach(ev => window.addEventListener(ev, handleActivity, { passive: true }));
        resetIdleTimer();
        return () => {
            events.forEach(ev => window.removeEventListener(ev, handleActivity));
            if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
        };
    }, [resetIdleTimer]);

    useEffect(() => {
        if (!screensaverEnabled) {
            setIsScreensaverVisible(false);
            if (idleTimeoutRef.current) {
                clearTimeout(idleTimeoutRef.current);
                idleTimeoutRef.current = null;
            }
        } else {
            resetIdleTimer();
        }
    }, [screensaverEnabled, resetIdleTimer]);

    useEffect(() => {
        const dep = department;
        const user = userName.trim();

        if (!dep || !user || dep === window.CONFIG.DEFAULT_DEPARTMENT) {
            if (currentLockRef.current.department && currentLockRef.current.userName) {
                releaseLock(currentLockRef.current.department, currentLockRef.current.userName).catch(() => { });
                currentLockRef.current = { department: null, userName: null };
            }
            setLockInfo({ hasLock: false, lockedBy: null, lockedAt: null, loading: false, error: null });
            return;
        }

        if (
            currentLockRef.current.department &&
            currentLockRef.current.userName &&
            (currentLockRef.current.department !== dep || currentLockRef.current.userName !== user)
        ) {
            releaseLock(currentLockRef.current.department, currentLockRef.current.userName).catch(() => { });
            currentLockRef.current = { department: null, userName: null };
        }

        let cancelled = false;

        setLockInfo(prev => ({ ...prev, loading: true, error: null }));

        acquireLock(dep, user)
            .then(result => {
                if (cancelled) return;
                if (result.success) {
                    currentLockRef.current = { department: dep, userName: user };
                    setLockInfo({
                        hasLock: true,
                        lockedBy: user,
                        lockedAt: null,
                        loading: false,
                        error: null
                    });
                } else {
                    setLockInfo({
                        hasLock: false,
                        lockedBy: result.lockedBy,
                        lockedAt: result.lockedAt,
                        loading: false,
                        error: null
                    });
                }
            })
            .catch(e => {
                if (cancelled) return;
                setLockInfo({
                    hasLock: false,
                    lockedBy: null,
                    lockedAt: null,
                    loading: false,
                    error: e?.message || 'Errore di rete'
                });
            });

        return () => {
            cancelled = true;
        };
    }, [department, userName]);

    useEffect(() => {
        function handleUnload() {
            if (
                currentLockRef.current.department &&
                currentLockRef.current.userName &&
                navigator?.sendBeacon
            ) {
                const url = `/api/lock/${encodeURIComponent(currentLockRef.current.department)}/release`;
                const data = JSON.stringify({ userName: currentLockRef.current.userName });
                const blob = new Blob([data], { type: 'application/json' });
                navigator.sendBeacon(url, blob);
            }
        }
        window.addEventListener('beforeunload', handleUnload);
        return () => window.removeEventListener('beforeunload', handleUnload);
    }, []);

    const handleProjectStartChange = useCallback((e) => {
        const value = e.target.value;
        setProjectStart(value);
        setProjectEnd(prev => {
            if (!prev || (value && prev < value)) return value || prev;
            return prev;
        });
    }, []);

    const handleProjectEndChange = useCallback((e) => {
        const value = e.target.value;
        setProjectEnd(() => {
            if (projectStart && value && value < projectStart) return projectStart;
            return value;
        });
    }, [projectStart]);

    const addPhaseRow = useCallback(() => {
        if (phases.length >= window.CONFIG.MAX_PHASES_PER_PROJECT) {
            alert(`Puoi aggiungere al massimo ${window.CONFIG.MAX_PHASES_PER_PROJECT} fasi per progetto.`);
            return;
        }

        let startDate = '';
        let endDate = '';

        if (phases.length > 0) {
            startDate = phases[phases.length - 1].dataFine || projectStart || '';
        } else if (projectStart) {
            startDate = projectStart;
        }

        if (phases.length === 0 && projectEnd) {
            endDate = projectEnd;
        } else {
            endDate = startDate || '';
        }

        setPhases(prev => [
            ...prev,
            {
                id: window.createId('phase'),
                nome: phaseTemplate === 'personalizzata' ? '' : phaseTemplate || 'Fase',
                dataInizio: startDate,
                dataFine: endDate,
                note: '',
                stato: 'in_corso',
                percentualeCompletamento: 0,
                milestone: false
            }
        ]);
    }, [phases, phaseTemplate, projectStart, projectEnd]);

    const updatePhaseField = useCallback((index, field, value) => {
        setPhases(prev => {
            const next = prev.slice();
            const phase = { ...next[index] };

            if (field === 'dataInizio') {
                phase.dataInizio = value;
                if (phase.dataFine && value && phase.dataFine < value) {
                    phase.dataFine = value;
                }
            } else if (field === 'dataFine') {
                if (phase.dataInizio && value && value < phase.dataInizio) {
                    phase.dataFine = phase.dataInizio;
                } else {
                    phase.dataFine = value;
                }
            } else if (field === 'stato') {
                phase.stato = value;
                if (value === 'completato') {
                    phase.percentualeCompletamento = 100;
                } else if (value === 'da_iniziare') {
                    phase.percentualeCompletamento = 0;
                }
            } else if (field === 'percentualeCompletamento') {
                const perc = window.normalizePercent(value);
                phase.percentualeCompletamento = perc;
                if (perc === 100 && phase.stato !== 'completato') {
                    phase.stato = 'completato';
                }
            } else {
                phase[field] = value;
            }

            next[index] = phase;
            return next;
        });
    }, []);

    const removePhase = useCallback((index) => {
        setPhases(prev => prev.filter((_, i) => i !== index));
    }, []);

    const validateAndCollectPhases = useCallback(() => {
        const res = [];
        for (let i = 0; i < phases.length; i++) {
            const f = phases[i];
            const nome = (f.nome || '').trim();
            const dataInizio = f.dataInizio || '';
            const dataFine = f.dataFine || '';
            const note = (f.note || '').trim();
            const stato = f.stato || 'in_corso';
            const percent = window.normalizePercent(f.percentualeCompletamento);

            if (!nome && !dataInizio && !dataFine && !note) continue;

            if (!nome || !dataInizio || !dataFine) {
                alert('Per ogni fase devi compilare nome, data di inizio e data di fine, oppure rimuovere la riga incompleta.');
                return null;
            }

            if (dataFine < dataInizio) {
                alert('La data di fine di una fase non può essere precedente alla data di inizio.');
                return null;
            }

            res.push({
                id: f.id || window.createId('phase'),
                nome,
                dataInizio,
                dataFine,
                note,
                stato,
                percentualeCompletamento: percent,
                milestone: !!f.milestone
            });
        }
        return res;
    }, [phases]);

    const handleSubmit = useCallback((e) => {
        e.preventDefault();

        if (department === window.CONFIG.DEFAULT_DEPARTMENT || userName.trim() === '') {
            alert('Inserisci il nome utente e seleziona il reparto prima di salvare un progetto.');
            return;
        }

        const nome = projectName.trim();
        const colore = projectColor || getNextPaletteColor();
        const dataInizio = projectStart;
        const dataFine = projectEnd;

        if (!nome) {
            alert('Inserisci un nome per il progetto.');
            return;
        }

        if (!dataInizio || !dataFine) {
            alert('Devi specificare sia la data di inizio che la data di fine del progetto.');
            return;
        }

        if (dataFine < dataInizio) {
            alert('La data di fine progetto non può essere precedente alla data di inizio.');
            return;
        }

        const fasi = validateAndCollectPhases();
        if (fasi === null) return;

        const finalFasiNormalized = fasi.map(f => {
            const perc = window.normalizePercent(f.percentualeCompletamento);
            const isCompletePhase = f.stato === 'completato' || perc === 100;
            return {
                ...f,
                stato: isCompletePhase ? 'completato' : f.stato,
                percentualeCompletamento: isCompletePhase ? 100 : perc
            };
        });

        const autoPercent = window.calcolaPercentProgettoDaFasi(finalFasiNormalized);
        let percentProgetto;
        let percentualeCalcolataAutomaticamente = false;

        if (projectPercent === '' || projectPercent === null || typeof projectPercent === 'undefined') {
            percentProgetto = autoPercent;
            percentualeCalcolataAutomaticamente = true;
        } else {
            percentProgetto = window.normalizePercent(projectPercent);
        }

        let statoProgetto = projectStatus || 'in_corso';
        const allComplete =
            finalFasiNormalized.length > 0 &&
            finalFasiNormalized.every(f => f.stato === 'completato' || window.normalizePercent(f.percentualeCompletamento) === 100);

        if (allComplete) {
            statoProgetto = 'completato';
            percentProgetto = 100;
        }

        const projectId = editingProjectId || window.createId('project');
        const progetto = {
            id: projectId,
            nome,
            colore,
            dataInizio,
            dataFine,
            stato: statoProgetto,
            percentualeCompletamento: percentProgetto,
            percentualeCalcolataAutomaticamente,
            fasi: finalFasiNormalized
        };

        let newProjects;
        if (!editingProjectId) {
            newProjects = projects.concat(progetto);
        } else {
            newProjects = projects.map(p => (p.id === editingProjectId ? progetto : p));
        }

        saveProjects(newProjects);
        setExpandedProjectId(null);
        resetForm();
    }, [
        department,
        userName,
        projectName,
        projectColor,
        projectStart,
        projectEnd,
        projectStatus,
        projectPercent,
        editingProjectId,
        projects,
        validateAndCollectPhases,
        saveProjects,
        resetForm
    ]);

    const populateFormFromProject = useCallback((projectId) => {
        const p = projects.find(pr => pr.id === projectId);
        if (!p) return;

        setEditingProjectId(projectId);
        setProjectName(p.nome || '');
        setProjectColor(p.colore || projectColor);
        setProjectStart(p.dataInizio || '');
        setProjectEnd(p.dataFine || '');
        setProjectStatus(p.stato || 'in_corso');

        const usaAuto = p.percentualeCalcolataAutomaticamente;
        if (usaAuto) {
            setProjectPercent('');
        } else {
            const percRaw = window.normalizePercent(p.percentualeCompletamento);
            const perc = p.stato === 'completato' || percRaw === 100 ? 100 : window.snapPercentToPreset(percRaw);
            setProjectPercent(perc);
        }

        setPhases(
            Array.isArray(p.fasi)
                ? p.fasi.slice(0, window.CONFIG.MAX_PHASES_PER_PROJECT).map(f => {
                    const fpRaw = window.normalizePercent(f.percentualeCompletamento);
                    const isCompletePhase = f.stato === 'completato' || fpRaw === 100;
                    const fp = isCompletePhase ? 100 : window.snapPercentToPreset(fpRaw);
                    return {
                        id: f.id || window.createId('phase'),
                        nome: f.nome || '',
                        dataInizio: f.dataInizio || '',
                        dataFine: f.dataFine || '',
                        note: f.note || '',
                        stato: isCompletePhase ? 'completato' : f.stato || 'in_corso',
                        percentualeCompletamento: fp,
                        milestone: !!f.milestone
                    };
                })
                : []
        );
    }, [projects, projectColor]);

    const deleteProject = useCallback((projectId) => {
        const p = projects.find(pr => pr.id === projectId);
        if (!p) return;
        if (!confirm(`Sei sicuro di voler eliminare il progetto "${p.nome || ''}"?`)) return;

        const newProjects = projects.filter(pr => pr.id !== projectId);
        saveProjects(newProjects);

        if (editingProjectId === projectId) {
            resetForm();
        }
        if (expandedProjectId === projectId) {
            setExpandedProjectId(null);
        }
        setSelectedProjectIds(prev => prev.filter(id => id !== projectId));
    }, [projects, editingProjectId, expandedProjectId, saveProjects, resetForm]);

    const handleExportJson = useCallback(() => {
        if (projects.length === 0) {
            const conferma = confirm('Non ci sono progetti salvati. Vuoi comunque esportare un file JSON vuoto?');
            if (!conferma) return;
        }

        const json = JSON.stringify(autoProjects, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${department || 'projects'}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [projects, autoProjects, department]);

    const handleImportJson = useCallback((e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!department || department === window.CONFIG.DEFAULT_DEPARTMENT || userName.trim() === '') {
            alert('Inserisci il nome utente e seleziona un reparto prima di importare.');
            e.target.value = '';
            return;
        }

        uploadProjectsFile(department, file)
            .then(data => {
                if (!data || !data.ok) {
                    alert(data?.error || 'Errore import JSON');
                    return;
                }
                return loadProjects(department);
            })
            .then(projectsData => {
                if (projectsData) {
                    setProjects(projectsData);
                    setEditingProjectId(null);
                    setExpandedProjectId(null);
                    setSelectedProjectIds([]);
                }
            })
            .catch(() => {
                alert('Errore durante l\'importazione dei progetti');
            });

        e.target.value = '';
    }, [department, userName]);

    const handleExportPNG = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            alert('Canvas non disponibile');
            return;
        }

        try {
            const dataURL = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataURL;
            link.download = `gantt_${department || 'chart'}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            alert('Errore durante l\'esportazione PNG: ' + e.message);
        }
    }, [department]);

    const toggleExpanded = useCallback((projectId) => {
        setExpandedProjectId(prev => (prev === projectId ? null : projectId));
    }, []);

    const handleAddDepartment = useCallback(() => {
        let name = prompt('Nome nuovo reparto:');
        if (!name) return;
        name = name.trim();
        if (!name) return;

        createDepartment(name)
            .then(data => {
                if (!data || data.error) {
                    alert(data?.error || 'Errore creazione reparto');
                    return;
                }
                return loadDepartments();
            })
            .then(list => {
                if (list) {
                    setDepartments(list);
                    if (list.indexOf(name) !== -1) {
                        setDepartment(name);
                    }
                }
            })
            .catch(() => {
                alert('Errore nella creazione del reparto');
            });

        resetForm();
        setProjects([]);
        setSelectedProjectIds([]);
    }, [resetForm]);

    const handleDeleteDepartment = useCallback(() => {
        if (!department || department === window.CONFIG.DEFAULT_DEPARTMENT) {
            alert('Non puoi eliminare il reparto predefinito.');
            return;
        }

        if (!confirm(`Vuoi eliminare il reparto "${department}" e tutti i suoi progetti?`)) return;

        deleteDepartment(department)
            .then(data => {
                if (!data || !data.ok) {
                    alert(data?.error || 'Errore eliminazione reparto');
                    return;
                }
                return loadDepartments();
            })
            .then(list => {
                if (list) {
                    setDepartments(list);
                    setDepartment(list[0] || window.CONFIG.DEFAULT_DEPARTMENT);
                }
            })
            .catch(() => {
                alert('Errore nell\'eliminazione del reparto');
            });

        resetForm();
        setProjects([]);
        setSelectedProjectIds([]);
    }, [department, resetForm]);

    // Render dell'interfaccia...
    // (Il render è identico all'originale, prosegue dalla riga seguente)

    return (
        <>
            <header>
                {<div className="header-inner">
                    <h1 className="app-title">
                        <span role="img" aria-label="Icona calendario">📊</span>
                        <span>Only GANTT</span>
                    </h1>
                    <div className="header-right">
                        <div className="today-label" role="status" aria-live="polite">
                            <span>Oggi:</span>
                            <span className="date-badge">{todayDisplay}</span>
                            <span>· Ora:</span>
                            <span className="date-badge">{currentTime}</span>
                        </div>

                        <label
                            className="control-label"
                            htmlFor="department-select"
                            title="Seleziona il reparto di lavoro"
                        >
                            <span>Reparto:</span>
                            <select
                                id="department-select"
                                value={department}
                                onChange={e => {
                                    const value = e.target.value;
                                    if (userName.trim() === '') {
                                        alert('Inserisci il nome utente prima di selezionare il reparto.');
                                        return;
                                    }
                                    setDepartment(value);
                                    setEditingProjectId(null);
                                    setExpandedProjectId(null);
                                    setProjects([]);
                                    setSelectedProjectIds([]);
                                    resetForm();
                                }}
                                aria-label="Seleziona reparto"
                            >
                                {departments.map(dep => (
                                    <option key={dep} value={dep}>
                                        {dep}
                                    </option>
                                ))}
                            </select>
                            <div className="department-actions">
                                <button
                                    type="button"
                                    className="department-btn department-btn--add"
                                    onClick={handleAddDepartment}
                                    title="Crea un nuovo reparto"
                                    aria-label="Aggiungi nuovo reparto"
                                >
                                    +
                                </button>
                                <button
                                    type="button"
                                    className="department-btn department-btn--delete"
                                    disabled={department === CONFIG.DEFAULT_DEPARTMENT}
                                    onClick={handleDeleteDepartment}
                                    title="Elimina il reparto corrente e tutti i suoi progetti"
                                    aria-label="Elimina reparto corrente"
                                >
                                    Elimina
                                </button>
                            </div>
                        </label>

                        <div
                            className="user-input-wrapper"
                            title="Inserisci il tuo nome utente per lavorare sui progetti"
                        >
                            <label htmlFor="user-name-input" className="visually-hidden">
                                Nome utente
                            </label>
                            <input
                                id="user-name-input"
                                type="text"
                                placeholder="Inserisci Utente"
                                value={userName}
                                onChange={e => setUserName(e.target.value)}
                                aria-label="Nome utente"
                            />
                        </div>

                        <label
                            className="control-label"
                            htmlFor="theme-toggle"
                            title={theme === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
                        >
                            <input
                                id="theme-toggle"
                                type="checkbox"
                                checked={theme === 'dark'}
                                onChange={e => setTheme(e.target.checked ? 'dark' : 'light')}
                                aria-label={theme === 'dark' ? 'Disattiva tema scuro' : 'Attiva tema scuro'}
                            />
                            <span>{theme === 'dark' ? 'Tema scuro' : 'Tema chiaro'}</span>
                        </label>

                        <label
                            className="control-label"
                            htmlFor="screensaver-toggle"
                            title="Attiva o disattiva lo screensaver dopo 5 secondi di inattività"
                        >
                            <input
                                id="screensaver-toggle"
                                type="checkbox"
                                checked={screensaverEnabled}
                                onChange={e => setScreensaverEnabled(e.target.checked)}
                                aria-label={screensaverEnabled ? 'Disattiva screensaver' : 'Attiva screensaver'}
                            />
                            <span>Screensaver</span>
                        </label>

                        <div className="zoom-toggle-group" role="group" aria-label="Controlli zoom Gantt">
                            <button
                                type="button"
                                className={`btn btn-secondary btn-small ${zoomLevel === ZOOM_LEVELS.DAYS ? 'btn-active' : ''}`}
                                onClick={() => setZoomLevel(ZOOM_LEVELS.DAYS)}
                                title="Visualizza il Gantt per giorni"
                                aria-pressed={zoomLevel === ZOOM_LEVELS.DAYS}
                            >
                                Giorni
                            </button>
                            <button
                                type="button"
                                className={`btn btn-secondary btn-small ${zoomLevel === ZOOM_LEVELS.WEEKS ? 'btn-active' : ''}`}
                                onClick={() => setZoomLevel(ZOOM_LEVELS.WEEKS)}
                                title="Visualizza il Gantt per settimane"
                                aria-pressed={zoomLevel === ZOOM_LEVELS.WEEKS}
                            >
                                Settimane
                            </button>
                            <button
                                type="button"
                                className={`btn btn-secondary btn-small ${zoomLevel === ZOOM_LEVELS.MONTHS ? 'btn-active' : ''}`}
                                onClick={() => setZoomLevel(ZOOM_LEVELS.MONTHS)}
                                title="Visualizza il Gantt per mesi"
                                aria-pressed={zoomLevel === ZOOM_LEVELS.MONTHS}
                            >
                                Mesi
                            </button>
                        </div>
                    </div>
                </div>}
            </header>

            {userName.trim() !== '' && !lockInfo.loading && !lockInfo.hasLock && lockInfo.lockedBy && (
                <div className="lock-warning-banner" role="alert">
                    <div className="lock-warning-content">
                        <div>
                            Il reparto <strong>{department}</strong> è in modifica da <strong>{lockInfo.lockedBy}</strong>.
                            Non apportare modifiche per evitare conflitti.
                        </div>
                        {lockInfo.lockedAt && (
                            <div className="lock-warning-time">
                                Accesso effettuato: {window.formatDateTime(lockInfo.lockedAt)}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <main id="main-content">
                <section className="gantt-section" aria-labelledby="gantt-title">
                    <div className="gantt-card">
                        <div className="gantt-container">
                            <div className="gantt-canvas-wrapper">
                                <GanttCanvas
                                    projects={filteredProjectsForGantt}
                                    canvasRef={canvasRef}
                                    zoomLevel={zoomLevel}
                                    theme={theme}
                                />
                            </div>
                        </div>
                    </div>
                </section>

                <section className="bottom-layout">
                    <div className="bottom-inner">
                        <div className="col-form">
                            <div className="card">
                                <div className="card-header">
                                    <div>
                                        <h2 className="card-title" id="project-form-title">
                                            <span role="img" aria-label="Icona documento">📝</span>
                                            <span>Gestione Progetto</span>
                                        </h2>
                                        <p className="card-subtitle">
                                            Inserisci o modifica un progetto con le sue fasi operative
                                        </p>
                                    </div>
                                </div>

                                <div className="subcard">
                                    <h3 className="subcard-title">Dettagli Progetto</h3>
                                    <form onSubmit={handleSubmit} aria-labelledby="project-form-title">
                                        <fieldset
                                            disabled={!canEdit}
                                            style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
                                        >
                                            <legend className="visually-hidden">Form creazione progetto</legend>

                                            <div className="form-row">
                                                <div className="form-field">
                                                    <label htmlFor="projectName" data-required=" *">
                                                        Nome progetto
                                                    </label>
                                                    <input
                                                        type="text"
                                                        id="projectName"
                                                        placeholder="Es. Sito web aziendale"
                                                        value={projectName}
                                                        onChange={e => setProjectName(e.target.value)}
                                                        required
                                                        aria-required="true"
                                                    />
                                                </div>
                                                <div className="form-field">
                                                    <label htmlFor="projectColor">Colore progetto</label>
                                                    <div className="inline-label">
                                                        <input
                                                            type="color"
                                                            id="projectColor"
                                                            value={projectColor}
                                                            onChange={e => setProjectColor(e.target.value)}
                                                            title="Colore principale del progetto"
                                                            aria-label="Seleziona colore progetto"
                                                        />
                                                        <span>Personalizzabile</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="form-row">
                                                <div className="form-field">
                                                    <label htmlFor="projectStart" data-required=" *">
                                                        Data inizio
                                                    </label>
                                                    <input
                                                        type="date"
                                                        id="projectStart"
                                                        value={projectStart}
                                                        onChange={handleProjectStartChange}
                                                        required
                                                        aria-required="true"
                                                    />
                                                </div>
                                                <div className="form-field">
                                                    <label htmlFor="projectEnd" data-required=" *">
                                                        Data fine
                                                    </label>
                                                    <input
                                                        type="date"
                                                        id="projectEnd"
                                                        value={projectEnd}
                                                        onChange={handleProjectEndChange}
                                                        min={projectStart || undefined}
                                                        required
                                                        aria-required="true"
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-row">
                                                <div className="form-field">
                                                    <label htmlFor="projectStatus">Stato progetto</label>
                                                    <select
                                                        id="projectStatus"
                                                        value={projectStatus}
                                                        onChange={e => setProjectStatus(e.target.value)}
                                                        aria-label="Stato del progetto"
                                                    >
                                                        {STATUS_OPTIONS.map(o => (
                                                            <option key={o.value} value={o.value}>
                                                                {o.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="form-field">
                                                    <label htmlFor="projectPercent">% completamento</label>
                                                    <select
                                                        id="projectPercent"
                                                        value={projectPercent === '' ? '' : String(projectPercent)}
                                                        onChange={e => setProjectPercent(e.target.value === '' ? '' : Number(e.target.value))}
                                                        aria-label="Percentuale di completamento del progetto"
                                                    >
                                                        <option value="">Calcolo automatico</option>
                                                        {PERCENT_PRESETS.map(p => (
                                                            <option key={p} value={String(p)}>
                                                                {p === 100 ? '100%' : `${p}-${p + 25}%`}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="btn-row">
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary"
                                                    onClick={resetForm}
                                                    title="Pulisce il form per inserire un nuovo progetto"
                                                    aria-label="Nuovo progetto"
                                                >
                                                    <span role="img" aria-hidden="true">🆕</span>
                                                    <span>Nuovo progetto</span>
                                                </button>
                                                <button
                                                    type="submit"
                                                    className="btn btn-primary"
                                                    title="Salva o aggiorna il progetto corrente"
                                                    aria-label={editingProjectId ? 'Aggiorna progetto' : 'Salva nuovo progetto'}
                                                >
                                                    <span role="img" aria-hidden="true">💾</span>
                                                    <span>Salva progetto</span>
                                                </button>
                                            </div>
                                        </fieldset>
                                    </form>
                                </div>
                            </div>

                            <div className="card">
                                <div className="subcard">
                                    <h3 className="subcard-title">Fasi del Progetto</h3>
                                    <fieldset
                                        disabled={!canEdit}
                                        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
                                        aria-label="Gestione fasi del progetto"
                                    >
                                        <div className="form-field">
                                            <div className="phases-toolbar">
                                                <label htmlFor="phase-template" className="visually-hidden">
                                                    Template fase
                                                </label>
                                                <select
                                                    id="phase-template"
                                                    value={phaseTemplate}
                                                    onChange={e => setPhaseTemplate(e.target.value)}
                                                    aria-label="Seleziona template fase"
                                                >
                                                    {PHASE_OPTIONS.map(opt => (
                                                        <option key={opt} value={opt}>
                                                            {opt}
                                                        </option>
                                                    ))}
                                                    <option value="personalizzata">Personalizzata</option>
                                                </select>
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary"
                                                    onClick={addPhaseRow}
                                                    title="Aggiungi una nuova fase al progetto"
                                                    aria-label="Aggiungi fase"
                                                >
                                                    <span role="img" aria-hidden="true">➕</span>
                                                    <span>Aggiungi fase</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="phases-container" role="list" aria-label="Elenco fasi del progetto">
                                            {phases.map((phase, index) => {
                                                const isStandard = PHASE_OPTIONS.includes(phase.nome);
                                                const selectValue = isStandard ? phase.nome : 'personalizzata';

                                                return (
                                                    <div className="phase-row" key={phase.id || index} role="listitem">
                                                        <div className="phase-main">
                                                            <div className="phase-name-section">
                                                                <label htmlFor={`phase-name-${index}`} className="phase-name-label">
                                                                    Nome fase
                                                                </label>
                                                                <select
                                                                    id={`phase-name-${index}`}
                                                                    value={selectValue}
                                                                    onChange={e => {
                                                                        const value = e.target.value;
                                                                        if (value === 'personalizzata') {
                                                                            const currentIsStandard = PHASE_OPTIONS.includes(phase.nome);
                                                                            updatePhaseField(index, 'nome', currentIsStandard ? '' : phase.nome);
                                                                        } else {
                                                                            updatePhaseField(index, 'nome', value);
                                                                        }
                                                                    }}
                                                                    aria-label={`Template per fase ${index + 1}`}
                                                                >
                                                                    {PHASE_OPTIONS.map(opt => (
                                                                        <option key={opt} value={opt}>
                                                                            {opt}
                                                                        </option>
                                                                    ))}
                                                                    <option value="personalizzata">Personalizzata</option>
                                                                </select>
                                                                {selectValue === 'personalizzata' && (
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Nome fase personalizzato"
                                                                        value={phase.nome}
                                                                        onChange={e => updatePhaseField(index, 'nome', e.target.value)}
                                                                        aria-label={`Nome personalizzato fase ${index + 1}`}
                                                                    />
                                                                )}
                                                            </div>

                                                            <div className="phase-dates-section">
                                                                <div className="phase-date-field">
                                                                    <label htmlFor={`phase-start-${index}`}>
                                                                        Data inizio
                                                                    </label>
                                                                    <input
                                                                        type="date"
                                                                        id={`phase-start-${index}`}
                                                                        value={phase.dataInizio}
                                                                        onChange={e => updatePhaseField(index, 'dataInizio', e.target.value)}
                                                                        aria-label={`Data inizio fase ${index + 1}`}
                                                                    />
                                                                </div>

                                                                <div className="phase-date-field">
                                                                    <label htmlFor={`phase-end-${index}`}>
                                                                        Data fine
                                                                    </label>
                                                                    <input
                                                                        type="date"
                                                                        id={`phase-end-${index}`}
                                                                        value={phase.dataFine}
                                                                        onChange={e => updatePhaseField(index, 'dataFine', e.target.value)}
                                                                        min={phase.dataInizio || undefined}
                                                                        aria-label={`Data fine fase ${index + 1}`}
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div className="phase-actions-section">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-secondary btn-danger btn-small"
                                                                    onClick={() => removePhase(index)}
                                                                    title="Rimuovi questa fase"
                                                                    aria-label={`Rimuovi fase ${index + 1}`}
                                                                >
                                                                    <span role="img" aria-hidden="true">🗑</span>
                                                                    <span>Rimuovi</span>
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="phase-extra">
                                                            <label className="inline-label" htmlFor={`phase-milestone-${index}`}>
                                                                <input
                                                                    type="checkbox"
                                                                    id={`phase-milestone-${index}`}
                                                                    checked={!!phase.milestone}
                                                                    onChange={e => updatePhaseField(index, 'milestone', e.target.checked)}
                                                                    aria-label={`Milestone fase ${index + 1}`}
                                                                />
                                                                <span>Milestone</span>
                                                            </label>

                                                            <div className="phase-extra-group">
                                                                <label htmlFor={`phase-status-${index}`}>Stato:</label>
                                                                <select
                                                                    id={`phase-status-${index}`}
                                                                    value={phase.stato || 'in_corso'}
                                                                    onChange={e => updatePhaseField(index, 'stato', e.target.value)}
                                                                    aria-label={`Stato fase ${index + 1}`}
                                                                >
                                                                    {STATUS_OPTIONS.map(o => (
                                                                        <option key={o.value} value={o.value}>
                                                                            {o.label}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>

                                                            <div className="phase-extra-group">
                                                                <label htmlFor={`phase-percent-${index}`}>%:</label>
                                                                <select
                                                                    id={`phase-percent-${index}`}
                                                                    disabled={phase.stato === 'da_iniziare'}
                                                                    value={phase.percentualeCompletamento === undefined ? 0 : phase.percentualeCompletamento}
                                                                    onChange={e => updatePhaseField(index, 'percentualeCompletamento', Number(e.target.value))}
                                                                    aria-label={`Percentuale completamento fase ${index + 1}`}
                                                                >
                                                                    {PERCENT_PRESETS.map(p => (
                                                                        <option key={p} value={p}>
                                                                            {p === 100 ? '100%' : `${p}-${p + 25}%`}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>

                                                        <label htmlFor={`phase-note-${index}`} className="visually-hidden">
                                                            Note fase {index + 1}
                                                        </label>
                                                        <textarea
                                                            id={`phase-note-${index}`}
                                                            className="phase-note"
                                                            rows={2}
                                                            placeholder="Commento / note aggiuntive"
                                                            value={phase.note}
                                                            onChange={e => updatePhaseField(index, 'note', e.target.value)}
                                                            aria-label={`Note per fase ${index + 1}`}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </fieldset>
                                </div>
                            </div>
                        </div>

                        <div className="col-list card">
                            <div className="card-header">
                                <div>
                                    <h2 className="card-title" id="projects-list-title">
                                        <span role="img" aria-label="Icona lista">📋</span>
                                        <span>Elenco Progetti</span>
                                    </h2>
                                    <p className="card-subtitle">
                                        Clicca su un progetto per espandere fasi e note. Usa la spunta per includerlo nel diagramma di Gantt.
                                    </p>
                                </div>
                            </div>

                            <div className="tools-box">
                                <h3 className="tools-title">Strumenti</h3>
                                <div className="tools-content">
                                    <label
                                        className="control-label"
                                        htmlFor="toggle-all-gantt"
                                        title="Seleziona o deseleziona tutti i progetti nel Gantt"
                                    >
                                        <input
                                            id="toggle-all-gantt"
                                            type="checkbox"
                                            checked={allSelectedForGantt}
                                            onChange={e => {
                                                const checked = e.target.checked;
                                                setSelectedProjectIds(checked ? projects.map(p => p.id) : []);
                                            }}
                                            aria-label={allSelectedForGantt ? 'Deseleziona tutti i progetti dal Gantt' : 'Seleziona tutti i progetti per il Gantt'}
                                        />
                                        <span>Tutti in Gantt</span>
                                    </label>

                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-small"
                                        onClick={handleExportJson}
                                        title="Esporta tutti i progetti in formato JSON"
                                        aria-label="Esporta progetti in JSON"
                                    >
                                        <span role="img" aria-hidden="true">⬇️</span>
                                        <span>Esporta JSON</span>
                                    </button>

                                    <label
                                        className="btn btn-secondary btn-small"
                                        style={{ cursor: 'pointer', margin: 0 }}
                                        title="Importa progetti da un file JSON"
                                    >
                                        <span role="img" aria-hidden="true">⬆️</span>
                                        <span>Importa JSON</span>
                                        <input
                                            type="file"
                                            accept=".json,application/json"
                                            style={{ display: 'none' }}
                                            onChange={handleImportJson}
                                            aria-label="Seleziona file JSON da importare"
                                        />
                                    </label>

                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-small"
                                        onClick={handleExportPNG}
                                        title="Esporta il diagramma Gantt come immagine PNG"
                                        aria-label="Esporta Gantt come PNG"
                                    >
                                        <span role="img" aria-hidden="true">📷</span>
                                        <span>Esporta PNG</span>
                                    </button>
                                </div>
                            </div>

                            <div className="projects-list" role="list" aria-labelledby="projects-list-title">
                                {projects.length === 0 ? (
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', padding: '1rem', textAlign: 'center' }}>
                                        {department === CONFIG.DEFAULT_DEPARTMENT || userName.trim() === ''
                                            ? 'Inserisci il nome utente e seleziona un reparto per visualizzare o inserire progetti.'
                                            : 'Nessun progetto salvato. Compila il form per crearne uno.'}
                                    </div>
                                ) : (
                                    zippedProjects.map(({ project: p, autoProject: ap }) => {
                                        if (!ap) return null;
                                        const id = ap.id;
                                        const isExpanded = expandedProjectId === id;
                                        const statoLabel = formatStato(ap.stato);
                                        const percLabel = typeof ap.percentualeCompletamento === 'number'
                                            ? `${ap.percentualeCompletamento}%`
                                            : null;
                                        const isSelected = selectedProjectIds.includes(id);
                                        const isLateProj = ap.stato === 'in_ritardo' || isItemLate(ap);

                                        return (
                                            <div className="project-item" key={id} role="listitem">
                                                <div className="project-main-row">
                                                    <div
                                                        className="project-main"
                                                        onClick={() => toggleExpanded(id)}
                                                        role="button"
                                                        tabIndex={0}
                                                        aria-expanded={isExpanded}
                                                        aria-label={`${isExpanded ? 'Chiudi' : 'Espandi'} dettagli progetto ${ap.nome || 'senza nome'}`}
                                                        onKeyPress={e => {
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault();
                                                                toggleExpanded(id);
                                                            }
                                                        }}
                                                    >
                                                        <div
                                                            className="project-color-dot"
                                                            style={{ backgroundColor: ap.colore || '#9ca3af' }}
                                                            aria-label={`Colore progetto: ${ap.colore || '#9ca3af'}`}
                                                        />
                                                        <div className="project-info">
                                                            <div className="project-name">
                                                                <span className="project-toggle-icon" aria-hidden="true">
                                                                    {isExpanded ? '▼' : '▶'}
                                                                </span>
                                                                <span className={isLateProj ? 'late-label' : ''}>
                                                                    {ap.nome || 'Progetto senza nome'}
                                                                </span>
                                                            </div>
                                                            <div className="project-dates">
                                                                {ap.dataInizio && ap.dataFine
                                                                    ? `Dal ${formatDateDisplay(ap.dataInizio)} al ${formatDateDisplay(ap.dataFine)}`
                                                                    : 'Date non specificate'}
                                                            </div>
                                                            {(statoLabel || percLabel) && (
                                                                <div className="project-dates">
                                                                    {statoLabel && (
                                                                        <span className={isLateProj ? 'late-label' : ''}>
                                                                            {statoLabel}
                                                                        </span>
                                                                    )}
                                                                    {statoLabel && percLabel && ' · '}
                                                                    {percLabel && (
                                                                        <span
                                                                            className={`percent-badge ${getPercentClass(ap.percentualeCompletamento)}`}
                                                                        >
                                                                            {percLabel} completato
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="project-actions">
                                                        <label
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '0.375rem',
                                                                fontSize: '0.8125rem',
                                                                color: 'var(--text-muted)',
                                                                cursor: 'pointer',
                                                                fontWeight: 500
                                                            }}
                                                            onClick={e => e.stopPropagation()}
                                                            title="Includi o escludi questo progetto dal diagramma di Gantt"
                                                            htmlFor={`gantt-toggle-${id}`}
                                                        >
                                                            <input
                                                                id={`gantt-toggle-${id}`}
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() =>
                                                                    setSelectedProjectIds(prev => {
                                                                        if (prev.includes(id)) {
                                                                            return prev.filter(x => x !== id);
                                                                        }
                                                                        return prev.concat(id);
                                                                    })
                                                                }
                                                                aria-label={`${isSelected ? 'Rimuovi' : 'Aggiungi'} ${ap.nome || 'progetto'} ${isSelected ? 'dal' : 'al'} Gantt`}
                                                            />
                                                            <span>In Gantt</span>
                                                        </label>

                                                        <button
                                                            type="button"
                                                            className="btn btn-secondary btn-small"
                                                            disabled={!canEdit}
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                populateFormFromProject(id);
                                                            }}
                                                            title="Modifica questo progetto"
                                                            aria-label={`Modifica progetto ${ap.nome || 'senza nome'}`}
                                                        >
                                                            Modifica
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="btn btn-secondary btn-danger btn-small"
                                                            disabled={!canEdit}
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                deleteProject(id);
                                                            }}
                                                            title="Elimina questo progetto"
                                                            aria-label={`Elimina progetto ${ap.nome || 'senza nome'}`}
                                                        >
                                                            Elimina
                                                        </button>
                                                    </div>
                                                </div>

                                                {isExpanded && Array.isArray(ap.fasi) && ap.fasi.length > 0 && (
                                                    <div className="project-phases-expanded" role="region" aria-label={`Fasi del progetto ${ap.nome || 'senza nome'}`}>
                                                        {ap.fasi.map((f, fi) => {
                                                            const faseStatoLabel = formatStato(f.stato);
                                                            const fasePercLabel = typeof f.percentualeCompletamento === 'number'
                                                                ? `${f.percentualeCompletamento}%`
                                                                : null;
                                                            const isLatePhase = f.stato === 'in_ritardo' || isItemLate(f);

                                                            return (
                                                                <div className="project-phase-row" key={f.id || fi}>
                                                                    <div className="project-phase-header">
                                                                        <span className={`project-phase-name ${isLatePhase ? 'late-label' : ''}`}>
                                                                            {f.nome || 'Fase'}
                                                                        </span>
                                                                        <span className="project-phase-dates">
                                                                            {f.dataInizio && f.dataFine
                                                                                ? `Dal ${formatDateDisplay(f.dataInizio)} al ${formatDateDisplay(f.dataFine)}`
                                                                                : 'Date fase non specificate'}
                                                                        </span>
                                                                        {(faseStatoLabel || fasePercLabel) && (
                                                                            <span className="project-phase-dates">
                                                                                {faseStatoLabel && (
                                                                                    <span className={isLatePhase ? 'late-label' : ''}>
                                                                                        {faseStatoLabel}
                                                                                    </span>
                                                                                )}
                                                                                {faseStatoLabel && fasePercLabel && ' · '}
                                                                                {fasePercLabel && (
                                                                                    <span
                                                                                        className={`percent-badge ${getPercentClass(f.percentualeCompletamento)}`}
                                                                                    >
                                                                                        {fasePercLabel} completato
                                                                                    </span>
                                                                                )}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {f.milestone && (
                                                                        <div className="project-phase-dates">
                                                                            <strong>Milestone</strong>
                                                                        </div>
                                                                    )}
                                                                    {f.note && f.note.trim() !== '' && (
                                                                        <div className="project-phase-note">Note: {f.note}</div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <div className="col-issues card">
                            <div className="card-header">
                                <div>
                                    <h2 className="card-title" id="alerts-title">
                                        <span role="img" aria-label="Icona alert">⚠️</span>
                                        <span>Alert</span>
                                    </h2>
                                    <p className="card-subtitle">
                                        Conflitti di pianificazione, ritardi e fasi critiche rispetto a oggi.
                                    </p>
                                </div>
                            </div>

                            <div role="region" aria-labelledby="alerts-title">
                                <section className="issues-section" aria-labelledby="late-projects-title">
                                    <h3 className="issues-section-title" id="late-projects-title">
                                        Progetti in ritardo
                                    </h3>
                                    {lateProjects.length === 0 ? (
                                        <div className="issues-empty">
                                            Nessun progetto risulta in ritardo rispetto ad oggi ({todayDisplay}).
                                        </div>
                                    ) : (
                                        <ul className="issues-list">
                                            {lateProjects.map(({ autoProject: project }, index) => (
                                                <li className="issues-item" key={project.id || index}>
                                                    <strong style={{ color: 'var(--danger)' }}>
                                                        {project.nome || 'Progetto senza nome'}
                                                    </strong>{' '}
                                                    in ritardo, fine pianificata{' '}
                                                    {project.dataFine ? formatDateDisplay(project.dataFine) : 'non definita'}.
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </section>

                                <section className="issues-section" aria-labelledby="late-phases-title">
                                    <h3 className="issues-section-title" id="late-phases-title">
                                        Fasi in ritardo o da completare
                                    </h3>
                                    {latePhases.length === 0 ? (
                                        <div className="issues-empty">
                                            Nessuna fase risulta scaduta e non completata alla data di oggi ({todayDisplay}).
                                        </div>
                                    ) : (
                                        <ul className="issues-list">
                                            {latePhases.map(({ phase, project }, idx) => (
                                                <li className="issues-item" key={(phase.id || project.id || 'p') + idx}>
                                                    <strong style={{ color: 'var(--danger)' }}>
                                                        {phase.nome || 'Fase'}
                                                    </strong>{' '}
                                                    nel progetto{' '}
                                                    <strong style={{ color: 'var(--danger)' }}>
                                                        {project.nome || 'senza nome'}
                                                    </strong>{' '}
                                                    è in ritardo (fine prevista{' '}
                                                    {phase.dataFine ? formatDateDisplay(phase.dataFine) : 'non definita'}).
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </section>

                                <section className="issues-section" aria-labelledby="conflicts-title">
                                    <h3 className="issues-section-title" id="conflicts-title">
                                        Conflitti di date tra fasi e progetto
                                    </h3>
                                    {dateConflicts.length === 0 ? (
                                        <div className="issues-empty">
                                            Nessun conflitto tra date delle fasi e intervallo del progetto.
                                        </div>
                                    ) : (
                                        <ul className="issues-list">
                                            {dateConflicts.map(({ project, phase, startsBefore, endsAfter }, idx) => (
                                                <li className="issues-item" key={(phase.id || project.id || 'c') + idx}>
                                                    Nel progetto{' '}
                                                    <strong style={{ color: 'var(--danger)' }}>
                                                        {project.nome || 'senza nome'}
                                                    </strong>
                                                    , la fase{' '}
                                                    <strong style={{ color: 'var(--danger)' }}>
                                                        {phase.nome || 'Fase'}
                                                    </strong>{' '}
                                                    {startsBefore && endsAfter
                                                        ? 'inizia prima e finisce dopo l\'intervallo del progetto.'
                                                        : startsBefore
                                                            ? 'inizia prima della data di inizio del progetto.'
                                                            : 'finisce dopo la data di fine del progetto.'}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </section>

                                <section className="issues-section" aria-labelledby="anomalies-title">
                                    <h3 className="issues-section-title" id="anomalies-title">
                                        Automatismi e attività anomale
                                    </h3>
                                    {autoAnomalies.length === 0 ? (
                                        <div className="issues-empty">
                                            Nessuna attività automatica o anomalia rilevata per la giornata di oggi ({todayDisplay}).
                                        </div>
                                    ) : (
                                        <ul className="issues-list">
                                            {autoAnomalies.map((a, idx) => {
                                                let message = '';

                                                switch (a.type) {
                                                    case 'progetto_in_ritardo_partenza':
                                                        message = `Il progetto ${a.projectName} risulta in ritardo sulla partenza: la data di inizio è già trascorsa ma lo stato non era "In corso" o "Completato".`;
                                                        break;
                                                    case 'progetto_in_ritardo_fine':
                                                        message = `Il progetto ${a.projectName} è stato impostato automaticamente su "In ritardo" perché alla data di fine non ha raggiunto il 100%.`;
                                                        break;
                                                    case 'progetto_auto_completato':
                                                        message = `Il progetto ${a.projectName} è stato marcato automaticamente come completato perché il progresso ha raggiunto il 100%.`;
                                                        break;
                                                    case 'fase_in_ritardo_partenza':
                                                        message = `La fase ${a.phaseName} nel progetto ${a.projectName} risulta in ritardo sulla partenza: la data di inizio è già trascorsa ma la fase non era "In corso" o "Completata".`;
                                                        break;
                                                    case 'fase_in_ritardo_fine':
                                                        message = `La fase ${a.phaseName} nel progetto ${a.projectName} è stata impostata automaticamente su "In ritardo" perché alla data difine non ha raggiunto il 100%.`;
                                                        break;
                                                    case 'fase_auto_completata':
                                                        message = `La fase ${a.phaseName} nel progetto ${a.projectName} è stata marcata automaticamente come completata perché il progresso ha raggiunto il 100%.`;
                                                        break;
                                                    case 'fase_in_festivo_inizio':
                                                        message = `La fase ${a.phaseName} nel progetto ${a.projectName} ha la data di inizio in un giorno festivo nazionale italiano.`;
                                                        break;
                                                    case 'fase_in_festivo_fine':
                                                        message = `La fase ${a.phaseName} nel progetto ${a.projectName} ha la data di fine in un giorno festivo nazionale italiano.`;
                                                        break;
                                                    default:
                                                        return null;
                                                }

                                                return (
                                                    <li className="issues-item" key={idx}>
                                                        {message}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </section>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {isScreensaverVisible && (
                <div className="screensaver screensaver--visible" role="dialog" aria-modal="true" aria-label="Screensaver attivo">
                    <div className="screensaver-glow" aria-hidden="true" />
                    <div className="screensaver-card">
                        <div className="screensaver-pill">Screensaver attivo · nessuna attività</div>
                        <h2 className="screensaver-title">Only GANTT</h2>
                        <p className="screensaver-subtitle">
                            Muovi il mouse, premi un tasto o usa il touch per tornare alla pianificazione dei progetti.
                        </p>
                        <div className="screensaver-meta">
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span className="screensaver-dot" aria-hidden="true" />
                                Monitoraggio inattività: 15 secondi
                            </span>
                            <span>Dati salvati sul server per reparto</span>
                        </div>
                        <div className="screensaver-orbit" aria-hidden="true" />
                    </div>
                </div>
            )}
        </>
    );
}

// Render dell'app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);