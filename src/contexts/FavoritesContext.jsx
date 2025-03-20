import { createContext, useContext, useState } from 'react';
import { getBackendURL, getCookie } from '@stevederico/skateboard-ui/Utilities';

export const FavoritesContext = createContext();

export function FavoritesProvider({ children }) {
  const [favorites, setFavorites] = useState([]);

  async function getFavorites() {
    try {
      const response = await fetch(`${getBackendURL()}/favorites`, {
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

  return (
    <FavoritesContext.Provider value={{ favorites, getFavorites, addFavorite, removeFavorite, updateFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}