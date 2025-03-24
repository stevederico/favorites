import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { Search, MapPin, Heart } from 'lucide-react';
import { createRoot } from 'react-dom/client';
import { getState } from '../context';
import { useFavorites } from '../contexts/FavoritesContext';

import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import icon from 'leaflet/dist/images/marker-icon.png';
import shadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetina,
  iconUrl: icon,
  shadowUrl: shadow,
});

const LocationPopup = ({ location, isFavorited, onSaveNotes, onToggleFavorite }) => {
  const [notes, setNotes] = useState(location.notes || '');

  useEffect(() => {
    setNotes(location.notes || '');
  }, [location.notes]);

  const handleSave = async () => {
    if (!isFavorited && notes.trim()) {
      // If location is not favorited but has notes, make it a favorite
      await onToggleFavorite();
    }
    onSaveNotes(notes);
  };

  return (
    <div className="min-w-[250px] max-w-[150px] flex flex-col gap-2">
      <div className="flex flex-col items-center justify-between">
        <button
          className="p-2 hover:bg-accent/10 rounded-full transition-colors"
          onClick={onToggleFavorite}
          aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart
            className={`w-10 h-10 ${isFavorited ? 'fill-current text-red-500' : 'text-accent/70'}`}
          />
        </button>
        <strong className="text-lg font-semibold break-words">{location.title || location.name}</strong>
        <div className="flex justify-end mt-1">
        </div>
      </div>

      <div className="text-sm opacity-70 break-words">{location.address || ''}</div>
      <div className="flex flex-col gap-2 mt-1">
        <textarea
          className="w-full max-h-[35px] px-3 py-2 rounded-lg border border-accent/20 resize-none focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="Add notes to favorite..."
          rows="3"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleSave}
        />
      </div>
    </div>
  );
};

export default function MapView() {
  const { state } = getState();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams] = useSearchParams();
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const { favorites, getFavorites, addFavorite, removeFavorite, updateFavorite, getFavoritesUserName, isInFavorites, searchLocations } = useFavorites();
  const qUsername = searchParams.get('username');
  const { username } = useParams();

  useEffect(() => {
    // If we have a username either from params or query, get their favorites
    if (username || qUsername) {
      getFavoritesUserName(username || qUsername);
      console.log("GETTING FAVS FOR ", username)
    } else {
      // Otherwise get the current user's favorites
      console.log("getFavorites ")
      getFavorites();
    }
  }, [username, qUsername]);



  function createPopupContent(location, isFavorited = false) {
    const container = document.createElement('div');
    const root = createRoot(container);

    const favorite = favorites.find(f => isInFavorites(location, [f]));

    const handleToggleFavorite = async () => {
      if (!isFavorited) {
        const newFavorite = await addFavorite({
          title: location.title || location.name,
          notes: favorite?.notes || '',
          coordinates: location.coordinates,
          address: location.address
        });
        // Update popup content without closing it
        if (mapInstanceRef.current) {
          mapInstanceRef.current.eachLayer((layer) => {
            if (layer instanceof L.Marker && layer._searchMarker) {
              const popup = layer.getPopup();
              const isOpen = popup.isOpen();
              popup.setContent(createPopupContent(location, true));
              if (isOpen) popup.setLatLng(layer.getLatLng()).update();
            }
          });
        }
      } else {
        await removeFavorite(favorite._id);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.eachLayer((layer) => {
            if (layer instanceof L.Marker && layer._searchMarker) {
              const popup = layer.getPopup();
              const isOpen = popup.isOpen();
              popup.setContent(createPopupContent(location, false));
              if (isOpen) popup.setLatLng(layer.getLatLng()).update();
            }
          });
        }
      }
    };

    const handleSaveNotes = async (notes) => {
      if (!favorite && !isFavorited) {
        // Create favorite first if it doesn't exist
        const newFavorite = await addFavorite({
          title: location.title || location.name,
          notes: notes,
          coordinates: location.coordinates,
          address: location.address
        });
        // Update UI to show as favorited
        if (mapInstanceRef.current) {
          mapInstanceRef.current.eachLayer((layer) => {
            if (layer instanceof L.Marker && layer._searchMarker) {
              const popup = layer.getPopup();
              popup.setContent(createPopupContent(location, true));
            }
          });
        }
      } else if (favorite) {
        await updateFavorite(favorite._id, { notes });
      }
    };

    root.render(
      <LocationPopup
        location={location}
        isFavorited={isFavorited}
        onSaveNotes={handleSaveNotes}
        onToggleFavorite={handleToggleFavorite}
      />
    );

    return container;
  }

  const handleSearchInput = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleResultClick = (result) => {
    setSearchQuery('');
    setSearchResults([]);

    const location = {
      title: result.title,
      coordinates: result.coordinates,
      address: result.address
    };

    mapInstanceRef.current.setView([location.coordinates.lat, location.coordinates.lon], 14);
    const existingFavorite = isInFavorites(location, favorites);

    // Clear existing search markers
    mapInstanceRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker && layer._searchMarker) {
        layer.remove();
      }
    });

    const marker = L.marker([location.coordinates.lat, location.coordinates.lon]);
    marker._searchMarker = true;
    marker.bindPopup(createPopupContent(location, !!existingFavorite), {
      minWidth: 250,
      maxWidth: 400,
      className: 'custom-popup'
    })
      .addTo(mapInstanceRef.current)
      .openPopup();
  };

  const debouncedSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchLocations(query);
      setSearchResults(results.slice(0, 3)); // Keep only top 3 results for map view
    } catch (error) {
      console.error('Error searching location:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      debouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, debouncedSearch]);

  function getValidLatLng(coordinates) {
    if (!coordinates) return null;
    const lat = parseFloat(coordinates.lat);
    console.log("CORDS: ", coordinates)
    const lon = parseFloat(coordinates.lon || coordinates.long);
    if (isNaN(lat) || isNaN(lon)) return null;
    return [lat, lon];
  }

  // Initialize map with base layer only
  useEffect(() => {
    if (!mapInstanceRef.current && mapRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: false
      }).setView([37.77493, -122.41942], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapInstanceRef.current);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapRef.current]);

  // Handle map view and markers separately
  useEffect(() => {
    if (!mapInstanceRef.current || !favorites) return;

    // Clear existing markers
    mapInstanceRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        layer.remove();
      }
    });

    // Set view based on URL params or first favorite
    if (searchParams.get('lat') && searchParams.get('lon')) {
      const lat = parseFloat(searchParams.get('lat'));
      const lon = parseFloat(searchParams.get('lon'));
      mapInstanceRef.current.setView([lat, lon], 14);
    } else if (favorites.length > 0 && favorites[0].coordinates) {
      const coords = getValidLatLng(favorites[0].coordinates);
      if (coords) {
        mapInstanceRef.current.setView(coords, 14);
      }
    }

    // Add all favorites as markers
    favorites.forEach(loc => {
      if (!loc?.coordinates) return;
      const coords = getValidLatLng(loc.coordinates);
      if (coords) {
        L.marker(coords)
          .bindPopup(createPopupContent(loc, true), {
            minWidth: 250,
            maxWidth: 400,
            className: 'custom-popup'
          })
          .addTo(mapInstanceRef.current);
      }
    });

    // Handle URL parameter pin last to ensure it's on top
    if (searchParams.get('lat') && searchParams.get('lon')) {
      const coords = {
        lat: parseFloat(searchParams.get('lat')),
        lon: parseFloat(searchParams.get('lon'))
      };
      const title = searchParams.get('title') ? decodeURIComponent(searchParams.get('title')) : 'Location';
      const address = searchParams.get('address') ? decodeURIComponent(searchParams.get('address')) : '';
      const location = { title, coordinates: coords, address };
      const favorite = favorites.find(f => isInFavorites(location, [f]));

      const marker = L.marker([coords.lat, coords.lon])
        .bindPopup(createPopupContent(favorite || location, !!favorite), {
          minWidth: 250,
          maxWidth: 400,
          className: 'custom-popup'
        })
        .addTo(mapInstanceRef.current);
      marker.openPopup();
    }
  }, [favorites, searchParams, username, qUsername]); // Added username dependencies

  return (
    <div className="w-screen h-screen relative flex flex-col">
      <div className="w-full absolute top-4 z-[1000]  px-2 pt-2">
        <div className="relative md:w-[calc(100vw-190px)] max-w-full mx-2">
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchInput}
            placeholder="Search places..."
            className="w-full pl-4 pr-12 py-3 rounded-xl bg-accent shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
          <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />

          {/* Search Results Dropdown */}
          {(searchResults.length > 0 || isSearching) && searchQuery && (
            <div className="absolute w-full mt-2 rounded-lg bg-accent border border-gray-300 shadow-lg overflow-hidden">
              {isSearching ? (
                <div className="p-3 text-center">Searching...</div>
              ) : (
                searchResults.map((result, index) => (
                  <button
                    key={index}
                    onClick={() => handleResultClick(result)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-background transition-colors border-b last:border-b-0 border-gray-300"
                  >
                    <MapPin size={16} className="flex-shrink-0" />
                    <div className="text-left overflow-hidden">
                      <div className="font-medium truncate">{result.title}</div>
                      <div className="text-sm opacity-70 truncate">{result.address}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
