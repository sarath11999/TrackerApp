import { router, type Href } from 'expo-router';

/** Go back if there is history (e.g. opened normally), otherwise replace with a fallback route (deep link). */
export function goBack(fallback: Href = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
