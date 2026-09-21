## CHANGELOG

0.11.0

  Drop personal map url from changelog
  Retarget security policy

0.10.0

  Drop Railway link from README

0.9.0

  Migrate to skateboard 5.6.0 Rust backend
  Port /api/favorites and /api/profiles to zero-crate Rust
  Pin skateboard-ui 5.1.0 and lucide-react 0.546.0
  Honor DB_TYPE=libsql, copy constants.json, restore analytics CSP

0.8.0

  Restore favorites feature
  Add favorites table
  Import favorites data

0.7.0

  Migrate primary database from MongoDB to SQLite

0.6.0

  Bump skateboard 3.4.0
  Drop unused deps
  Migrate to react-router

0.5.0

  Add advanced analytics tracking
  Add AnalyticsProvider wrapper
  Add localhost analytics guard

0.3.3

  Update Dockerfile node:22-alpine

0.3.2

  Add Umami analytics
  Add analytics utility
  Track favorite events
  Track navigation events
  Update CSP headers

0.3.1

  Add shared Hono backend
  Add PWA manifest
  Update vite meta injection
  Update dependencies
  Add dark mode flash prevention
  Update icon to PNG format

0.3.0

  Migrate to Hono backend with skateboard-ui
  Update vite configuration
  Replace lucide-react with DynamicIcon
  Update dependencies

0.2.2

  Update skateboard-ui 1.0.7
  Update dependencies versions
  Import styles from skateboard
  Use Context from skateboard
  Remove duplicate context file

0.2.1

  Migrate to Skateboard 0.9.8
  Add tailwindcss-animate plugin
  Remove commented CSS code
  Fix index.html body style
  Update fetch patterns
  Add credentials include
  Add CSRF token headers
  Update vite.config.js plugins
  Remove unused utility imports

0.1.7

  Remove getDetails

0.1.6

  Fixed long convert
  Fixed search and click
  Audited place ids

0.1.5

  Removed ObjectID
  Added placeID on some favorites

0.1.4

  Added metaTags
  Fixed map profile urls
  Start location from first favorite

0.1.3

  Link to profile map from profile list
  Fixed just now
  Added getFavoritesUserName to FavContext

0.1.2

  Fixed initial load favs
  Fixed profile urls
  Added public accessible urls
  Fixed scrolling on profiles
  Added profile map url

0.1.1

  New pop-ups on mobile

0.1.0

  Fixed leaflet pins
  Added map with leaflet
  Read favorites
  Add search bar to top
  Create favorites via heart
  Delete favorites
  Update notes
  Search from HomeView
  Improved search on MapView
  Recently added section
  Profiles homeView
  Quick action buttons
  Show map button
  Fixed mapView centering
  Show other profile favorites
  Working profile url /app/@username

## To-Do

- add redirect from /signin to where you were going
- fix recently added sorting
- edit my favorites
- rank your favorites
- add social feed
- add profiles for people/celebs
- better handling for username or @handle
- add number of favorites to /profiles
