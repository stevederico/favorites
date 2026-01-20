/**
 * Application entry point using Skateboard Application Shell Architecture
 *
 * Configures routing and initializes app with skateboard-ui framework.
 * The shell (skateboard-ui) provides:
 * - Routing system with React Router v7
 * - Context/state management
 * - Authentication flow
 * - Common UI components (Header, Footer, UpgradeSheet)
 * - Utility functions (apiRequest, usage tracking)
 *
 * This file only defines:
 * - Custom view components
 * - Route configuration
 * - App constants
 *
 * @see {@link https://github.com/stevederico/skateboard|Skateboard Docs}
 */
import './assets/styles.css';
import { createSkateboardApp } from '@stevederico/skateboard-ui/App';
import { initializeUtilities } from '@stevederico/skateboard-ui/Utilities';
import { FavoritesProvider } from './contexts/FavoritesContext';
import constants from './constants.json';
import HomeView from './components/HomeView.jsx';
import MapView from './components/MapView.jsx';
import ProfileView from './components/ProfileView.jsx';

// Initialize utilities before creating app
initializeUtilities(constants);

/**
 * Application route configuration
 *
 * Maps route paths to view components. Routes are relative to root (no leading slash).
 * The shell handles route registration, navigation, and layout.
 *
 * @type {Array<{path: string, element: JSX.Element}>}
 */
const appRoutes = [
  { path: ':username', element: <ProfileView /> },
  { path: 'home', element: <HomeView /> },
  { path: 'map', element: <MapView /> },
  { path: 'map/:username', element: <MapView /> }
];

/**
 * Custom wrapper to include FavoritesProvider
 * Wraps all routes with favorites context
 */
const AppWrapper = ({ children }) => (
  <FavoritesProvider>
    {children}
  </FavoritesProvider>
);

/**
 * Initialize and mount Skateboard app
 *
 * Creates React root, configures router, initializes context/state,
 * and renders app shell. Automatically handles:
 * - User authentication state
 * - Protected routes
 * - Navigation setup
 * - Footer with app info
 *
 * @param {Object} config - App configuration
 * @param {Object} config.constants - App constants from constants.json
 * @param {Array} config.appRoutes - Route configuration array
 * @param {string} config.defaultRoute - Initial route path
 * @param {Function} config.wrapper - Custom wrapper component
 */
createSkateboardApp({
  constants,
  appRoutes,
  defaultRoute: 'home',
  wrapper: AppWrapper
});
