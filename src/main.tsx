import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Error boundary wrapper
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const handleError = (error: Error) => {
    console.error('App Error:', error);
  };

  try {
    return <>{children}</>;
  } catch (error) {
    handleError(error instanceof Error ? error : new Error(String(error)));
    return <div style={{ color: 'white', padding: '20px' }}>Error loading app. Check console.</div>;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
