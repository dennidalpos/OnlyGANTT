import AppConfig from '../app-config.js';
import dateUtils from '../utils/dateUtils.js';
import logic from '../domain/projectLogic.js';
import gantt from '../domain/ganttCalculator.js';

import api from './api.js';
import storage from './storage.js';

import useDepartmentLock from './hooks/useDepartmentLock.js';
import useProjects from './hooks/useProjects.js';

import HeaderBar from './components/HeaderBar.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import GanttControls from './components/GanttControls.jsx';
import GanttCanvas from './components/GanttCanvas.jsx';
import ProjectForm from './components/ProjectForm.jsx';
import ProjectList from './components/ProjectList.jsx';
import ProjectSidebar from './components/ProjectSidebar.jsx';
import AlertsPanel from './components/AlertsPanel.jsx';
import UserManagement from './components/UserManagement.jsx';
import SystemSettings from './components/SystemSettings.jsx';
import DialogHost from './components/DialogHost.jsx';

import App from './app.jsx';

if (typeof document !== 'undefined') {
  const mountApp = () => {
    const rootEl = document.getElementById('root');
    if (rootEl && !rootEl.dataset.mounted) {
      rootEl.dataset.mounted = 'true';
      const root = ReactDOM.createRoot(rootEl);
      root.render(<App />);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountApp);
  } else {
    mountApp();
  }
}
