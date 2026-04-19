export type ScoringMode = 'match' | 'rank' | 'normalized';
export type GauntletStatus = 'draft' | 'active' | 'completed';

export interface GameConfig {
  game_id: string;
  title: string;
  platform: string;
  cover_url?: string;
  genre?: string;
  year?: number;
  rawg_id?: string;
  order: number;
  scoring_mode: ScoringMode;
  points_for_rank: number[];
  points_for_winner: number;
  best_of: number;
}

export interface GameResult {
  game_id: string;
  scores: Record<string, number>;
  points_awarded: Record<string, number>;
  completed: boolean;
}

export interface Gauntlet {
  id: string;
  name: string;
  player_names: string[];
  game_configs: GameConfig[];
  game_results: GameResult[];
  status: GauntletStatus;
  created?: string;
  updated?: string;
}

export interface GauntletResult {
  id: string;
  gauntlet_id: string;
  final_standings: Record<string, number>;
  winner: string;
  completed_at: string;
  expand?: { gauntlet_id?: Gauntlet };
}
