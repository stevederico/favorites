import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useFavorites } from '../contexts/FavoritesContext';
import { Search, User, MapPin, Clock, Heart, UserCircle } from 'lucide-react';
import ProfileView from './ProfileView';
import { getBackendURL, getCookie } from '@stevederico/skateboard-ui/Utilities';

export default function HomeView({ isProfileView }) {
  const { favorites, getFavorites, removeFavorite, addFavorite } = useFavorites();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isMyFavoritesOpen, setIsMyFavoritesOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const navigate = useNavigate();
  const { username } = useParams();

  const debouncedSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
      const data = await response.json();
      const results = data.map(item => ({
        title: item.name || item.display_name.split(',')[0].trim(),
        address: item.display_name,
        coordinates: { lat: parseFloat(item.lat), long: parseFloat(item.lon) }
      }));
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching locations:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const isInFavorites = useCallback((result) => {
    return favorites.some(fav => 
      fav.coordinates?.lat === result.coordinates.lat && 
      fav.coordinates?.long === result.coordinates.long
    );
  }, [favorites]);

  useEffect(() => {
    getFavorites();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      debouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, debouncedSearch]);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const response = await fetch(`${getBackendURL()}/profiles`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getCookie('token')}`
          }
        })
        const data = await response.json();
        setProfiles(data);
        
        // If we're in profile view mode, find and set the selected profile
        if (isProfileView && username) {
          const profile = data.find(p => p.name.toLowerCase() === username.replace('@', '').toLowerCase());
          if (profile) {
            setSelectedProfile(profile);
            setIsMyFavoritesOpen(true);
          }
        }
      } catch (error) {
        console.error('Error fetching profiles:', error);
      }
    };

    fetchProfiles();
  }, [isProfileView, username]);

  const handleSearchInput = (e) => {
    setSearchQuery(e.target.value);
  };

  return (
    <div className="px-4 py-6 bg-background min-h-screen">
      {/* Search Bar */}
      {!isProfileView && (
        <div className="relative mb-8">

          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchInput}
            placeholder="Search places..."
            className="w-full pl-4 pr-12 py-3 rounded-xl bg-accent shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
          <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        </div>
      )}

      {searchQuery ? (
        // Search Results
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Search Results</h2>
          <div className="space-y-4">
            {isSearching ? (
              <div className="text-center py-4">Searching...</div>
            ) : searchResults.map((result, index) => (
              <div key={index} className="bg-accent rounded-xl shadow-md p-4">
                <h3 className="font-semibold text-lg mb-2">{result.title}</h3>
                <p className="text-sm mb-4 opacity-70">{result.address}</p>
                <div className="flex gap-3 items-center">
                  <Link 
                    to={`/app/map?lat=${result.coordinates.lat}&lng=${result.coordinates.long}&title=${encodeURIComponent(result.title)}&address=${encodeURIComponent(result.address)}`} 
                    className="flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500 hover:bg-blue-600 transition-colors text-blue-500 cursor-pointer"
                  >
                    <MapPin size={16} />
                    <span>View on Map</span>
                  </Link>
                  {isInFavorites(result) ? (
                    <button
                      onClick={() => {
                        const existingFav = favorites.find(fav => 
                          fav.coordinates?.lat === result.coordinates.lat && 
                          fav.coordinates?.long === result.coordinates.long
                        );
                        if (existingFav) removeFavorite(existingFav._id);
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500 hover:bg-red-600 transition-colors cursor-pointer"
                    >
                      <Heart size={16} />
                      <span>Remove from Favorites</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => addFavorite(result)}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500 hover:bg-blue-600 transition-colors cursor-pointer"
                    >
                      <Heart size={16} />
                      <span>Add to Favorites</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                <button className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-purple-500 hover:bg-purple-600 transition-colors cursor-pointer"
                    onClick={() => navigate(`/app/map`)}

                >
                  <MapPin className="font-medium text-white" size={24} />
                  <span className="font-medium text-white">Show Map</span>
                </button>
                <button 
                  onClick={() => setIsMyFavoritesOpen(true)}
                  className="flex flex-col  items-center justify-center gap-2 p-4 rounded-xl bg-blue-500 hover:bg-blue-600 transition-colors cursor-pointer"
                >
                  <User className="font-medium text-white" size={24} />
                  <span className="font-medium text-white">My Favorites</span>
                </button>
                </div>

                {/* Recent Activity */}
                <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={24} className="text-orange-500" />
                  <h2 className="text-xl font-bold">Recently Added</h2>
                </div>
                <div className="bg-accent rounded-xl p-4 space-y-4">
                  {favorites.slice(0, 3).map(favorite => (
                  <div 
                    key={`recent-${favorite._id}`} 
                    onClick={() => navigate(`/app/map?lat=${favorite.coordinates?.lat}&lng=${favorite.coordinates?.long}`)}
                    className="flex items-center justify-between p-3 bg-background rounded-lg hover:bg-blue-500/10 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                    <Heart size={20} className="text-red-500" />
                    <span>{favorite.title}</span>
                    </div>
                    <span className="text-sm opacity-70">Just now</span>
                  </div>
                  ))}
                </div>
                </div>

                {/* Profiles Grid */}
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-6">
                    <UserCircle size={24} className="text-blue-500" />
                    <h2 className="text-xl font-bold">Profiles</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {profiles.map(profile => (
                      <Link
                        key={profile._id}
                        to={`/app/${profile.name.toLowerCase()}`}
                        className="bg-accent rounded-xl shadow-md p-6 hover:shadow-lg transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <UserCircle size={40} className="text-blue-500" />
                          <div>
                            <h3 className="font-semibold text-lg capitalize">{profile.name}</h3>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
        </>
      )}

      <ProfileView 
        isOpen={isMyFavoritesOpen} 
        onClose={() => {
          setIsMyFavoritesOpen(false);
          setSelectedProfile(null);
          if (isProfileView) {
            navigate('/app/home');
          }
        }} 
        profile={selectedProfile}
      />
    </div>
  );
}
