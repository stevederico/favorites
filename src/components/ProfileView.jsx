import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useFavorites } from '../contexts/FavoritesContext';
import LocationCard from './LocationCard';

export default function MyFavorites({ isOpen, onClose }) {
  const { favorites } = useFavorites();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50">
      <div 
        className={`fixed bottom-0 left-0 right-0 bg-background rounded-t-3xl shadow-lg transform transition-transform duration-300 ease-out flex flex-col h-[98vh] ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold">My Favorites</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-full transition-colors cursor-pointer"
          >
            <X size={24} />
          </button>
        </div>

        {/* Favorites List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4 h-full">
            {favorites.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="opacity-70">No favorite places yet</p>
              </div>
            ) : (
              favorites.map(favorite => (
                <LocationCard 
                  key={favorite._id} 
                  location={favorite}
                  showRemove={true}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}