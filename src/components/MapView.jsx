import { useEffect, useRef, useState } from "react";
import { useSearchParams } from 'react-router-dom';
import { useFavorites } from '../contexts/FavoritesContext';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

export default function MapView() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams] = useSearchParams();
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

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data.length > 0) {
        const { lat, lon, display_name, name } = data[0];
        
        const title = name || display_name.split(',')[0].trim();
        
        const location = {
          title,
          coordinates: { lat: parseFloat(lat), long: parseFloat(lon) },
          address: display_name
        };
        
        mapInstanceRef.current.setView([location.coordinates.lat, location.coordinates.long], 14);
        const existingFavorite = favorites.find(f => 
          f.coordinates.lat === location.coordinates.lat && 
          f.coordinates.long === location.coordinates.long
        );
        
        L.marker([location.coordinates.lat, location.coordinates.long])
          .bindPopup(createPopupContent(location, !!existingFavorite))
          .addTo(mapInstanceRef.current);
      }
    } catch (error) {
      console.error('Error searching location:', error);
    }
  }

  function getValidLatLng(coordinates) {
    if (!coordinates) return null;
    const lat = parseFloat(coordinates.lat);
    const lng = parseFloat(coordinates.long);
    if (isNaN(lat) || isNaN(lng)) return null;
    return [lat, lng];
  }

  // Initialize map
  useEffect(() => {
    if (!mapInstanceRef.current && mapRef.current) {
      const lat = searchParams.get('lat') || 36.1699;
      const lng = searchParams.get('lng') || -115.1398;
      
      mapInstanceRef.current = L.map(mapRef.current).setView([lat, lng], 14);
      
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
    if (mapInstanceRef.current && favorites?.length > 0) {
      mapInstanceRef.current.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          layer.remove();
        }
      });
      
      // Handle URL parameters after favorites are loaded
      if (searchParams.get('lat') && searchParams.get('lng')) {
        const coords = {
          lat: parseFloat(searchParams.get('lat')),
          long: parseFloat(searchParams.get('lng'))
        };
        const favorite = favorites.find(f => {
          if (!f?.coordinates) return false;
          return f.coordinates.lat === coords.lat && 
                 f.coordinates.long === coords.long;
        });
        if (favorite) {
          const marker = L.marker([coords.lat, coords.long])
            .bindPopup(createPopupContent(favorite, true))
            .addTo(mapInstanceRef.current);
          marker.openPopup();
          return;
        }
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
    }
  }, [favorites, searchParams]);

  return (
    <div className="w-screen h-screen relative">
      <form onSubmit={handleSearch} className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search location..."
          className="px-4 py-2 rounded-lg shadow-lg border border-gray-300 w-64 bg-background"
        />
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-lg shadow-lg hover:bg-blue-600">
          Search
        </button>
      </form>
      <div ref={mapRef} className="w-full h-full"></div>
    </div>
  );
}
