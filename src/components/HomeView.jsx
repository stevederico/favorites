import { isSubscriber } from "@stevederico/skateboard-ui/Utilities";
import { useEffect, useRef } from "react";
import Header from '@stevederico/skateboard-ui/Header';
import locations from '@/assets/locations.json';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

export default function HomeView() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapInstanceRef.current && mapRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([36.1699, -115.1398], 14);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapInstanceRef.current);

      locations.forEach(loc => {
        const [lat, lng] = loc.gps.split(', ').map(coord => parseFloat(coord));
        L.marker([lat, lng])
          .bindPopup(`
            <strong>${loc.venue}</strong><br>
            ${loc.deal_details}<br>
            Price: ${loc.price}
          `)
          .addTo(mapInstanceRef.current);
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

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
