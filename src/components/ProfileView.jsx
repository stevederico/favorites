import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import { getBackendURL, getCookie } from '@stevederico/skateboard-ui/Utilities';
import { getState } from '../context';
import Header from '@stevederico/skateboard-ui/Header';

export default function ProfileView() {
  const [favorites, setFavorites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { username } = useParams();
  const { state } = getState();

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!username) return;
      setIsLoading(true);
      try {
        const cleanUsername = username.replace('@', '');
        const response = await fetch(`${getBackendURL()}/favorites?username=${cleanUsername}`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getCookie('token')}`
          }
        });
        if (!response.ok) throw new Error('Failed to fetch favorites');
        const data = await response.json();
        setFavorites(data);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFavorites();
  }, [username]);

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header className="capitalize" title={`${username}'s Favorites`} />
      
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[50vh]">
              <div className="animate-pulse">Loading...</div>
            </div>
          ) : favorites.length === 0 ? (
            <div className="flex items-center justify-center min-h-[50vh]">
              <p className="opacity-70">No favorites found</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {favorites.map(favorite => (
                <div key={favorite._id} className="bg-accent rounded-xl shadow-md p-4 transition-all hover:scale-[1.02]">
                  <h3 className="font-semibold text-lg mb-2">{favorite.title}</h3>
                  <p className="text-sm mb-4 opacity-70">{favorite.address}</p>
                  <Link
                    to={`/app/map?lat=${favorite.coordinates?.lat}&lng=${favorite.coordinates?.long}&title=${encodeURIComponent(favorite.title)}&address=${encodeURIComponent(favorite.address || '')}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent hover:bg-accent/80 border border-accent transition-colors"
                  >
                    <MapPin size={16} />
                    <span>View on Map</span>
                  </Link>
                </div>
              ))}
            </div>
          )}
          <div className="h-24" />
        </div>
      </main>
    </div>
  );
}