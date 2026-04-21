import { Injectable } from '@angular/core';
import { PocketBaseService } from './pocketbase.service';
import {
  Gauntlet,
  GauntletGame,
  TournamentMatch,
  GauntletResult,
  GameResult,
  ScoringMode,
} from '../models/gauntlet.model';

@Injectable({ providedIn: 'root' })
export class GauntletService {
  private col = 'gauntlets';
  private gamesCol = 'gauntlet_games';
  private matchesCol = 'tournament_matches';
  private gameResultsCol = 'gauntlet_game_results';
  private resultCol = 'gauntlet_results';

  constructor(private pbs: PocketBaseService) {}

  // ==================== Gauntlets ====================

  async getAll(): Promise<Gauntlet[]> {
    const result = await this.pbs.pb.collection(this.col).getList(1, 200, { sort: '-created' });
    return result.items.map((r) => this.deserializeGauntlet(r));
  }

  async getById(id: string): Promise<Gauntlet> {
    const record = await this.pbs.pb.collection(this.col).getOne(id);
    return this.deserializeGauntlet(record);
  }

  async create(data: { name: string; player_names: string[] }): Promise<Gauntlet> {
    const record = await this.pbs.pb.collection(this.col).create({
      name: data.name,
      player_names: JSON.stringify(data.player_names),
      status: 'draft',
    });
    return this.deserializeGauntlet(record);
  }

  async updateGauntlet(
    id: string,
    data: {
      name: string;
      player_names: string[];
    },
  ): Promise<Gauntlet> {
    const record = await this.pbs.pb.collection(this.col).update(id, {
      name: data.name,
      player_names: JSON.stringify(data.player_names),
    });
    return this.deserializeGauntlet(record);
  }

  async updateStatus(id: string, status: 'draft' | 'active' | 'completed'): Promise<Gauntlet> {
    const record = await this.pbs.pb.collection(this.col).update(id, { status });
    return this.deserializeGauntlet(record);
  }

  // ==================== Games ====================

  async getGames(gauntletId: string): Promise<GauntletGame[]> {
    const result = await this.pbs.pb.collection(this.gamesCol).getFullList({
      filter: `gauntlet_id="${gauntletId}"`,
      sort: 'order',
    });
    return result.map((r) => this.deserializeGame(r));
  }

  async createGame(data: Omit<GauntletGame, 'id'>): Promise<GauntletGame> {
    const record = await this.pbs.pb.collection(this.gamesCol).create({
      gauntlet_id: data.gauntlet_id,
      order: data.order,
      title: data.title,
      platform: data.platform,
      cover_url: data.cover_url || '',
      genre: data.genre || '',
      year: data.year || null,
      rawg_id: data.rawg_id || '',
      scoring_mode: data.scoring_mode,
      tournament_mode: data.tournament_mode,
      points_for_rank: JSON.stringify(data.points_for_rank || []),
      points_for_winner: data.points_for_winner || 0,
      points_for_loser: data.points_for_loser || 0,
      points_per_match_win: data.points_per_match_win || 3,
      points_per_match_loss: data.points_per_match_loss || 0,
      completed: false,
    });
    return this.deserializeGame(record);
  }

  async updateGame(id: string, data: Partial<GauntletGame>): Promise<GauntletGame> {
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.platform !== undefined) updateData.platform = data.platform;
    if (data.cover_url !== undefined) updateData.cover_url = data.cover_url;
    if (data.genre !== undefined) updateData.genre = data.genre;
    if (data.year !== undefined) updateData.year = data.year;
    if (data.rawg_id !== undefined) updateData.rawg_id = data.rawg_id;
    if (data.scoring_mode !== undefined) updateData.scoring_mode = data.scoring_mode;
    if (data.tournament_mode !== undefined) updateData.tournament_mode = data.tournament_mode;
    if (data.points_for_rank !== undefined)
      updateData.points_for_rank = JSON.stringify(data.points_for_rank);
    if (data.points_for_winner !== undefined) updateData.points_for_winner = data.points_for_winner;
    if (data.points_for_loser !== undefined) updateData.points_for_loser = data.points_for_loser;
    if (data.points_per_match_win !== undefined)
      updateData.points_per_match_win = data.points_per_match_win;
    if (data.points_per_match_loss !== undefined)
      updateData.points_per_match_loss = data.points_per_match_loss;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.completed !== undefined) updateData.completed = data.completed;

    const record = await this.pbs.pb.collection(this.gamesCol).update(id, updateData);
    return this.deserializeGame(record);
  }

  async deleteGame(id: string): Promise<void> {
    await this.pbs.pb.collection(this.gamesCol).delete(id);
  }

  // ==================== Tournament Matches ====================

  async getMatches(gauntletId: string, gameId?: string): Promise<TournamentMatch[]> {
    let filter = `gauntlet_id="${gauntletId}"`;
    if (gameId) filter += ` && game_id="${gameId}"`;
    const result = await this.pbs.pb.collection(this.matchesCol).getFullList({
      filter,
      sort: 'round,match_number',
      expand: 'source_match_1,source_match_2',
    });
    return result.map((r) => this.deserializeMatch(r));
  }

  async createMatch(data: Omit<TournamentMatch, 'id'>): Promise<TournamentMatch> {
    const recordData: any = {
      gauntlet_id: data.gauntlet_id,
      game_id: data.game_id,
      round: data.round,
      match_number: data.match_number,
      player1: data.player1 || '',
      player2: data.player2 || '',
      winner: data.winner || '',
      completed: data.completed || false,
      next_match_id: data.next_match_id || '',
    };
    // Add relation fields if provided
    if (data.source_match_1) recordData.source_match_1 = data.source_match_1;
    if (data.source_match_2) recordData.source_match_2 = data.source_match_2;

    const record = await this.pbs.pb.collection(this.matchesCol).create(recordData);
    return this.deserializeMatch(record);
  }

  async updateMatch(id: string, data: Partial<TournamentMatch>): Promise<TournamentMatch> {
    const updateData: any = {};
    if (data.winner !== undefined) updateData.winner = data.winner;
    if (data.completed !== undefined) updateData.completed = data.completed;
    if (data.next_match_id !== undefined) updateData.next_match_id = data.next_match_id;
    if (data.player1 !== undefined) updateData.player1 = data.player1;
    if (data.player2 !== undefined) updateData.player2 = data.player2;

    const record = await this.pbs.pb.collection(this.matchesCol).update(id, updateData);
    return this.deserializeMatch(record);
  }

  async deleteMatch(id: string): Promise<void> {
    await this.pbs.pb.collection(this.matchesCol).delete(id);
  }

  // Generate single-elimination bracket for a game
  async generateTournamentBracket(
    gauntletId: string,
    gameId: string,
    players: string[],
  ): Promise<TournamentMatch[]> {
    // Shuffle players for random seeding
    const shuffled = [...players].sort(() => Math.random() - 0.5);

    // Calculate rounds needed
    const numPlayers = shuffled.length;
    const rounds = Math.ceil(Math.log2(numPlayers));
    const byes = Math.pow(2, rounds) - numPlayers;

    const matches: TournamentMatch[] = [];
    const matchMap = new Map<string, string>(); // round,match_num -> match_id

    // Round 1: Create matches with byes
    let matchNumber = 1;
    let playerIdx = 0;

    for (let i = 0; i < Math.pow(2, rounds - 1); i++) {
      const player1 = shuffled[playerIdx++] || 'BYE';
      const player2 = i < byes ? 'BYE' : shuffled[playerIdx++] || 'BYE';

      // Handle byes - auto-advance to next round
      const hasBye = player1 === 'BYE' || player2 === 'BYE';

      const match = await this.createMatch({
        gauntlet_id: gauntletId,
        game_id: gameId,
        round: 1,
        match_number: matchNumber,
        player1: player1 === 'BYE' ? '' : player1,
        player2: player2 === 'BYE' ? '' : player2,
        winner: hasBye ? (player1 === 'BYE' ? player2 : player1) : undefined,
        completed: hasBye,
      });

      matches.push(match);
      matchMap.set(`1,${matchNumber}`, match.id);
      matchNumber++;
    }

    // Subsequent rounds
    for (let round = 2; round <= rounds; round++) {
      const matchesInRound = Math.pow(2, rounds - round);
      for (let i = 1; i <= matchesInRound; i++) {
        const prevMatch1 = matchMap.get(`${round - 1},${i * 2 - 1}`);
        const prevMatch2 = matchMap.get(`${round - 1},${i * 2}`);

        const match = await this.createMatch({
          gauntlet_id: gauntletId,
          game_id: gameId,
          round,
          match_number: i,
          player1: '', // Will be computed from source match winner
          player2: '', // Will be computed from source match winner
          completed: false,
          source_match_1: prevMatch1,
          source_match_2: prevMatch2,
        });

        matches.push(match);
        matchMap.set(`${round},${i}`, match.id);

        // Update previous matches to point to this match
        if (prevMatch1) await this.updateMatch(prevMatch1, { next_match_id: match.id });
        if (prevMatch2) await this.updateMatch(prevMatch2, { next_match_id: match.id });
      }
    }

    return matches;
  }

  // Advance winner to next match
  // Note: player1/player2 are now computed dynamically in the UI from source match winners
  // to avoid race conditions when multiple matches advance simultaneously
  async advanceWinner(matchId: string, winner: string): Promise<void> {
    // This method is kept for compatibility but no longer updates player fields
    // The UI will compute players dynamically using source_match_1_id and source_match_2_id
  }

  // ==================== Game Results ====================

  async getGameResults(gauntletId: string): Promise<GameResult[]> {
    const result = await this.pbs.pb.collection(this.gameResultsCol).getFullList({
      filter: `gauntlet_id="${gauntletId}"`,
    });
    return result.map((r) => this.deserializeGameResult(r));
  }

  async saveGameResult(result: GameResult): Promise<GameResult> {
    // Check if result already exists
    const existing = await this.pbs.pb.collection(this.gameResultsCol).getFullList({
      filter: `gauntlet_id="${result.gauntlet_id}" && game_id="${result.game_id}"`,
    });

    if (existing.length > 0) {
      // Update existing
      const record = await this.pbs.pb.collection(this.gameResultsCol).update(existing[0].id, {
        scores: JSON.stringify(result.scores),
        points_awarded: JSON.stringify(result.points_awarded),
        completed: result.completed,
      });
      return this.deserializeGameResult(record);
    } else {
      // Create new
      const record = await this.pbs.pb.collection(this.gameResultsCol).create({
        gauntlet_id: result.gauntlet_id,
        game_id: result.game_id,
        scores: JSON.stringify(result.scores),
        points_awarded: JSON.stringify(result.points_awarded),
        completed: result.completed,
      });
      return this.deserializeGameResult(record);
    }
  }

  // ==================== Finalize ====================

  async finalize(
    gauntlet: Gauntlet,
    games: GauntletGame[],
    results: GameResult[],
    matches: TournamentMatch[],
  ): Promise<GauntletResult> {
    const standings: Record<string, number> = {};
    for (const player of gauntlet.player_names) {
      standings[player] = 0;
    }

    // Add points from non-tournament game results
    for (const result of results) {
      for (const [player, pts] of Object.entries(result.points_awarded)) {
        standings[player] = (standings[player] ?? 0) + pts;
      }
    }

    // Add points from tournament matches
    const tournamentGames = games.filter((g) => g.tournament_mode);
    for (const game of tournamentGames) {
      const gameMatches = matches.filter((m) => m.game_id === game.id && m.completed);
      for (const match of gameMatches) {
        if (match.winner) {
          standings[match.winner] = (standings[match.winner] ?? 0) + game.points_per_match_win;
        }
        // Both players get participation points (or loser gets loss points)
        const loser = match.player1 === match.winner ? match.player2 : match.player1;
        if (loser) {
          standings[loser] = (standings[loser] ?? 0) + game.points_per_match_loss;
        }
      }
    }

    await this.pbs.pb.collection(this.col).update(gauntlet.id, { status: 'completed' });

    const winner = Object.entries(standings).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    const resultRecord = await this.pbs.pb.collection(this.resultCol).create({
      gauntlet_id: gauntlet.id,
      final_standings: JSON.stringify(standings),
      winner,
      completed_at: new Date().toISOString(),
    });
    return this.deserializeGauntletResult(resultRecord);
  }

  async getResults(): Promise<GauntletResult[]> {
    const result = await this.pbs.pb.collection(this.resultCol).getList(1, 200, {
      sort: '-completed_at',
    });
    return result.items.map((r) => this.deserializeGauntletResult(r));
  }

  async getResultByGauntletId(gauntletId: string): Promise<GauntletResult | null> {
    try {
      const records = await this.pbs.pb.collection(this.resultCol).getList(1, 1, {
        filter: `gauntlet_id="${gauntletId}"`,
      });
      return records.items.length ? this.deserializeGauntletResult(records.items[0]) : null;
    } catch {
      return null;
    }
  }

  // ==================== Deserializers ====================

  private deserializeGauntlet(r: any): Gauntlet {
    return {
      id: r.id,
      name: r.name,
      status: r.status || 'draft',
      player_names: this.parseJson(r.player_names, []),
      created: r.created,
      updated: r.updated,
    };
  }

  private deserializeGame(r: any): GauntletGame {
    return {
      id: r.id,
      gauntlet_id: r.gauntlet_id,
      order: r.order,
      title: r.title,
      platform: r.platform || '',
      cover_url: r.cover_url || undefined,
      genre: r.genre || undefined,
      year: r.year || undefined,
      rawg_id: r.rawg_id || undefined,
      scoring_mode: r.scoring_mode as ScoringMode,
      tournament_mode: r.tournament_mode || false,
      points_for_rank: this.parseJson(r.points_for_rank, []),
      points_for_winner: r.points_for_winner || 0,
      points_for_loser: r.points_for_loser || 0,
      points_per_match_win: r.points_per_match_win || 3,
      points_per_match_loss: r.points_per_match_loss || 0,
      completed: r.completed || false,
    };
  }

  private deserializeMatch(r: any): TournamentMatch {
    return {
      id: r.id,
      gauntlet_id: r.gauntlet_id,
      game_id: r.game_id,
      round: r.round,
      match_number: r.match_number,
      player1: r.player1,
      player2: r.player2,
      winner: r.winner || undefined,
      completed: r.completed || false,
      next_match_id: r.next_match_id || undefined,
      source_match_1: r.source_match_1 || undefined,
      source_match_2: r.source_match_2 || undefined,
      expand: r.expand || undefined,
    };
  }

  private deserializeGameResult(r: any): GameResult {
    return {
      id: r.id,
      gauntlet_id: r.gauntlet_id,
      game_id: r.game_id,
      scores: this.parseJson(r.scores, {}),
      points_awarded: this.parseJson(r.points_awarded, {}),
      completed: r.completed || false,
    };
  }

  private deserializeGauntletResult(r: any): GauntletResult {
    return {
      id: r.id,
      gauntlet_id: r.gauntlet_id,
      final_standings: this.parseJson(r.final_standings, {}),
      winner: r.winner,
      completed_at: r.completed_at,
    };
  }

  private parseJson(val: any, fallback: any): any {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return fallback;
      }
    }
    return val ?? fallback;
  }
}
