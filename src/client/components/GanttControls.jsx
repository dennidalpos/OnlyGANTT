// GanttControls component
// Exposed on window.OnlyGantt.components.GanttControls

(function() {
  'use strict';

  const { useState } = React;

  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};

  function GanttControls({
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

    const toggleableFilterKeys = [
      'showDaySeparators',
      'showWeekSeparators',
      'showMonthSeparators',
      'showYearSeparators',
      'showDayLetters',
      'showDayNumbers',
      'showWeekNumbers',
      'showMonthYearLabels',
      'showYearLabels',
      'showWeekends',
      'showHolidays',
      'highlightDelays',
      'showOnlyMilestones'
    ];

    const allFiltersEnabled = toggleableFilterKeys.every(key => filters[key]);

    const handleToggleAllFilters = () => {
      const nextValue = !allFiltersEnabled;
      const nextFilters = toggleableFilterKeys.reduce((acc, key) => {
        acc[key] = nextValue;
        return acc;
      }, {});
      onFiltersChange({ ...filters, ...nextFilters });
    };

    return (
      <div className="card-section">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={onGoToToday} className="btn-secondary">
            Vai a Oggi
          </button>

          <div className="button-group">
            <button
              onClick={() => onViewModeChange('4months')}
              className={viewMode === '4months' ? 'btn-success' : 'btn-secondary'}
            >
              Vista Ridotta
            </button>
            <button
              onClick={() => onViewModeChange('full')}
              className={viewMode === 'full' ? 'btn-success' : 'btn-secondary'}
            >
              Vista Completa
            </button>
          </div>

          <button onClick={onExportPNG} className="btn-secondary">
            Esporta PNG
          </button>

          <button
            onClick={() => setShowOptions(!showOptions)}
            className="btn-secondary"
          >
            {showOptions ? 'Nascondi' : 'Mostra'} Opzioni
          </button>
        </div>

        {showOptions && (
          <div className="gantt-options-panel">
            <div className="gantt-options-title">Filtri</div>
            <div className="gantt-options-sections">
              <div className="gantt-options-toolbar">
                <button
                  onClick={handleToggleAllFilters}
                  className="btn-secondary btn-small"
                >
                  {allFiltersEnabled ? 'Disattiva tutti i filtri' : 'Attiva tutti i filtri'}
                </button>
              </div>

              <div className="gantt-options-section">
                <span className="gantt-options-section-title">Filtri separatori</span>
                <div className="gantt-options-row">
                  <label className="checkbox-label compact">
                    <input
                      type="checkbox"
                      checked={filters.showDaySeparators}
                      onChange={(e) => handleFilterChange('showDaySeparators', e.target.checked)}
                    />
                    Giorni
                  </label>
                  <label className="checkbox-label compact">
                    <input
                      type="checkbox"
                      checked={filters.showWeekSeparators}
                      onChange={(e) => handleFilterChange('showWeekSeparators', e.target.checked)}
                    />
                    Settimane
                  </label>
                  <label className="checkbox-label compact">
                    <input
                      type="checkbox"
                      checked={filters.showMonthSeparators}
                      onChange={(e) => handleFilterChange('showMonthSeparators', e.target.checked)}
                    />
                    Mesi
                  </label>
                  <label className="checkbox-label compact">
                    <input
                      type="checkbox"
                      checked={filters.showYearSeparators}
                      onChange={(e) => handleFilterChange('showYearSeparators', e.target.checked)}
                    />
                    Anni
                  </label>
                </div>
              </div>

              <div className="gantt-options-section">
                <span className="gantt-options-section-title">Filtri dettaglio</span>
                <div className="gantt-options-row">
                  <label className="checkbox-label compact">
                    <input
                      type="checkbox"
                      checked={filters.showDayLetters}
                      onChange={(e) => handleFilterChange('showDayLetters', e.target.checked)}
                    />
                    Lettere giorni
                  </label>
                  <label className="checkbox-label compact">
                    <input
                      type="checkbox"
                      checked={filters.showDayNumbers}
                      onChange={(e) => handleFilterChange('showDayNumbers', e.target.checked)}
                    />
                    Numeri giorni
                  </label>
                  <label className="checkbox-label compact">
                    <input
                      type="checkbox"
                      checked={filters.showWeekNumbers}
                      onChange={(e) => handleFilterChange('showWeekNumbers', e.target.checked)}
                    />
                    N° Sett.
                  </label>
                  <label className="checkbox-label compact">
                    <input
                      type="checkbox"
                      checked={filters.showMonthYearLabels}
                      onChange={(e) => handleFilterChange('showMonthYearLabels', e.target.checked)}
                    />
                    Mesi
                  </label>
                  <label className="checkbox-label compact">
                    <input
                      type="checkbox"
                      checked={filters.showYearLabels}
                      onChange={(e) => handleFilterChange('showYearLabels', e.target.checked)}
                    />
                    Anni
                  </label>
                </div>
              </div>

              <div className="gantt-options-section">
                <span className="gantt-options-section-title">Evidenziazioni</span>
                <div className="gantt-options-row">
                  <label className="checkbox-label compact">
                    <input
                      type="checkbox"
                      checked={filters.showWeekends}
                      onChange={(e) => handleFilterChange('showWeekends', e.target.checked)}
                    />
                    Weekend
                  </label>
                  <label className="checkbox-label compact">
                    <input
                      type="checkbox"
                      checked={filters.showHolidays}
                      onChange={(e) => handleFilterChange('showHolidays', e.target.checked)}
                    />
                    Festivi
                  </label>
                  <label className="checkbox-label compact">
                    <input
                      type="checkbox"
                      checked={filters.highlightDelays}
                      onChange={(e) => handleFilterChange('highlightDelays', e.target.checked)}
                    />
                    Ritardi
                  </label>
                </div>
              </div>

              <div className="gantt-options-section">
                <span className="gantt-options-section-title">Filtri</span>
                <div className="gantt-options-row">
                  <label className="checkbox-label compact">
                    <input
                      type="checkbox"
                      checked={filters.showOnlyMilestones}
                      onChange={(e) => handleFilterChange('showOnlyMilestones', e.target.checked)}
                    />
                    Solo Milestone
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  window.OnlyGantt.components.GanttControls = GanttControls;
})();
