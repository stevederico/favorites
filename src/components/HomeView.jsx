import { isSubscriber } from "@stevederico/skateboard-ui/Utilities";
import { useEffect, useRef, useState } from "react";
import Header from '@stevederico/skateboard-ui/Header';
import CreateSheet from './CreateSheet';

export default function HomeView() {
  const [open, setOpen] = useState(false);
  const [favorites, setFavorites] = useState([]);

  const getFavorites = async () => {
    try {
      const response = await fetch('/api/favorites');
      const data = await response.json();
      setFavorites(data);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  };

  useEffect(() => {
    isSubscriber().then(s => {
      // Implement subscriber status handling if necessary
    });
    getFavorites();
  }, []);

  return (
    <>
      <Header
        buttonTitle="New"
        title="Home"
        onButtonTitleClick={() => setOpen(true)}
      />
      
      <CreateSheet 
        open={open} 
        setOpen={setOpen} 
        onSuccess={getFavorites}
      />
    </>
  )
}
