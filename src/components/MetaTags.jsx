import { useEffect } from 'react';
import { useLocation } from 'react-router';
import constants from '../constants.json';

const MetaTags = ({ title, description, image }) => {
  const location = useLocation();
  const baseUrl = window.location.origin;
  const currentUrl = baseUrl + location.pathname;

  const defaultTitle = constants.appName;
  const defaultDesc = constants.tagline;

  useEffect(() => {
    const finalTitle = title || defaultTitle;
    const finalDesc = description || defaultDesc;

    document.title = finalTitle;

    // Update meta tags
    document.querySelector('meta[name="title"]')?.setAttribute('content', finalTitle);
    document.querySelector('meta[name="description"]')?.setAttribute('content', finalDesc);

    // Update OG tags
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', finalTitle);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', finalDesc);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', currentUrl);
    if (image) {
      document.querySelector('meta[property="og:image"]')?.setAttribute('content', image);
    }

    // Update Twitter tags
    document.querySelector('meta[property="twitter:title"]')?.setAttribute('content', finalTitle);
    document.querySelector('meta[property="twitter:description"]')?.setAttribute('content', finalDesc);
    document.querySelector('meta[property="twitter:url"]')?.setAttribute('content', currentUrl);
    if (image) {
      document.querySelector('meta[property="twitter:image"]')?.setAttribute('content', image);
    }
  }, [title, description, image, currentUrl, defaultTitle, defaultDesc]);

  return null;
}

export default MetaTags;
