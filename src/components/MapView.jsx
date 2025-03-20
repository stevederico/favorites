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
  const { favorites, getFavorites, addFavorite, removeFavorite } = useFavorites();

  function createPopupContent(location, isFavorited = false) {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="flex flex-col gap-2">
        <div class="flex justify-between items-start">
          <strong>${location.name || location.venue}</strong>
          <button class="heart-btn ml-2 text-xl" data-location='${JSON.stringify(location)}'>
            ${isFavorited ? '❤️' : '🤍'}
          </button>
        </div>
        ${location.address ? `<div>${location.address}</div>` : ''}
        ${location.deal_details ? `<div>${location.deal_details}</div>` : ''}
        ${location.price ? `<div>Price: ${location.price}</div>` : ''}
      </div>
    `;

    const heartBtn = container.querySelector('.heart-btn');
    heartBtn.addEventListener('click', async function() {
      const locationData = JSON.parse(this.dataset.location);
      const existingFavorite = favorites.find(f => f.gps === locationData.gps);
      
      if (!existingFavorite) {
        const newFavorite = await addFavorite(locationData);
        if (newFavorite) {
          this.textContent = '❤️';
        }
      } else {
        const success = await removeFavorite(existingFavorite._id);
        if (success) {
          this.textContent = '🤍';
        }
      }
    });

    return container;
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery) return;

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      if (data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const location = {
          name: display_name,
          gps: `${lat}, ${lon}`,
          address: display_name
        };
        
        mapInstanceRef.current.setView([lat, lon], 14);
        const existingFavorite = favorites.find(f => f.gps === location.gps);
        
        L.marker([lat, lon])
          .bindPopup(createPopupContent(location, !!existingFavorite))
          .addTo(mapInstanceRef.current);
      }
    } catch (error) {
      console.error('Error searching location:', error);
    }
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

  // Handle markers when favorites change
  useEffect(() => {
    if (mapInstanceRef.current && favorites.length > 0) {
      mapInstanceRef.current.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          layer.remove();
        }
      });

      favorites.forEach(loc => {
        if (loc.gps) {
          const [lat, lng] = loc.gps.split(', ').map(coord => parseFloat(coord));
          L.marker([lat, lng])
            .bindPopup(createPopupContent(loc, true))
            .addTo(mapInstanceRef.current);
        }
      });
    }
  }, [favorites]);

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
