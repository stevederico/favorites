import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Header from '@stevederico/skateboard-ui/Header';
import { useFavorites } from '../contexts/FavoritesContext';


export default function ProfileView() {

  const { username } = useParams();
  const navigate = useNavigate();
  const { favorites, searchLocations, updateFavorite, getFavoritesUserName } = useFavorites();
  const [loading, setLoading] = useState({});
  const [searchResults, setSearchResults] = useState([]);
  const [selectedFavorite, setSelectedFavorite] = useState(null);
  
  useEffect(() => {
    getFavoritesUserName(username)
  }, [username]);

  const handleGetDetails = async (favorite) => {
    if (loading[favorite._id]) return;
    
    setLoading(prev => ({ ...prev, [favorite._id]: true }));
    
    try {
      const query = `${favorite.title} ${favorite.address?.split(',').slice(-2)[0] || ''}`.trim();
      // const query = `${favorite.address}`.trim();
      const results = await searchLocations(query);
      
      if (results && results.length > 0) {
        console.log("R: ", results)
        setSearchResults(results);
        setSelectedFavorite(favorite);
      } else {
        alert('No details found for this location');
      }
    } catch (error) {
      console.error('Error getting details:', error);
    } finally {
      setLoading(prev => ({ ...prev, [favorite._id]: false }));
    }
  };

  const handleSelectResult = async (result) => {
    if (!selectedFavorite) return;
    
    try {
      await updateFavorite(selectedFavorite._id, { 
        placeID: result.placeID,
        coordinates: {
          lat: result.coordinates.lat,
          lon: result.coordinates.lon
        }, 
        details: {...result.details}
      });
      setSearchResults([]);
      setSelectedFavorite(null);
    } catch (error) {
      console.error('Error updating favorite:', error);
    }
  };

  const handleCloseResults = () => {
    setSearchResults([]);
    setSelectedFavorite(null);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header className="capitalize" title={`${username}'s Favorites`} buttonTitle={`Show in Map`} onButtonTitleClick={()=>{
        navigate(`/app/map?username=${username}`)
      }} />
      
      {searchResults.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-accent rounded-xl p-6 max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Select Matching Location</h3>
              <button onClick={handleCloseResults} className="p-2">✕</button>
            </div>
            
            <p className="mb-4">Select which location details you want to use for: <span className="font-semibold">{selectedFavorite?.title} {selectedFavorite?.address}</span></p>
            
            <div className="space-y-4">
              {searchResults.map((result, index) => (

                <div 
                  key={index} 
                  className="bg-background rounded-lg p-4 hover:bg-accent/80 cursor-pointer"
                  onClick={() => handleSelectResult(result)}
                >
             
                  <div className="flex flex-col gap-1 text-sm">
                    <h4 className="font-semibold">{result.name}</h4>
                    <p className="text-sm mb-2">{result.address}</p>
                    <span className="px-2 rounded ">PlaceID: {result.placeID}</span>

                    <span className="px-2 rounded ">Lat: {result.coordinates.lat}</span>
                    <span className="px-2 rounded ">Lon: {result.coordinates.lon}</span>
                    <span className="px-2 rounded ">AddressType: {result.details.addresstype}</span>
                    <span className="px-2 rounded ">Class: {result.details.class}</span>
                    <span className="px-2 rounded ">Type: {result.details.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-4 space-y-4">
          {favorites.length === 0 ? (
            <div className="flex items-center justify-center min-h-[50vh]">
              <p className="opacity-70">No favorites found</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {favorites.filter(favorite => !favorite.placeID).map(favorite => (
                <div key={favorite._id} className="bg-accent rounded-xl shadow-md p-4 transition-all hover:scale-[1.02]">
                  <h3 className="font-semibold text-lg mb-2">{favorite.title}</h3>
                  <p className="text-sm mb-4 opacity-70">{favorite.address}</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Link
                      to={`/app/map/${username}?lat=${favorite.coordinates?.lat}&lon=${favorite.coordinates?.lon}&title=${encodeURIComponent(favorite.title)}&address=${encodeURIComponent(favorite.address || '')}`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent hover:bg-accent/80 border border-accent transition-colors"
                    >
                      <MapPin size={16} />
                      <span>View on Map</span>
                    </Link>

                  </div>
                </div>
              ))}
              
              {/* Display favorites with placeID */}
              {favorites.filter(favorite => favorite.placeID).map(favorite => (
                <div key={favorite._id} className="bg-accent rounded-xl shadow-md p-4 transition-all hover:scale-[1.02]">
                  <h3 className="font-semibold text-lg mb-2">{favorite.title}</h3>
                  <p className="text-sm mb-4 opacity-70">{favorite.address}</p>
                  <Link
                    to={`/app/map/${username}?lat=${favorite.coordinates?.lat}&lon=${favorite.coordinates?.lon}&title=${encodeURIComponent(favorite.title)}&address=${encodeURIComponent(favorite.address || '')}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent hover:bg-accent/80 border border-accent transition-colors"
                  >
                    <MapPin size={16} />
                    <span>View on Map</span>
                  </Link>
                </div>
              ))}
            </div>
          )}
          <div className="h-24" />
        </div>
      </main>
    </div>
  );
}