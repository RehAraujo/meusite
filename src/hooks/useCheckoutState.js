import { useSyncExternalStore } from 'react';
import { getCheckoutState, subscribeCheckout } from '../lib/commerce-checkout';

// Shared purchase state for every checkout button on the page (see commerce-checkout.js).
export function useCheckoutState() {
  return useSyncExternalStore(subscribeCheckout, getCheckoutState, getCheckoutState);
}
