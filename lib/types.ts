export type ItemType = "bauble" | "candy_cane" | "star" | "gift" | "bell";

export interface DbUser {
  id: string;
  display_name: string;
  last_watered_at: string | null;
  last_fertilized_at: string | null;
}

export interface DbTree {
  id: string;
  type: "community" | "personal";
  owner_id: string | null;
  water_count: number;
  fertilizer_count: number;
  votes_count: number;
}

export interface DbDeco {
  id: string;
  tree_id: string;
  user_id: string;
  item_type: ItemType;
  color: string;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  cheers_count: number;
}

export interface DbWish {
  id: string;
  user_id: string;
  message: string;
  stocking_color: string;
  cheers_count: number;
  created_at: string;
}

export type LightMode = "off" | "warm" | "blink" | "rainbow";
export type Atmosphere = "day" | "night" | "aurora";
export type CameraPresetName = "overview" | "tree" | "wishes" | "reset";
export type Tool = { type: ItemType; color: string };
export type Fx = { kind: "water" | "fertilize"; nonce: number };
