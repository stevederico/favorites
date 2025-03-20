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
            <h3 className="font-semibold text-lg">{favorite.name || favorite.venue}</h3>
            {favorite.address && <p className="mt-1">{favorite.address}</p>}
            {favorite.deal_details && <p className="mt-2">{favorite.deal_details}</p>}
            {favorite.price && <p>Price: {favorite.price}</p>}
            <div className="flex justify-between items-center mt-4">
              <Link 
                to={`/map?lat=${favorite.gps?.split(',')[0]}&lng=${favorite.gps?.split(',')[1]}`} 
                className="hover:opacity-80"
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
