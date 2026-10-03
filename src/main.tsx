import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ToastProvider } from './context/ToastContext';
import { SettingsProvider } from './context/SettingsContext';
import { ProjectProvider } from './context/ProjectContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <SettingsProvider>
        <ProjectProvider>
          <App />
        </ProjectProvider>
      </SettingsProvider>
    </ToastProvider>
  </React.StrictMode>
);
