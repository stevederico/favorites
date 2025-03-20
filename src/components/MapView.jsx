import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFavorites } from '../contexts/FavoritesContext';
import { Search, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

export default function MapView() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams] = useSearchParams();
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const { favorites, getFavorites, addFavorite, removeFavorite, updateFavorite } = useFavorites();

  function createPopupContent(location, isFavorited = false) {
    const container = document.createElement('div');
    const favorite = favorites.find(f => {
      if (!f.coordinates || !location.coordinates) return false;
      const fLat = parseFloat(f.coordinates.lat);
      const fLong = parseFloat(f.coordinates.long);
      const locLat = parseFloat(location.coordinates.lat);
      const locLong = parseFloat(location.coordinates.long);
      return fLat === locLat && fLong === locLong;
    });

    container.innerHTML = `
      <div class="flex flex-col gap-2 min-w-[200px]">
        <strong class="text-lg">${location.title || location.name}</strong>
        <div class="text-sm">${location.address || ''}</div>
        <div class="flex flex-col gap-2 mt-2">
          <textarea 
            class="note-input px-2 py-1 rounded border border-gray-300" 
            placeholder="Add notes..."
            rows="3"
          >${favorite?.notes || ''}</textarea>
          <div class="flex justify-between items-center mt-2">
            <button class="save-note-btn px-2 py-1 border rounded hover:opacity-80 ${!isFavorited ? 'hidden' : ''}">
              Save Notes
            </button>
            <button class="heart-btn text-xl" data-location='${JSON.stringify(location)}'>
              ${isFavorited ? '❤️' : '🤍'}
            </button>
          </div>
        </div>
      </div>
    `;

    const heartBtn = container.querySelector('.heart-btn');
    const noteInput = container.querySelector('.note-input');
    const saveNoteBtn = container.querySelector('.save-note-btn');

    heartBtn.addEventListener('click', async function() {
      const locationData = JSON.parse(this.dataset.location);
      const existingFavorite = favorites.find(f => {
        if (!f.coordinates || !locationData.coordinates) return false;
        const fLat = parseFloat(f.coordinates.lat);
        const fLong = parseFloat(f.coordinates.long);
        const locLat = parseFloat(locationData.coordinates.lat);
        const locLong = parseFloat(locationData.coordinates.long);
        return fLat === locLat && fLong === locLong;
      });
      
      if (!existingFavorite) {
        const newFavorite = await addFavorite({ 
          title: locationData.title || locationData.name,
          notes: noteInput.value,
          coordinates: locationData.coordinates,
          address: locationData.address
        });
        if (newFavorite) {
          this.textContent = '❤️';
          saveNoteBtn.classList.remove('hidden');
        }
      } else {
        const success = await removeFavorite(existingFavorite._id);
        if (success) {
          this.textContent = '🤍';
          saveNoteBtn.classList.add('hidden');
        }
      }
    });

    if (isFavorited) {
      saveNoteBtn.addEventListener('click', async () => {
        const existingFavorite = favorites.find(f => {
          if (!f.coordinates || !location.coordinates) return false;
          const fLat = parseFloat(f.coordinates.lat);
          const fLong = parseFloat(f.coordinates.long);
          const locLat = parseFloat(location.coordinates.lat);
          const locLong = parseFloat(location.coordinates.long);
          return fLat === locLat && fLong === locLong;
        });
        
        if (existingFavorite) {
          await updateFavorite(existingFavorite._id, { notes: noteInput.value });
        }
      });
    }
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
    marker.bindPopup(createPopupContent(location, !!existingFavorite))
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
      const results = data.slice(0, 3).map(item => ({
        title: item.name || item.display_name.split(',')[0].trim(),
        address: item.display_name,
        coordinates: { lat: parseFloat(item.lat), long: parseFloat(item.lon) }
      }));
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
      const lat = searchParams.get('lat') || 36.1699;
      const lng = searchParams.get('lng') || -115.1398;
      
      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: false
      }).setView([lat, lng], 14);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapInstanceRef.current);

      getFavorites();
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

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
        .bindPopup(createPopupContent(favorite || location, !!favorite))
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
          .bindPopup(createPopupContent(loc, true))
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
