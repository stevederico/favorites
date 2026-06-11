/**
 * Umami analytics wrapper
 * Safely handles umami not being loaded and sanitizes data
 */

/** Minimal shape of the global Umami tracker injected by the analytics script. */
interface Umami {
  track(eventName?: string, data?: Record<string, unknown>): void;
  identify(idOrData: string | Record<string, unknown>, data?: Record<string, unknown>): void;
}

declare global {
  interface Window {
    umami?: Umami;
  }
}

/** Arbitrary event payload accepted by trackEvent / identifyUser. */
type EventData = Record<string, unknown>;

/** True if running on localhost — skip all tracking */
const isLocal = (): boolean => ['localhost', '127.0.0.1'].includes(window.location.hostname);

/**
 * Sanitize event data for Umami
 * Ensures data is always a valid object with proper types
 * @param data - Data to sanitize
 * @returns Sanitized data object
 */
const sanitizeEventData = (data: unknown): Record<string, unknown> => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (value === undefined || value === null || typeof value === 'function') {
      continue;
    }

    if (typeof value === 'number') {
      sanitized[key] = Math.round(value * 10000) / 10000;
    } else if (typeof value === 'string') {
      sanitized[key] = value.substring(0, 500);
    } else if (typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      sanitized[key] = JSON.stringify(value).substring(0, 500);
    } else if (typeof value === 'object') {
      sanitized[key] = JSON.stringify(value).substring(0, 500);
    } else {
      sanitized[key] = String(value).substring(0, 500);
    }
  }

  return sanitized;
};

/**
 * Track an analytics event
 * @param eventName - Name of the event
 * @param data - Event data
 */
export const trackEvent = (eventName: string, data: EventData = {}): void => {
  if (isLocal()) return;
  if (typeof window !== 'undefined' && window.umami) {
    try {
      const sanitizedData = sanitizeEventData(data);
      window.umami.track(eventName, sanitizedData);
    } catch (error) {
      console.warn('Analytics tracking failed:', error);
    }
  }
};

/**
 * Identify a user for analytics
 * @param userId - User ID
 * @param data - User metadata
 */
export const identifyUser = (userId: string, data: EventData = {}): void => {
  if (isLocal()) return;
  if (typeof window !== 'undefined' && window.umami) {
    try {
      if (userId) {
        window.umami.identify(userId, data);
      } else {
        window.umami.identify(data);
      }
    } catch (error) {
      console.warn('User identification failed:', error);
    }
  }
};

/**
 * Track a page view
 */
export const trackPageView = (): void => {
  if (isLocal()) return;
  if (typeof window !== 'undefined' && window.umami) {
    try {
      window.umami.track();
    } catch (error) {
      console.warn('Page view tracking failed:', error);
    }
  }
};
