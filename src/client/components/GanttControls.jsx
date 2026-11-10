const { useState, useMemo } = React;

const FILTER_GROUPS = {
  timeline: {
    title: 'Timeline',
    icon: '📅',
    filters: [
      { key: 'showYearLabels', label: 'Anni' },
      { key: 'showMonthYearLabels', label: 'Mesi' },
      { key: 'showWeekNumbers', label: 'N° sett.' },
      { key: 'showDayNumbers', label: 'N° giorni' },
      { key: 'showDayLetters', label: 'Lett. giorni' }
    ]
  },
  separators: {
    title: 'Divisorie',
    icon: '📏',
    filters: [
      { key: 'showYearSeparators', label: 'Anni' },
      { key: 'showMonthSeparators', label: 'Mesi' },
      { key: 'showWeekSeparators', label: 'Settimane' },
      { key: 'showDaySeparators', label: 'Giorni' }
    ]
  },
  content: {
    title: 'Contenuti',
    icon: '📋',
    filters: [
      { key: 'showPhaseLabels', label: 'Nomi fasi' },
      { key: 'showPhasePercentages', label: 'Percentuali' },
      { key: 'showOnlyMilestones', label: 'Solo milestone' }
    ]
  },
  highlights: {
    title: 'Evidenziazioni',
    icon: '🎨',
    filters: [
      { key: 'showWeekends', label: 'Weekend' },
      { key: 'showHolidays', label: 'Festivi' },
      { key: 'highlightDelays', label: 'Ritardi' }
    ]
  }
};

const ALL_FILTER_KEYS = Object.values(FILTER_GROUPS)
  .flatMap(group => group.filters.map(f => f.key));

export function GanttControls({
  viewMode,
  onViewModeChange,
  onGoToToday,
  onExportPNG,
  filters,
  onFiltersChange
}) {
  const [showOptions, setShowOptions] = useState(false);

  const handleFilterChange = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const groupStats = useMemo(() => {
    const stats = {};
    Object.entries(FILTER_GROUPS).forEach(([groupKey, group]) => {
      const activeCount = group.filters.filter(f => filters[f.key]).length;
      stats[groupKey] = {
        active: activeCount,
        total: group.filters.length
      };
    });
    return stats;
  }, [filters]);

  const allFiltersEnabled = ALL_FILTER_KEYS.every(key => filters[key]);
  const activeFilterCount = ALL_FILTER_KEYS.filter(key => filters[key]).length;

  const handleToggleAllFilters = () => {
    const nextValue = !allFiltersEnabled;
    const nextFilters = ALL_FILTER_KEYS.reduce((acc, key) => {
      acc[key] = nextValue;
      return acc;
    }, {});
    onFiltersChange({ ...filters, ...nextFilters });
  };

  const handleToggleGroup = (groupKey) => {
    const group = FILTER_GROUPS[groupKey];
    const allActive = group.filters.every(f => filters[f.key]);
    const nextValue = !allActive;
    const nextFilters = group.filters.reduce((acc, f) => {
      acc[f.key] = nextValue;
      return acc;
    }, {});
    onFiltersChange({ ...filters, ...nextFilters });
  };

  const handleResetToDefaults = () => {
    const defaults = viewMode === 'full' ? {
      showDaySeparators: false,
      showWeekSeparators: false,
      showMonthSeparators: true,
      showYearSeparators: true,
      showDayLetters: false,
      showDayNumbers: false,
      showWeekNumbers: false,
      showMonthYearLabels: false,
      showYearLabels: true,
      showWeekends: false,
      showHolidays: false,
      showOnlyMilestones: false,
      highlightDelays: true,
      showPhaseLabels: false,
      showPhasePercentages: true
    } : {
      showDaySeparators: true,
      showWeekSeparators: true,
      showMonthSeparators: true,
      showYearSeparators: true,
      showDayLetters: true,
      showDayNumbers: true,
      showWeekNumbers: true,
      showMonthYearLabels: true,
      showYearLabels: true,
      showWeekends: false,
      showHolidays: true,
      showOnlyMilestones: false,
      highlightDelays: true,
      showPhaseLabels: true,
      showPhasePercentages: true
    };
    onFiltersChange({ ...filters, ...defaults });
  };

  return (
    <div className="card-section">
      <div className="gantt-toolbar">
        <button type="button" onClick={onGoToToday} className="btn-secondary btn-small">
          Vai a Oggi
        </button>

        <div className="button-group">
          <button
            type="button"
            onClick={() => onViewModeChange('4months')}
            className={`btn-small ${viewMode === '4months' ? 'btn-success' : 'btn-secondary'}`}
            aria-pressed={viewMode === '4months'}
          >
            Ridotta
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('full')}
            className={`btn-small ${viewMode === 'full' ? 'btn-success' : 'btn-secondary'}`}
            aria-pressed={viewMode === 'full'}
          >
            Completa
          </button>
        </div>

        <button type="button" onClick={onExportPNG} className="btn-secondary btn-small">
          PNG
        </button>

        <button
          type="button"
          onClick={() => setShowOptions(!showOptions)}
          className={`btn-small ${showOptions ? 'btn-success' : 'btn-secondary'}`}
          aria-expanded={showOptions}
          aria-controls="gantt-filters-panel"
        >
          {showOptions ? '▲' : '▼'} Filtri
          <span className="filter-count">{activeFilterCount}/{ALL_FILTER_KEYS.length}</span>
        </button>
      </div>

      {showOptions && (
        <div id="gantt-filters-panel" className="filters-panel">
          <div className="filters-actions">
            <button
              type="button"
              onClick={handleToggleAllFilters}
              className="btn-secondary btn-small"
            >
              {allFiltersEnabled ? 'Disattiva tutti' : 'Attiva tutti'}
            </button>
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="btn-secondary btn-small"
            >
              Default {viewMode === 'full' ? 'completa' : 'ridotta'}
            </button>
          </div>

          <div className="filters-grid">
            {Object.entries(FILTER_GROUPS).map(([groupKey, group]) => {
              const stats = groupStats[groupKey];
              const allActive = stats.active === stats.total;

              return (
                <div key={groupKey} className="filter-group">
                  <div className="filter-group-header">
                    <span className="filter-group-icon">{group.icon}</span>
                    <span className="filter-group-title">{group.title}</span>
                    <button
                      type="button"
                      className="filter-group-toggle"
                      onClick={() => handleToggleGroup(groupKey)}
                      title={allActive ? 'Disattiva gruppo' : 'Attiva gruppo'}
                      aria-label={`${allActive ? 'Disattiva' : 'Attiva'} gruppo ${group.title}`}
                    >
                      {stats.active}/{stats.total}
                    </button>
                  </div>
                  <div className="filter-group-items">
                    {group.filters.map(filter => (
                      <label key={filter.key} className="filter-item">
                        <input
                          type="checkbox"
                          checked={!!filters[filter.key]}
                          onChange={(e) => handleFilterChange(filter.key, e.target.checked)}
                        />
                        <span className="filter-item-label">{filter.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

if (typeof window !== 'undefined') {
  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};
  window.OnlyGantt.components.GanttControls = GanttControls;
}

export default GanttControls;
