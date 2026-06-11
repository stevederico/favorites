/**
 * Ambient type declarations for the `leaflet` package.
 *
 * The project bans `@types/*` packages, so this local shim declares only the
 * surface that MapView.tsx consumes: the map/marker/tileLayer factories, the
 * Marker and Icon classes, and the Default icon's merge/prototype helpers.
 * Runtime objects (maps, markers, popups, layers) are intentionally loose
 * (`any`) — Leaflet is used imperatively and full typings would add no safety
 * for the handful of imperative calls here, while pulling in @types is not
 * allowed.
 */
declare module 'leaflet' {
  /** A Leaflet popup bound to a marker. */
  export interface Popup {
    isOpen(): boolean;
    setContent(content: HTMLElement | string): this;
    setLatLng(latlng: [number, number] | { lat: number; lng: number }): this;
    update(): this;
  }

  /** A marker layer. Extended with an app-specific `_searchMarker` flag. */
  export interface Marker {
    _searchMarker?: boolean;
    getPopup(): Popup;
    getLatLng(): { lat: number; lng: number };
    bindPopup(content: HTMLElement | string, options?: Record<string, unknown>): this;
    addTo(map: LeafletMap): this;
    openPopup(): this;
    remove(): this;
  }
  export const Marker: {
    new (latlng: [number, number]): Marker;
    prototype: Marker;
  };

  /** A Leaflet map instance. */
  export interface LeafletMap {
    setView(center: [number, number], zoom: number): this;
    eachLayer(fn: (layer: any) => void): this;
    remove(): this;
  }

  /** Default marker icon with the legacy `_getIconUrl` workaround hook. */
  export const Icon: {
    Default: {
      prototype: { _getIconUrl?: unknown };
      mergeOptions(options: Record<string, unknown>): void;
    };
  };

  export function map(element: HTMLElement, options?: Record<string, unknown>): LeafletMap;
  export function tileLayer(urlTemplate: string, options?: Record<string, unknown>): { addTo(map: LeafletMap): unknown };
  export function marker(latlng: [number, number], options?: Record<string, unknown>): Marker;
}
