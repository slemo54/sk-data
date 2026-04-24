// Seed-only dataset used by import scripts.
// Runtime UI now reads from Supabase contacts tables.
import restaurantsJson from './restaurants.json';

export interface RestaurantSeed {
  id: number;
  restaurant: string;
  city: string;
  state: string;
  country: string;
  award: string;
  wine_director: string;
  sommelier: string;
  general_manager: string;
}

export const RESTAURANTS_SEED = restaurantsJson as RestaurantSeed[];
