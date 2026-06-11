import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { getBackendURL, getCSRFToken } from '@stevederico/skateboard-ui/Utilities';
import { getState } from '@stevederico/skateboard-ui/Context';
import type { User } from '@stevederico/skateboard-ui';
import { trackEvent } from '../utils/analytics';

/** Geographic coordinates for a place. */
export interface Coordinates {
  lat: number;
  lon: number;
}

/** A saved or searched location/favorite. */
export interface Favorite {
  _id?: string;
  title: string;
  address?: string;
  notes?: string;
  coordinates?: Coordinates;
  placeID?: string | number;
  details?: Record<string, unknown>;
  created_at?: number;
  [key: string]: unknown;
}

/** A search result from the location search provider. */
export interface SearchResult {
  title: string;
  address: string;
  coordinates: Coordinates;
  placeID: string | number;
  details: Record<string, unknown>;
  [key: string]: unknown;
}

/** Value provided by FavoritesContext. */
export interface FavoritesContextValue {
  favorites: Favorite[];
  getFavorites: (userID?: string) => Promise<Favorite[]>;
  addFavorite: (location: Favorite) => Promise<Favorite | null>;
  removeFavorite: (id: string) => Promise<boolean>;
  updateFavorite: (id: string, updates: Partial<Favorite>) => Promise<Favorite | null>;
  clearFavorites: () => void;
  getFavoritesUserName: (username: string) => Promise<Favorite[]>;
  searchLocations: (query: string) => Promise<SearchResult[]>;
  isInFavorites: (result: { coordinates?: Coordinates }, favoritesToCheck?: Favorite[]) => boolean;
}

export const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

/**
 * Resolve Mongo/user id from skateboard context (sign-in uses `id`, /me uses `_id`).
 *
 * @param user - Authenticated user from Context
 * @returns User id string or null when not signed in
 */
export function resolveFavoriteUserId(user: User | null | undefined): string | null {
  if (!user) return null;
  const id = user.id ?? user._id;
  if (id == null || id === '') return null;
  return String(id);
}

/** Props for the FavoritesProvider. */
interface FavoritesProviderProps {
  children?: ReactNode;
}

export function FavoritesProvider({ children }: FavoritesProviderProps) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const { state } = getState();

  async function getFavorites(userID?: string): Promise<Favorite[]> {
    const id = userID != null && userID !== ''
      ? String(userID)
      : resolveFavoriteUserId(state.user);
    if (!id) {
      return [];
    }

    try {
      const response = await fetch(`${getBackendURL()}/favorites?uid=${id}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      setFavorites(data);
      return data;
    } catch (error) {
      console.error('Error fetching favorites:', error);
      return [];
    }
  }

  async function getFavoritesUserName(username: string): Promise<Favorite[]> {
    try {
      const response = await fetch(`${getBackendURL()}/favorites?username=${username}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      setFavorites(data);
      return data;
    } catch (error) {
      console.error('Error fetching favorites:', error);
      return [];
    }
  }

  const clearFavorites = () => {
    setFavorites([]);
  };

  async function addFavorite(location: Favorite): Promise<Favorite | null> {
    try {
      const csrfToken = getCSRFToken();
      const response = await fetch(`${getBackendURL()}/favorites`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken })
        },
        body: JSON.stringify(location)
      });
      const newFavorite = await response.json();
      setFavorites([...favorites, newFavorite]);
      trackEvent('favorite-added', { title: location.title });
      return newFavorite;
    } catch (error) {
      console.error('Error adding favorite:', error);
      trackEvent('favorite-add-failed', { error: (error as Error).message });
      return null;
    }
  }

  async function removeFavorite(_id: string): Promise<boolean> {
    try {
      const csrfToken = getCSRFToken();
      const response = await fetch(`${getBackendURL()}/favorites`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken })
        },
        body: JSON.stringify({_id})
      });
      if (response.ok) {
        setFavorites(favorites.filter(f => f._id !== _id));
        trackEvent('favorite-removed');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error removing favorite:', error);
      trackEvent('favorite-remove-failed', { error: (error as Error).message });
      return false;
    }
  }

  async function updateFavorite(_id: string, updates: Partial<Favorite>): Promise<Favorite | null> {
    try {
      const csrfToken = getCSRFToken();
      const response = await fetch(`${getBackendURL()}/favorites`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken })
        },
        body: JSON.stringify({ _id, ...updates })
      });
      const updatedFavorite = await response.json();
      setFavorites(favorites.map(f => f._id === _id ? updatedFavorite : f));
      trackEvent('favorite-updated', { hasNotes: !!updates.notes });
      return updatedFavorite;
    } catch (error) {
      console.error('Error updating favorite:', error);
      trackEvent('favorite-update-failed', { error: (error as Error).message });
      return null;
    }
  }

  async function searchLocations(query: string): Promise<SearchResult[]> {
    if (!query?.trim()) return [];
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=10&extratags=1`);
    const data = await response.json();
    trackEvent('location-searched', { resultsCount: data.length });
    return data.map((item: any) => ({
        title: item.name,
        address: item.display_name.replace(`${item.name},`, '').trim(),
        coordinates: {
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon)
        },
        placeID: item.place_id,
        details: item
    }));
  }

  function isInFavorites(result: { coordinates?: Coordinates }, favoritesToCheck: Favorite[] = favorites): boolean {
    return favoritesToCheck.some(fav =>
        fav.coordinates?.lat === result.coordinates?.lat &&
        fav.coordinates?.lon === result.coordinates?.lon
    );
  }

  return (
    <FavoritesContext.Provider value={{
      favorites,
      getFavorites,
      addFavorite,
      removeFavorite,
      updateFavorite,
      clearFavorites,
      getFavoritesUserName,
      searchLocations,
      isInFavorites
    }}>
      {children}
    </FavoritesContext.Provider>
  );
}

/**
 * Access the favorites context.
 *
 * @returns Favorites context value
 * @throws If called outside a FavoritesProvider
 */
export function useFavorites(): FavoritesContextValue {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
}
