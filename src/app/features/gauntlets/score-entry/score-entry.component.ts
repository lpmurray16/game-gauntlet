import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GauntletService } from '../../../core/services/gauntlet.service';
import {
  Gauntlet,
  GauntletGame,
  GameResult,
  TournamentMatch,
} from '../../../core/models/gauntlet.model';
import { calculatePoints } from '../../../core/utils/scoring';

@Component({
  selector: 'app-score-entry',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './score-entry.component.html',
  styleUrl: './score-entry.component.scss',
})
export class ScoreEntryComponent implements OnInit {
  // Expose Math for template
  Math = Math;

  gauntlet = signal<Gauntlet | null>(null);
  game = signal<GauntletGame | null>(null);
  loading = signal(true);
  saving = signal(false);
  error = signal('');

  gameId = '';
  scores: Record<string, number> = {};
  winner: Record<string, number> = {};
  allResults: GameResult[] = [];

  // Tournament mode
  matches = signal<TournamentMatch[]>([]);
  tournamentGenerated = signal(false);
  currentMatchIndex = signal(0);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gauntletService: GauntletService,
  ) {}

  async ngOnInit() {
    const gauntletId = this.route.snapshot.paramMap.get('id')!;
    this.gameId = this.route.snapshot.paramMap.get('gameId') ?? '';

    try {
      const [g, games, results] = await Promise.all([
        this.gauntletService.getById(gauntletId),
        this.gauntletService.getGames(gauntletId),
        this.gauntletService.getGameResults(gauntletId),
      ]);
      this.gauntlet.set(g);

      const cfg = games.find((game) => game.id === this.gameId);
      this.game.set(cfg ?? null);

      if (cfg) {
        this.allResults = results;
        const existing = results.find((r) => r.game_id === cfg.id);
        for (const p of g.player_names) {
          this.scores[p] = existing?.scores[p] ?? 0;
          this.winner[p] = existing?.scores[p] ?? 0;
        }

        // Load tournament matches if tournament mode
        if (cfg.tournament_mode || cfg.scoring_mode === 'tournament') {
          const matches = await this.gauntletService.getMatches(gauntletId, cfg.id);
          this.matches.set(matches);
          this.tournamentGenerated.set(matches.length > 0);
        }
      }
    } catch {
      this.error.set('Could not load game data.');
    } finally {
      this.loading.set(false);
    }
  }

  async generateBracket() {
    const g = this.gauntlet();
    const game = this.game();
    if (!g || !game) return;

    this.saving.set(true);
    this.error.set('');
    try {
      const matches = await this.gauntletService.generateTournamentBracket(
        g.id,
        game.id,
        g.player_names,
      );
      this.matches.set(matches);
      this.tournamentGenerated.set(true);
    } catch {
      this.error.set('Failed to generate tournament bracket.');
    } finally {
      this.saving.set(false);
    }
  }

  private advanceQueue: Promise<void> = Promise.resolve();

  async setMatchWinner(match: TournamentMatch, winner: string) {
    // Queue the update to prevent race conditions with concurrent advances
    this.advanceQueue = this.advanceQueue.then(async () => {
      this.saving.set(true);
      this.error.set('');
      try {
        // Update the match with the winner
        await this.gauntletService.updateMatch(match.id, { winner, completed: true });

        // If there's a next match, advance the winner
        if (match.next_match_id) {
          await this.gauntletService.advanceWinner(match.id, winner);
          // Small delay to ensure database consistency
          await new Promise((r) => setTimeout(r, 100));
        }

        // Refresh matches
        const g = this.gauntlet();
        const game = this.game();
        if (g && game) {
          const matches = await this.gauntletService.getMatches(g.id, game.id);
          this.matches.set(matches);
        }
      } catch {
        this.error.set('Failed to set match winner.');
      } finally {
        this.saving.set(false);
      }
    });

    await this.advanceQueue;
  }

  get isWinner() {
    return this.game()?.scoring_mode === 'winner';
  }

  get isHighscore() {
    return this.game()?.scoring_mode === 'highscore';
  }

  get isRank() {
    return this.game()?.scoring_mode === 'rank';
  }

  get isTournament() {
    return this.game()?.scoring_mode === 'tournament' || this.game()?.tournament_mode;
  }

  get currentRound() {
    const matches = this.matches();
    if (matches.length === 0) return 0;
    return Math.max(...matches.map((m) => m.round));
  }

  getMatchesForRound(round: number): TournamentMatch[] {
    return this.matches().filter((m) => m.round === round);
  }

  get pendingMatches(): TournamentMatch[] {
    // Show matches that aren't completed and are ready to be played
    // Round 1: ready when both player1 and player2 are set
    // Subsequent rounds: ready when both source matches have winners
    // Order by round, then match number for sequential play
    return this.matches()
      .filter((m) => {
        if (m.completed) return false;

        // Check if this is a subsequent round match (has source relations)
        const hasSourceMatches = m.source_match_1 || m.source_match_2;

        if (hasSourceMatches) {
          // For subsequent rounds, both source matches must have winners
          const player1 = this.getMatchPlayer(m, 1);
          const player2 = this.getMatchPlayer(m, 2);
          return player1 && player2; // Both players must be ready
        } else {
          // For round 1, at least one player must be present
          return m.player1 || m.player2;
        }
      })
      .sort((a, b) => a.round - b.round || a.match_number - b.match_number);
  }

  get currentMatch(): TournamentMatch | undefined {
    // Get the first pending match (lowest round, lowest match number)
    return this.pendingMatches[0];
  }

  get completedMatchesCount(): number {
    return this.matches().filter((m) => m.completed).length;
  }

  get totalMatchesCount(): number {
    return this.matches().length;
  }

  get roundName(): string {
    const totalRounds = Math.ceil(Math.log2(this.players.length));
    const currentRoundNum = this.currentMatch?.round || 1;
    const roundsFromEnd = totalRounds - currentRoundNum + 1;

    if (roundsFromEnd === 1) return 'Finals';
    if (roundsFromEnd === 2) return 'Semifinals';
    if (roundsFromEnd === 3) return 'Quarterfinals';
    return `Round ${currentRoundNum}`;
  }

  // Get player name for a match, computing from source match winner if needed
  getMatchPlayer(match: TournamentMatch, playerNum: 1 | 2): string {
    // First check if player is directly set
    const directPlayer = playerNum === 1 ? match.player1 : match.player2;
    if (directPlayer) return directPlayer;

    // If not set, look up source match winner from relation
    const sourceMatch =
      playerNum === 1
        ? match.expand?.source_match_1 || match.source_match_1
        : match.expand?.source_match_2 || match.source_match_2;

    if (sourceMatch && typeof sourceMatch === 'object') {
      return sourceMatch.winner || '';
    }

    // If sourceMatch is just an ID string, look it up in the matches array
    if (sourceMatch && typeof sourceMatch === 'string') {
      const found = this.matches().find((m) => m.id === sourceMatch);
      return found?.winner || '';
    }

    return '';
  }

  get matchNumberInRound(): number {
    const match = this.currentMatch;
    if (!match) return 0;
    const roundMatches = this.getMatchesForRound(match.round);
    return roundMatches.findIndex((m) => m.id === match.id) + 1;
  }

  get players(): string[] {
    return this.gauntlet()?.player_names ?? [];
  }

  selectWinner(player: string) {
    for (const p of this.players) {
      this.winner[p] = p === player ? 1 : 0;
    }
  }

  async submit() {
    const g = this.gauntlet();
    const cfg = this.game();
    if (!g || !cfg) return;

    this.saving.set(true);
    this.error.set('');
    try {
      const rawScores = this.isWinner ? { ...this.winner } : { ...this.scores };
      const pointsAwarded = calculatePoints(cfg, rawScores);
      const result: GameResult = {
        gauntlet_id: g.id,
        game_id: cfg.id,
        scores: rawScores,
        points_awarded: pointsAwarded,
        completed: true,
      };
      const saved = await this.gauntletService.saveGameResult(result);
      const updatedResults = [...this.allResults.filter((r) => r.game_id !== cfg.id), saved];
      const points: Record<string, number> = {};
      for (const p of g.player_names) points[p] = 0;
      for (const r of updatedResults) {
        if (!r.completed) continue;
        for (const [player, pts] of Object.entries(r.points_awarded)) {
          points[player] = (points[player] ?? 0) + pts;
        }
      }
      await Promise.all([
        this.gauntletService.upsertGameStatus({
          gauntlet_id: g.id,
          game_id: cfg.id,
          completed: true,
        }),
        this.gauntletService.upsertStandings(g.id, points),
      ]);
      this.router.navigate(['/gauntlets', g.id]);
    } catch {
      this.error.set('Failed to save results.');
    } finally {
      this.saving.set(false);
    }
  }

  getRankPreview(): { player: string; pts: number }[] {
    const cfg = this.game();
    if (!cfg) return [];
    const rawScores = this.isWinner ? { ...this.winner } : { ...this.scores };
    const pts = calculatePoints(cfg, rawScores);
    return Object.entries(pts)
      .map(([player, p]) => ({ player, pts: p }))
      .sort((a, b) => b.pts - a.pts);
  }

  async saveTournamentResults() {
    const g = this.gauntlet();
    const game = this.game();
    if (!g || !game) return;

    this.saving.set(true);
    this.error.set('');
    try {
      // Calculate points based on match wins
      const pointsPerWin = game.points_per_match_win || 3;
      const pointsPerLoss = game.points_per_match_loss || 0;
      const scores: Record<string, number> = {};
      const pointsAwarded: Record<string, number> = {};

      for (const p of g.player_names) {
        scores[p] = 0;
        pointsAwarded[p] = 0;
      }

      // Count wins per player
      for (const match of this.matches()) {
        if (match.completed && match.winner) {
          scores[match.winner] = (scores[match.winner] || 0) + 1;
          pointsAwarded[match.winner] = (pointsAwarded[match.winner] || 0) + pointsPerWin;
        }
      }

      const result: GameResult = {
        gauntlet_id: g.id,
        game_id: game.id,
        scores,
        points_awarded: pointsAwarded,
        completed: true,
      };
      const saved = await this.gauntletService.saveGameResult(result);
      const updatedResults = [...this.allResults.filter((r) => r.game_id !== game.id), saved];
      const standingPoints: Record<string, number> = {};
      for (const p of g.player_names) standingPoints[p] = 0;
      for (const r of updatedResults) {
        if (!r.completed) continue;
        for (const [player, pts] of Object.entries(r.points_awarded)) {
          standingPoints[player] = (standingPoints[player] ?? 0) + pts;
        }
      }
      await Promise.all([
        this.gauntletService.upsertGameStatus({
          gauntlet_id: g.id,
          game_id: game.id,
          completed: true,
        }),
        this.gauntletService.upsertStandings(g.id, standingPoints),
      ]);
      this.router.navigate(['/gauntlets', g.id]);
    } catch {
      this.error.set('Failed to save tournament results.');
    } finally {
      this.saving.set(false);
    }
  }

  async resetTournament() {
    const g = this.gauntlet();
    const game = this.game();
    if (!g || !game) return;

    this.saving.set(true);
    this.error.set('');
    try {
      // Delete all matches for this game
      for (const match of this.matches()) {
        await this.gauntletService.deleteMatch(match.id);
      }

      // Reset state
      this.matches.set([]);
      this.tournamentGenerated.set(false);
      this.currentMatchIndex.set(0);
    } catch {
      this.error.set('Failed to reset tournament.');
    } finally {
      this.saving.set(false);
    }
  }
}
