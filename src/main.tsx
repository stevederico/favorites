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
import type { ReactNode } from 'react';
import { createSkateboardApp } from '@stevederico/skateboard-ui/App';
import type { AppRoute } from '@stevederico/skateboard-ui/App';
import Layout from '@stevederico/skateboard-ui/Layout';
import { FavoritesProvider } from './contexts/FavoritesContext';
import AnalyticsProvider from './components/AnalyticsProvider';
import CommandMenu from './components/CommandMenu';
import constants from './constants.json';
import HomeView from './components/HomeView';
import MapView from './components/MapView';
import ProfileView from './components/ProfileView';

/**
 * Application route configuration
 *
 * Maps route paths to view components. Routes are relative to root (no leading slash).
 * The shell handles route registration, navigation, and layout.
 */
const appRoutes: AppRoute[] = [
  { path: ':username', element: <ProfileView /> },
  { path: 'home', element: <HomeView /> },
  { path: 'map', element: <MapView /> },
  { path: 'map/:username', element: <MapView /> }
];

/**
 * App layout with global command menu overlay.
 *
 * Wraps the default skateboard-ui Layout and injects CommandMenu
 * so the Cmd+K shortcut is available on all authenticated routes.
 *
 * @returns Layout with command menu
 */
function AppLayout() {
  return (
    <>
      <CommandMenu />
      <Layout />
    </>
  );
}

/** Props for the AppWrapper provider composition. */
interface AppWrapperProps {
  /** Child components (Router + App) */
  children?: ReactNode;
}

/**
 * Custom wrapper composing AnalyticsProvider and FavoritesProvider
 * AnalyticsProvider handles page views, user identification, and passive tracking.
 * FavoritesProvider provides favorites context to all routes.
 *
 * @param props - Wrapper props
 * @param props.children - Child components (Router + App)
 */
const AppWrapper = ({ children }: AppWrapperProps) => (
  <AnalyticsProvider>
    <FavoritesProvider>{children}</FavoritesProvider>
  </AnalyticsProvider>
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
  wrapper: AppWrapper,
  overrides: { layout: AppLayout }
});
