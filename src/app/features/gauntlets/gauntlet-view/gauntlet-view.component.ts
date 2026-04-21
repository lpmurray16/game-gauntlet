import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { KeyValuePipe } from '@angular/common';
import { GauntletService } from '../../../core/services/gauntlet.service';
import {
  Gauntlet,
  GauntletGame,
  TournamentMatch,
  GameResult,
} from '../../../core/models/gauntlet.model';

@Component({
  selector: 'app-gauntlet-view',
  standalone: true,
  imports: [RouterLink, KeyValuePipe],
  templateUrl: './gauntlet-view.component.html',
  styleUrl: './gauntlet-view.component.scss',
})
export class GauntletViewComponent implements OnInit {
  gauntlet = signal<Gauntlet | null>(null);
  games = signal<GauntletGame[]>([]);
  results = signal<GameResult[]>([]);
  matches = signal<TournamentMatch[]>([]);
  loading = signal(true);
  error = signal('');
  finishing = signal(false);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gauntletService: GauntletService,
  ) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    try {
      const [g, games, results, matches] = await Promise.all([
        this.gauntletService.getById(id),
        this.gauntletService.getGames(id),
        this.gauntletService.getGameResults(id),
        this.gauntletService.getMatches(id),
      ]);
      this.gauntlet.set(g);
      this.games.set(games);
      this.results.set(results);
      this.matches.set(matches);
    } catch {
      this.error.set('Could not load gauntlet.');
    } finally {
      this.loading.set(false);
    }
  }

  get standings() {
    const g = this.gauntlet();
    const games = this.games();
    const results = this.results();
    const matches = this.matches();
    if (!g) return [];

    // Compute standings from results and tournament matches
    const standings: Record<string, number> = {};
    for (const player of g.player_names) {
      standings[player] = 0;
    }

    // Add points from non-tournament results (tournament games are recalculated from matches below)
    const tournamentGameIds = new Set(
      games.filter((g) => g.tournament_mode || g.scoring_mode === 'tournament').map((g) => g.id),
    );
    for (const result of results) {
      // Skip tournament games - their points are calculated from matches below
      if (tournamentGameIds.has(result.game_id)) continue;
      for (const [player, pts] of Object.entries(result.points_awarded)) {
        standings[player] = (standings[player] ?? 0) + pts;
      }
    }

    // Add points from tournament matches (check both tournament_mode flag and scoring_mode)
    const tournamentGames = games.filter(
      (g) => g.tournament_mode || g.scoring_mode === 'tournament',
    );
    for (const game of tournamentGames) {
      const gameMatches = matches.filter((m) => m.game_id === game.id && m.completed);
      for (const match of gameMatches) {
        if (match.winner) {
          standings[match.winner] = (standings[match.winner] ?? 0) + game.points_per_match_win;
        }
        const loser = match.player1 === match.winner ? match.player2 : match.player1;
        if (loser) {
          standings[loser] = (standings[loser] ?? 0) + game.points_per_match_loss;
        }
      }
    }

    return Object.entries(standings).sort((a, b) => b[1] - a[1]);
  }

  getResult(gameId: string): GameResult | undefined {
    return this.results().find((r) => r.game_id === gameId);
  }

  getGame(gameId: string): GauntletGame | undefined {
    return this.games().find((g) => g.id === gameId);
  }

  getGameMatches(gameId: string): TournamentMatch[] {
    return this.matches().filter((m) => m.game_id === gameId);
  }

  async startGauntlet() {
    const g = this.gauntlet();
    if (!g) return;
    const updated = await this.gauntletService.updateStatus(g.id, 'active');
    this.gauntlet.set(updated);
  }

  async finishGauntlet() {
    const g = this.gauntlet();
    if (!g) return;
    if (!confirm('Finish this gauntlet and record the final results?')) return;
    this.finishing.set(true);
    try {
      const result = await this.gauntletService.finalize(
        g,
        this.games(),
        this.results(),
        this.matches(),
      );
      this.router.navigate(['/gauntlets', g.id, 'results']);
    } catch {
      this.error.set('Failed to finalize gauntlet.');
    } finally {
      this.finishing.set(false);
    }
  }

  get allGamesComplete(): boolean {
    const g = this.gauntlet();
    const games = this.games();
    if (!g || games.length === 0) return false;

    return games.every((game) => {
      if (game.tournament_mode || game.scoring_mode === 'tournament') {
        // For tournament games, check if all matches are completed
        const gameMatches = this.matches().filter((m) => m.game_id === game.id);
        return gameMatches.length > 0 && gameMatches.every((m) => m.completed);
      } else {
        // For regular games, check if result is completed
        const r = this.getResult(game.id);
        return r?.completed;
      }
    });
  }

  scoringLabel(mode: string): string {
    switch (mode) {
      case 'winner':
        return 'Who Won';
      case 'rank':
        return 'Ranked';
      case 'highscore':
        return 'High Score';
      case 'tournament':
        return 'Tournament';
      default:
        return mode;
    }
  }
}
