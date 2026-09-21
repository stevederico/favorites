import { useEffect, useRef, useState, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { useSearchParams, useParams } from 'react-router';
import { Search, MapPin } from 'lucide-react';
import { createRoot } from 'react-dom/client';
import { getState } from '@stevederico/skateboard-ui/Context';
import { useFavorites } from '../contexts/FavoritesContext';
import type { Coordinates, Favorite, SearchResult } from '../contexts/FavoritesContext';
import { trackEvent } from '../utils/analytics';

import * as L from 'leaflet';
import type { LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png?no-inline';
import icon from 'leaflet/dist/images/marker-icon.png?no-inline';
import shadow from 'leaflet/dist/images/marker-shadow.png?no-inline';

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetina,
  iconUrl: icon,
  shadowUrl: shadow,
});

/** A location shown in a map popup — a saved favorite or a search hit. */
interface PopupLocation {
  title?: string;
  name?: string;
  address?: string;
  notes?: string;
  coordinates?: Coordinates;
  _id?: string;
  [key: string]: unknown;
}

/** Props for the in-popup favorite editor rendered into a Leaflet marker. */
interface LocationPopupProps {
  /** Location being displayed/edited */
  location: PopupLocation;
  /** Whether the location is already a favorite */
  isFavorited: boolean;
  /** Persist edited notes (and favorite, if needed) */
  onSaveNotes: (notes: string) => void;
  /** Toggle the favorite state for this location */
  onToggleFavorite: () => void | Promise<void>;
}

const LocationPopup = ({ location, isFavorited, onSaveNotes, onToggleFavorite }: LocationPopupProps) => {
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
          <svg
            className={`w-10 h-10 ${isFavorited ? 'fill-current text-red-500' : 'text-accent/70'}`}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill={isFavorited ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
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
          rows={3}
          value={notes}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
          onBlur={handleSave}
        />
      </div>
    </div>
  );
};

export default function MapView() {
  const { state } = getState();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams] = useSearchParams();
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { favorites, getFavorites, addFavorite, removeFavorite, updateFavorite, getFavoritesUserName, isInFavorites, searchLocations } = useFavorites();
  const qUsername = searchParams.get('username');
  const { username } = useParams();

  useEffect(() => {
    const name = username ?? qUsername;
    if (name) {
      getFavoritesUserName(name);
      return;
    }
    if (state.user) {
      getFavorites();
    }
  }, [username, qUsername, state.user]);



  function createPopupContent(location: PopupLocation, isFavorited = false): HTMLDivElement {
    const container = document.createElement('div');
    const root = createRoot(container);

    const favorite = favorites.find(f => isInFavorites(location, [f]));

    const placeTitle = location.title || location.name || '';

    const handleToggleFavorite = async () => {
      if (!isFavorited) {
        await addFavorite({
          title: placeTitle,
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
        const favId = favorite?._id;
        if (!favId) return;
        await removeFavorite(String(favId));
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

    const handleSaveNotes = async (notes: string) => {
      if (!favorite && !isFavorited) {
        // Create favorite first if it doesn't exist
        await addFavorite({
          title: placeTitle,
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
      } else if (favorite?._id) {
        await updateFavorite(String(favorite._id), { notes });
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

  const handleSearchInput = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleResultClick = (result: SearchResult) => {
    setSearchQuery('');
    setSearchResults([]);
    trackEvent('search-result-clicked', { title: result.title });

    const map = mapInstanceRef.current;
    if (!map) return;

    const lat = result.coordinates.lat;
    const lon = result.coordinates.lon;
    const location: PopupLocation = {
      title: result.title,
      coordinates: { lat, lon },
      address: result.address
    };

    map.setView([lat, lon], 14);
    const existingFavorite = isInFavorites(location, favorites);

    // Clear existing search markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker && layer._searchMarker) {
        layer.remove();
      }
    });

    const marker = L.marker([lat, lon]);
    marker._searchMarker = true;
    marker.bindPopup(createPopupContent(location, !!existingFavorite), {
      minWidth: 250,
      maxWidth: 400,
      className: 'custom-popup'
    })
      .addTo(map)
      .openPopup();
  };

  const debouncedSearch = useCallback(async (query: string) => {
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

  function getValidLatLng(coordinates: Coordinates | null | undefined): [number, number] | null {
    if (!coordinates) return null;
    const lat = parseFloat(String(coordinates.lat));
    const lon = parseFloat(String(coordinates.lon));
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
    const map = mapInstanceRef.current;
    if (!map || !favorites) return;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        layer.remove();
      }
    });

    const latParam = searchParams.get('lat');
    const lonParam = searchParams.get('lon');
    const titleParam = searchParams.get('title');
    const addressParam = searchParams.get('address');

    // Set view based on URL params or first favorite
    if (latParam && lonParam) {
      map.setView([parseFloat(latParam), parseFloat(lonParam)], 14);
    } else if (favorites.length > 0 && favorites[0].coordinates) {
      const coords = getValidLatLng(favorites[0].coordinates);
      if (coords) {
        map.setView(coords, 14);
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
          .addTo(map);
      }
    });

    // Handle URL parameter pin last to ensure it's on top
    if (latParam && lonParam) {
      const coords = {
        lat: parseFloat(latParam),
        lon: parseFloat(lonParam)
      };
      const title = titleParam ? decodeURIComponent(titleParam) : 'Location';
      const address = addressParam ? decodeURIComponent(addressParam) : '';
      const location: PopupLocation = { title, coordinates: coords, address };
      const favorite = favorites.find(f => isInFavorites(location, [f]));

      const marker = L.marker([coords.lat, coords.lon])
        .bindPopup(createPopupContent(favorite || location, !!favorite), {
          minWidth: 250,
          maxWidth: 400,
          className: 'custom-popup'
        })
        .addTo(map);
      marker.openPopup();
    }
  }, [favorites, searchParams, username, qUsername]); // Added username dependencies

  return (
    <div className="w-screen h-screen relative flex flex-col">
      <div className="w-full absolute top-4 z-[1000]  px-2 pt-2">
        <div data-section-id="map-search" className="relative md:w-[calc(100vw-190px)] max-w-full mx-2">
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchInput}
            placeholder="Search places..."
            data-umami-event="map-search-input-focused"
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
                    data-umami-event="map-search-result-clicked"
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
