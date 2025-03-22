import { createContext, useContext, useState } from 'react';
import { getBackendURL, getCookie } from '@stevederico/skateboard-ui/Utilities';
import { getState } from '../context';

export const FavoritesContext = createContext();

export function FavoritesProvider({ children }) {
  const [favorites, setFavorites] = useState([]);
  const { state } = getState();

  async function getFavorites(userID) {
    let id = state.user._id
    if (userID){
      id = userID
    }
    try {
      const response = await fetch(`${getBackendURL()}/favorites?uid=${id}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getCookie('token')}`
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getCookie('token')}`
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
      const response = await fetch(`${getBackendURL()}/favorites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getCookie('token')}`
        },
        body: JSON.stringify(location)
      });
      const newFavorite = await response.json();
      setFavorites([...favorites, newFavorite]);
      return newFavorite;
    } catch (error) {
      console.error('Error adding favorite:', error);
      return null;
    }
  }

  async function removeFavorite(_id) {
    try {
      const response = await fetch(`${getBackendURL()}/favorites`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getCookie('token')}`
        },
        body: JSON.stringify({_id})
      });
      if (response.ok) {
        setFavorites(favorites.filter(f => f._id !== _id));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error removing favorite:', error);
      return false;
    }
  }

  async function updateFavorite(_id, updates) {
    try {
      const response = await fetch(`${getBackendURL()}/favorites`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getCookie('token')}`
        },
        body: JSON.stringify({ _id, ...updates })
      });
      const updatedFavorite = await response.json();
      setFavorites(favorites.map(f => f._id === _id ? updatedFavorite : f));
      return updatedFavorite;
    } catch (error) {
      console.error('Error updating favorite:', error);
      return null;
    }
  }

  async function searchLocations(query) {
    if (!query?.trim()) return [];
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=10&extratags=1`);
    const data = await response.json();
    return data.map(item => ({
        title: item.name,
        address: item.display_name.replace(`${item.name},`, '').trim(),
        coordinates: {
            lat: parseFloat(item.lat),
            long: parseFloat(item.lon)
        },
        placeID: item.place_id,
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