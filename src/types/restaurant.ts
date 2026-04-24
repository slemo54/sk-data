export interface Restaurant {
  id: number;
  restaurant: string;
  city: string;
  state: string;
  country: string;
  award: string;
  wine_director: string;
  sommelier: string;
  general_manager: string;
  wd_ig: string;
  wd_li: string;
  somm_ig: string;
  somm_li: string;
  gm_ig: string;
  gm_li: string;
}

export interface Stats {
  total: number;
  has_social: number;
  ig_total: number;
  ig_wd: number;
  ig_somm: number;
  ig_gm: number;
  li_total: number;
  li_wd: number;
  li_somm: number;
  li_gm: number;
}

export interface ChangeItem {
  id: number;
  restaurant: string;
  field: string;
  oldVal: string;
  newVal: string;
}

export type SortCol = 'restaurant' | 'location' | 'award' | 'wine_director' | 'sommelier' | 'general_manager';
export type SortDir = 'asc' | 'desc';
