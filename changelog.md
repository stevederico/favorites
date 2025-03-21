constants.json
set AppName
set TagLine
set backendURL and devBackendURL
package.json
set name
set version    
set primary color in styles.css
remove readme.md
deno install
create DB in mongo
start github repo
added maped with leaflet
added to config.json in bixby-backend
switch to backend and database
read favorites
started createSheet
add a search bar to the top, search by place name or city
create favorites via heart
needs to keep my likes in state and the pop-up when needed
delete favorites
update notes
Search from HomeView
Improved search on MapView
Search bar homeView
recently added
profiles homeView
quick action button
show map button
fixed mapView centering
identical searchBars
fixing pop-ups
show other profile favorites
working profile url /app/@frank
0.1.0
fixed leaflet pins
0.1.1
new pop-ups on mobile
0.1.2
fixed inital load favs
fixed profile urls
added public accessible urls **
fixed scrolling on profiles
added profile map url
0.1.3
link to profile map from profile list
fixed just now
added getFavoritesUserName to Favcontext
0.1.4
added metaTags
- start location should be their first favorite

- fix recently added
- add placeId to all existing favs
- edit my favorites
- rank your favorites
- add social feed
- add profiles for people/celebs and fill it out for them, normand and david chang


- better handling for user name or @handle
- add number of favorites to /profiles?

TEMPLATE
- git init
- constants.json
    - set AppName
    - set TagLine
    - set backendURL and devBackendURL
- package.json
    - set name
    - set version    
    - prod script
            "prod": "vite build --mode production; cp -r ./dist/* ../bixby-proxy/public/food.bixbyapps.com"
- set primary color in styles.css
- remove readme.md
- deno install
- create DB in mongo
- add folder to bixby-proxy
- start github repo
- add to config.json in bixby-backend, set locahost in config.json to current DB
- create router for bixby-backend

