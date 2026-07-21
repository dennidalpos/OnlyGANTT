const { useState, useCallback } = React;

const DEFAULT_FILTERS = {
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

export function useGanttFilters() {
  const [viewMode, setViewMode] = useState('4months');
  const [activeView, setActiveView] = useState('gantt');
  const [selectedProjectIds, setSelectedProjectIds] = useState(new Set());
  const [scrollToTodayTrigger, setScrollToTodayTrigger] = useState(0);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const triggerScrollToToday = useCallback(() => {
    setScrollToTodayTrigger(prev => prev + 1);
  }, []);

  return {
    viewMode,
    setViewMode,
    activeView,
    setActiveView,
    selectedProjectIds,
    setSelectedProjectIds,
    scrollToTodayTrigger,
    triggerScrollToToday,
    filters,
    setFilters,
    updateFilter,
    resetFilters
  };
}

export default useGanttFilters;
