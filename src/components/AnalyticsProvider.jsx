/**
 * Analytics wrapper component for Skateboard apps
 *
 * Sets up advanced Umami analytics (scroll, time, exit intent, sections, etc.)
 * and monitors auth state to identify users and track sign-in/sign-out events.
 * Pass as the `wrapper` prop to createSkateboardApp().
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components (Router + App)
 */
import { useEffect, useRef } from 'react';
import { getState } from '@stevederico/skateboard-ui/Context';
import { identifyUser, trackEvent } from '../utils/analytics';
import useAdvancedAnalytics from '../utils/useAdvancedAnalytics';

export default function AnalyticsProvider({ children }) {
  useAdvancedAnalytics();

  const { state } = getState();
  const previousUserRef = useRef(null);

  useEffect(() => {
    const currentUser = state.user;
    const previousUser = previousUserRef.current;

    if (currentUser && !previousUser) {
      identifyUser(currentUser.id, {
        email: currentUser.email,
        name: currentUser.name,
        subscription: currentUser.subscription?.status || 'free'
      });
      trackEvent('signin-completed');
    }

    if (!currentUser && previousUser) {
      trackEvent('signout');
    }

    previousUserRef.current = currentUser;
  }, [state.user]);

  return <>{children}</>;
}
