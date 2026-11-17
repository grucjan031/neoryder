import type { HubGreetings } from '../../world/hubArrival';

const GREETED_KEY = 'neoryder.hub.greeted';

export function createHubGreetings(): HubGreetings {
  return {
    last() {
      try {
        return localStorage.getItem(GREETED_KEY);
      } catch {
        return null;
      }
    },
    mark(key) {
      try {
        localStorage.setItem(GREETED_KEY, key);
      } catch {
        // Stan wizyty w HubArrival zapobiega powtarzaniu bez dostępu do zapisu.
      }
    },
  };
}
