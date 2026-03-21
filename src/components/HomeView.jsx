// Import necessary React hooks and components
import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFavorites } from '../contexts/FavoritesContext';
import DynamicIcon from '@stevederico/skateboard-ui/DynamicIcon';
import { getBackendURL, timestampToString } from '@stevederico/skateboard-ui/Utilities';
import { getState } from '@stevederico/skateboard-ui/Context';

/**
 * HomeView Component
 * Main component for the application's home screen
 * Displays search functionality, favorites, and user profiles
 */
export default function HomeView() {
  const { favorites, getFavorites, removeFavorite, addFavorite, searchLocations, isInFavorites } = useFavorites();

  // Local state management
  const [searchQuery, setSearchQuery] = useState(''); // Current search input
  const [searchResults, setSearchResults] = useState([]); // Search result locations
  const [isSearching, setIsSearching] = useState(false); // Loading state for search
  const [profiles, setProfiles] = useState([]); // List of all user profiles
  const { state } = getState();

  // Navigation and routing
  const navigate = useNavigate();

  /**
   * Debounced search function to query OpenStreetMap
   * Prevents excessive API calls during typing
   * @param {string} query - The search query string
   */
  const debouncedSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchLocations(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching locations:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Using imported isInFavorites instead of local implementation
  const checkFavorite = useCallback((result) => {
    return isInFavorites(result, favorites);
  }, [favorites]);

  // Load favorites on component mount
  useEffect(() => {
    if (state.user != null){
      getFavorites();
    }
  }, [state.user]);

  // Implement search debouncing with 300ms delay
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      debouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, debouncedSearch]);

  // Fetch user profiles
  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        // API call to get profiles with authentication
        const response = await fetch(`${getBackendURL()}/profiles`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        const data = await response.json();
        // Handle both array response and object with profiles property
        setProfiles(Array.isArray(data) ? data : (data.profiles || []));
      } catch (error) {
        console.error('Error fetching profiles:', error);
        setProfiles([]); // Ensure profiles remains an array on error
      }
    };
    fetchProfiles();
  }, []);



  /**
   * Handle search input changes
   * @param {Event} e - Input change event
   */
  const handleSearchInput = (e) => {
    setSearchQuery(e.target.value);
  };

  return (
    <div className="px-4 py-6 bg-background min-h-screen">
      {/* Search Bar */}
      <div data-section-id="search-bar" className="relative mb-8">
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchInput}
          placeholder="Search places..."
          data-umami-event="search-input-focused"
          className="w-full pl-4 pr-12 py-3 rounded-xl bg-accent shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
        />
        <DynamicIcon name="search" className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
      </div>

      {searchQuery ? (
        // Search Results Section - Shown when user is searching
        <div data-section-id="search-results" className="mb-8">
          <h2 className="text-xl font-bold mb-4">Search Results</h2>
          <div className="space-y-4">
            {isSearching ? (
              // Loading indicator while searching
              <div className="text-center py-4">Searching...</div>
            ) : searchResults.map((result, index) => (
              // Search result card with action buttons
              <div key={index} className="bg-accent rounded-xl shadow-md p-4">
                <h3 className="font-semibold text-lg mb-2">{result.title}</h3>
                <p className="text-sm mb-4 opacity-70">{result.address}</p>
                <div className="flex gap-3 items-center">
                  {/* View on Map button */}
                  <Link
                    to={`/app/map?lat=${result.coordinates.lat}&lon=${result.coordinates.lon}&title=${encodeURIComponent(result.title)}&address=${encodeURIComponent(result.address)}`}
                    data-umami-event="view-on-map-clicked"
                    className="flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500 hover:bg-blue-600 transition-colors text-blue-500 cursor-pointer"
                  >
                    <DynamicIcon name="map-pin" size={16} />
                    <span>View on Map</span>
                  </Link>

                  {/* Conditional favorite/unfavorite button */}
                  {checkFavorite(result) ? (
                    <button
                      onClick={() => {
                        const existingFav = favorites.find(fav => isInFavorites(result, [fav]));
                        if (existingFav) removeFavorite(existingFav._id);
                      }}
                      data-umami-event="remove-favorite-clicked"
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500 hover:bg-red-600 transition-colors cursor-pointer"
                    >
                      <DynamicIcon name="heart" size={16} />
                      <span>Remove from Favorites</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => addFavorite(result)}
                      data-umami-event="add-favorite-clicked"
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500 hover:bg-blue-600 transition-colors cursor-pointer"
                    >
                      <DynamicIcon name="heart" size={16} />
                      <span>Add to Favorites</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // Dashboard view shown when not searching
        <>
          {/* Quick Actions Section - Map and Profile buttons */}
          <div data-section-id="quick-actions" className="grid grid-cols-2 gap-4 mb-8">
            <button className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-purple-500 hover:bg-purple-600 transition-colors cursor-pointer"
              data-umami-event="show-map-clicked"
              onClick={() => {
                navigate(`/app/map`);
              }}
            >
              <DynamicIcon name="map-pin" className="font-medium text-white" size={24} />
              <span className="font-medium text-white">Show Map</span>
            </button>
            <button
              onClick={() => {
                navigate(`/app/${state.user?.name?.toLowerCase()}`);
              }}
              data-umami-event="my-favorites-clicked"
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-blue-500 hover:bg-blue-600 transition-colors cursor-pointer"
            >
              <DynamicIcon name="user" className="font-medium text-white" size={24} />
              <span className="font-medium text-white">My Favorites</span>
            </button>
          </div>

          {/* Recent Activity Section - Shows latest favorites */}
          <div data-section-id="recently-added" className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <DynamicIcon name="clock" size={24} className="text-orange-500" />
              <h2 className="text-xl font-bold">Recently Added</h2>
            </div>
            <div className="bg-accent rounded-xl p-4 space-y-4">
              {favorites.slice(0, 3).map(favorite => (
                <div
                  key={`recent-${favorite._id}`}
                  onClick={() => navigate(`/app/map?lat=${favorite.coordinates?.lat}&lon=${favorite.coordinates?.lon}`)}
                  data-umami-event="recent-favorite-clicked"
                  className="flex items-center justify-between p-3 bg-background rounded-lg hover:bg-blue-500/10 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <DynamicIcon name="heart" size={20} className="text-red-500" />
                    <span>{favorite.title}</span>
                  </div>
                  <span className="text-sm opacity-70">{timestampToString(favorite.created_at, 'ago')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Profiles Grid Section - Shows available user profiles */}
          <div data-section-id="profiles-grid" className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <DynamicIcon name="circle-user" size={24} className="text-blue-500" />
              <h2 className="text-xl font-bold">Profiles</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {profiles.map(profile => (
                <Link
                  key={profile._id}
                  to={`/app/map/${profile.name.toLowerCase()}`}
                  data-umami-event="profile-clicked"
                  className="bg-accent rounded-xl shadow-md p-6 hover:shadow-lg transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <DynamicIcon name="circle-user" size={40} className="text-blue-500" />
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
    </div>
  );
}
