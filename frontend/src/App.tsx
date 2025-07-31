
import { RouterProvider } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import { router } from './router';
import { ErrorBoundary } from './components/ErrorBoundary';
import { performanceMonitor } from './utils/performanceMonitor';
import { debugMode } from './utils/debugMode';
import './App.css';

// Initialize performance monitoring
performanceMonitor.mark('app-start');

// Initialize debug mode
debugMode; // This will initialize the singleton

function App() {
  return (
    <ErrorBoundary level="critical">
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    </ErrorBoundary>
  );
}

export default App;
