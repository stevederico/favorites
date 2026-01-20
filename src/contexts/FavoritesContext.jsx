import { createContext, useContext, useState } from 'react';
import { getBackendURL, getCSRFToken } from '@stevederico/skateboard-ui/Utilities';
import { getState } from '@stevederico/skateboard-ui/Context';
import { trackEvent } from '../utils/analytics';

export const FavoritesContext = createContext();

export function FavoritesProvider({ children }) {
  const [favorites, setFavorites] = useState([]);
  const { state } = getState();

  async function getFavorites(userID) {
    let id = state.user._id
    console.log("getFavorites state.user._id", id)
    if (userID){
      id = userID
      console.log("getFavorites id override", id)
    }
    if (typeof id == "undefined"){
      console.log("getFavs id undefined")
      return
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

  async function getFavoritesUserName(username) {
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

  async function addFavorite(location) {
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
      trackEvent('favorite-add-failed', { error: error.message });
      return null;
    }
  }

  async function removeFavorite(_id) {
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
      trackEvent('favorite-remove-failed', { error: error.message });
      return false;
    }
  }

  async function updateFavorite(_id, updates) {
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
      trackEvent('favorite-update-failed', { error: error.message });
      return null;
    }
  }

  async function searchLocations(query) {
    if (!query?.trim()) return [];
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=10&extratags=1`);
    const data = await response.json();
    trackEvent('location-searched', { resultsCount: data.length });
    return data.map(item => ({
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

  function isInFavorites(result, favoritesToCheck = favorites) {
    return favoritesToCheck.some(fav =>
        fav.coordinates?.lat === result.coordinates.lat &&
        fav.coordinates?.lon === result.coordinates.lon
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

export function useFavorites() {
  return useContext(FavoritesContext);
}
