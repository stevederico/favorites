import './assets/styles.css';
import { createSkateboardApp } from '@stevederico/skateboard-ui/App';
import { FavoritesProvider } from './contexts/FavoritesContext';
import constants from './constants.json';
import HomeView from './components/HomeView.jsx';
import MapView from './components/MapView.jsx';
import ProfileView from './components/ProfileView.jsx';

const appRoutes = [
  { path: ':username', element: <ProfileView /> },
  { path: 'home', element: <HomeView /> },
  { path: 'map', element: <MapView /> },
  { path: 'map/:username', element: <MapView /> }
];

// Custom wrapper to include FavoritesProvider
const AppWrapper = ({ children }) => (
  <FavoritesProvider>
    {children}
  </FavoritesProvider>
);

createSkateboardApp({
  constants,
  appRoutes,
  defaultRoute: 'home',
  wrapper: AppWrapper
});
