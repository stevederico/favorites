import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFavorites } from '../contexts/FavoritesContext';
import { Search, MapPin, Heart } from 'lucide-react';

import { createRoot } from 'react-dom/client';
import { getState } from '../context';
import { getBackendURL, getCookie } from '@stevederico/skateboard-ui/Utilities';
import { useParams, Link } from 'react-router-dom';

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

  const handleSave = () => {
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
        <strong className="text-lg font-semibold break-words">{location.title || location.name}</strong>    <div className="flex justify-end mt-1">
        </div>
      </div>

      <div className="text-sm opacity-70 break-words">{location.address || ''}</div>
      <div className="flex flex-col gap-2 mt-1">
        <textarea
          className="w-full max-h-[35px] px-3 py-2 rounded-lg border border-accent/20 resize-none focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="Add notes..."
          rows="3"
          disabled={!isFavorited}
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
  const { favorites, getFavorites, addFavorite, removeFavorite, updateFavorite, getFavoritesUserName } = useFavorites();
  const username = searchParams.get('username');

  useEffect(() => {
    getFavoritesUserName(username)
  }, [username]);

  function createPopupContent(location, isFavorited = false) {
    const container = document.createElement('div');
    const root = createRoot(container);

    const favorite = favorites.find(f => {
      if (!f?.coordinates || !location.coordinates) return false;
      const fLat = parseFloat(f.coordinates.lat);
      const fLong = parseFloat(f.coordinates.long);
      const locLat = parseFloat(location.coordinates.lat);
      const locLong = parseFloat(location.coordinates.long);
      return Math.abs(fLat - locLat) < 0.0001 && Math.abs(fLong - locLong) < 0.0001;
    });

    const handleToggleFavorite = async () => {
      if (!isFavorited) {
        await addFavorite({
          title: location.title || location.name,
          notes: favorite?.notes || '',
          coordinates: location.coordinates,
          address: location.address
        });
      } else {
        await removeFavorite(favorite._id);
      }
    };

    const handleSaveNotes = async (notes) => {
      if (favorite) {
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

    mapInstanceRef.current.setView([location.coordinates.lat, location.coordinates.long], 14);
    const existingFavorite = favorites.find(f =>
      f.coordinates?.lat === location.coordinates.lat &&
      f.coordinates?.long === location.coordinates.long
    );

    // Clear existing search markers
    mapInstanceRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker && layer._searchMarker) {
        layer.remove();
      }
    });

    const marker = L.marker([location.coordinates.lat, location.coordinates.long]);
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
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
      const data = await response.json();
      const results = data.slice(0, 3).map(item => {
        const title = item.name || item.display_name.split(',')[0].trim();
        const address = item.display_name
          .split(',')
          .map(part => part.trim())
          .filter((part, idx) => idx === 0 ? part !== title : true)
          .join(', ');
        return {
          title,
          address,
          coordinates: { lat: parseFloat(item.lat), long: parseFloat(item.lon) }
        };
      });
      setSearchResults(results);
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
    const lng = parseFloat(coordinates.long || coordinates.lng);
    if (isNaN(lat) || isNaN(lng)) return null;
    return [lat, lng];
  }

  // Initialize map
  useEffect(() => {
    if (!mapInstanceRef.current && mapRef.current) {
      const lat = searchParams.get('lat') || 37.77493;
      const lng = searchParams.get('lng') || -122.41942;

      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: false
      }).setView([lat, lng], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapInstanceRef.current);


      if (!username) {
        console.log("INIT")
        getFavorites();
      }

    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [state.user]);

  // Handle markers when favorites change and URL params
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear existing markers
    mapInstanceRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        layer.remove();
      }
    });

    // Handle URL parameters and show search pin
    if (searchParams.get('lat') && searchParams.get('lng')) {
      const coords = {
        lat: parseFloat(searchParams.get('lat')),
        long: parseFloat(searchParams.get('lng'))
      };

      const title = searchParams.get('title') ? decodeURIComponent(searchParams.get('title')) : 'Location';
      const address = searchParams.get('address') ? decodeURIComponent(searchParams.get('address')) : '';

      // Always show a pin for the search coordinates
      const location = {
        title,
        coordinates: coords,
        address
      };

      // Check if this is a favorite
      const favorite = favorites.find(f => {
        if (!f?.coordinates) return false;
        const fLat = parseFloat(f.coordinates.lat);
        const fLong = parseFloat(f.coordinates.long);
        return Math.abs(fLat - coords.lat) < 0.0001 &&
          Math.abs(fLong - coords.long) < 0.0001;
      });

      const marker = L.marker([coords.lat, coords.long])
        .bindPopup(createPopupContent(favorite || location, !!favorite), {
          minWidth: 250,
          maxWidth: 400,
          className: 'custom-popup'
        })
        .addTo(mapInstanceRef.current);
      marker.openPopup();
      mapInstanceRef.current.setView([coords.lat, coords.long], 14);
    }

    // Show all other favorites
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
  }, [favorites, searchParams]);

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
