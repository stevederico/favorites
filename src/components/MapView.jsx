import { isSubscriber } from "@stevederico/skateboard-ui/Utilities";
import { useEffect, useRef, useState } from "react";
import { getCurrentUser, getCookie, timestampToString, getBackendURL } from '@stevederico/skateboard-ui/Utilities';


import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

export default function MapView() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [favorites, setFavorites] = useState([]);


  async function getFavorites(){
    try {
      const response = await fetch(`${getBackendURL()}/favorites`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getCookie('token')}`,
        }
      });
      
      if (response.status === 200) {
        const data = await response.json();
        setFavorites(data);
        return data;
      } else {
        console.log("Error fetching favorites: ", response);
        return [];
      }
    } catch (error) {
      console.error("Failed to fetch favorites:", error);
      return [];
    }
  }

  // Initialize map
  useEffect(() => {
    if (!mapInstanceRef.current && mapRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([36.1699, -115.1398], 14);
      
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
  }, []); // Only run on mount

  // Handle markers when favorites change
  useEffect(() => {
    if (mapInstanceRef.current && favorites.length > 0) {
      // Clear existing markers
      mapInstanceRef.current.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          layer.remove();
        }
      });

      // Add new markers
      favorites.forEach(loc => {
        if (loc.gps) {
          const [lat, lng] = loc.gps.split(', ').map(coord => parseFloat(coord));
          L.marker([lat, lng])
            .bindPopup(`
              <strong>${loc.venue}</strong><br>
              ${loc.deal_details}<br>
              Price: ${loc.price}
            `)
            .addTo(mapInstanceRef.current);
        }
      });
    }
  }, [favorites]); // Only run when favorites change

  useEffect(() => {
    isSubscriber().then(s => {
      // Implement subscriber status handling if necessary
    });
  }, []);

  return (
    <div className="w-screen h-screen">

      <div ref={mapRef} className="w-full h-full"></div>
    
      

    </div>
  );
}
