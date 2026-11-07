import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PreviewLoadingProvider } from './components/PreviewLoading';
import { PreviewPreferencesProvider } from './components/PreviewPreferences';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PreviewPreferencesProvider>
      <PreviewLoadingProvider>
        <App />
      </PreviewLoadingProvider>
    </PreviewPreferencesProvider>
  </React.StrictMode>,
);
