export type ScoringMode = 'winner' | 'rank' | 'highscore' | 'tournament' | 'racing';
export type GauntletStatus = 'draft' | 'active' | 'completed';

// Represents a game in a gauntlet (from gauntlet_games collection)
export interface GauntletGame {
  id: string;
  gauntlet_id: string;
  order: number;
  title: string;
  platform: string;
  cover_url?: string;
  genre?: string;
  year?: number;
  rawg_id?: string;
  scoring_mode: ScoringMode;
  tournament_mode: boolean;
  points_for_rank: number[];
  points_for_winner: number;
  points_for_loser: number;
  points_per_match_win: number;
  points_per_match_loss: number;
  completed: boolean;
}

// Represents a single 1v1 match in a tournament bracket (stored in tournament_matches collection)
export interface TournamentMatch {
  id: string;
  gauntlet_id: string;
  game_id: string;
  round: number;
  match_number: number;
  player1: string;
  player2: string;
  winner?: string;
  completed: boolean;
  next_match_id?: string;
  // For finals/championship - reference source matches via PocketBase relations
  source_match_1?: TournamentMatch | string;
  source_match_2?: TournamentMatch | string;
  // Expanded relation data (when fetched with expand)
  expand?: {
    source_match_1?: TournamentMatch;
    source_match_2?: TournamentMatch;
  };
}

// Result data for non-tournament games (stored in gauntlet_game_results collection)
export interface GameResult {
  id?: string;
  gauntlet_id: string;
  game_id: string;
  scores: Record<string, number>; // player -> raw score
  points_awarded: Record<string, number>; // player -> calculated points
  completed: boolean;
}

// Slim gauntlet - just metadata
export interface Gauntlet {
  id: string;
  name: string;
  player_names: string[];
  status: GauntletStatus;
  created?: string;
  updated?: string;
}

// Lightweight per-game completion status (gauntlet_game_status collection)
export interface GauntletGameStatus {
  id?: string;
  gauntlet_id: string;
  game_id: string;
  completed: boolean;
}

// Live running standings stored server-side (gauntlet_standings collection)
export interface GauntletStandings {
  id?: string;
  gauntlet_id: string;
  points: Record<string, number>;
}

// Final standings when gauntlet completes
export interface GauntletResult {
  id: string;
  gauntlet_id: string;
  final_standings: Record<string, number>;
  winner: string;
  completed_at: string;
}
