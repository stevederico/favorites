import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useFavorites } from '../contexts/FavoritesContext';

export default function HomeView() {
  const { favorites, getFavorites, removeFavorite } = useFavorites();

  useEffect(() => {
    getFavorites();
  }, []);

  return (
    <div className="p-4 bg-background">
      <h1 className="text-2xl font-bold mb-4">My Favorite Places</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {favorites.map(favorite => (
          <div key={favorite._id} className="bg-accent rounded-lg shadow-md p-4 flex flex-col">
            <h3 className="font-semibold text-lg">{favorite.title}</h3>
            <div className="flex justify-between items-center mt-4">
              <Link 
                to={`/app/map?lat=${favorite.coordinates?.lat}&lng=${favorite.coordinates?.long}`} 
                className="hover:opacity-80 border rounded-full px-3 py-2 bg-app text-white"
              >
                View on Map
              </Link>
              <button
                onClick={() => removeFavorite(favorite._id)}
                className="hover:opacity-80"
              >
                ❌
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
