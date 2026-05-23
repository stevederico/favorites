import { Link } from 'react-router';
import DynamicIcon from '@stevederico/skateboard-ui/DynamicIcon';
import { useFavorites } from '../contexts/FavoritesContext';

export default function LocationCard({ location, showRemove = true }) {
  const { favorites, removeFavorite, addFavorite } = useFavorites();

  const isInFavorites = () => {
    return favorites.some(fav =>
      fav.coordinates?.lat === location.coordinates?.lat &&
      fav.coordinates?.lon === location.coordinates?.lon
    );
  };

return (
    <div className="bg-accent rounded-xl shadow-md p-4">
        <h3 className="font-semibold text-lg mb-2">{location.title}</h3>
        {location.address && (
            <p className="text-sm mb-4 opacity-70">{location.address}</p>
        )}
        <div className="flex justify-between items-center">
            {showRemove ? (
                isInFavorites() ? (
                    <button
                        onClick={() => {
                            const existingFav = favorites.find(fav =>
                                fav.coordinates?.lat === location.coordinates?.lat &&
                                fav.coordinates?.lon === location.coordinates?.lon
                            );
                            if (existingFav) removeFavorite(existingFav._id);
                        }}
                        data-umami-event="remove-favorite-clicked"
                        className="flex items-center gap-2 px-4 py-2 rounded-full text-red-500 border border-red-500 hover:bg-red-600 transition-colors cursor-pointer"
                    >
                        <DynamicIcon name="x" size={16} />
                        <span>Remove</span>
                    </button>
                ) : (
                    <button
                        onClick={() => addFavorite(location)}
                        data-umami-event="add-favorite-clicked"
                        className="flex items-center gap-2 px-4 py-2 rounded-full text-white bg-blue-500 hover:bg-blue-600 transition-colors cursor-pointer"
                    >
                        <DynamicIcon name="heart" size={16} />
                        <span>Favorite</span>
                    </button>
                )
            ) : null}
            <Link
                to={`/app/map?lat=${location.coordinates?.lat}&lon=${location.coordinates?.lon}&title=${encodeURIComponent(location.title)}&address=${encodeURIComponent(location.address)}`}
                data-umami-event="view-map-clicked"
                className="flex items-center gap-2 px-4 py-2 rounded-full text-white bg-blue-500 hover:bg-blue-600 transition-colors cursor-pointer"
            >
                <DynamicIcon name="map-pin" size={16} />
                <span>View Map</span>
            </Link>
        </div>
    </div>
);
}
