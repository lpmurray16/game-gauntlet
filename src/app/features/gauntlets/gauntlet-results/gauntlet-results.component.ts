import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GauntletService } from '../../../core/services/gauntlet.service';
import { GauntletResult, Gauntlet, GameResult } from '../../../core/models/gauntlet.model';

@Component({
  selector: 'app-gauntlet-results',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './gauntlet-results.component.html',
  styleUrl: './gauntlet-results.component.scss',
})
export class GauntletResultsComponent implements OnInit {
  result = signal<GauntletResult | null>(null);
  gauntlet = signal<Gauntlet | null>(null);
  gameResults = signal<GameResult[]>([]);
  loading = signal(true);
  error = signal('');

  constructor(
    private route: ActivatedRoute,
    private gauntletService: GauntletService,
  ) {}

  async ngOnInit() {
    const gauntletId = this.route.snapshot.paramMap.get('id')!;
    try {
      const [g, res, results] = await Promise.all([
        this.gauntletService.getById(gauntletId),
        this.gauntletService.getResultByGauntletId(gauntletId),
        this.gauntletService.getGameResults(gauntletId),
      ]);
      this.gauntlet.set(g);
      this.result.set(res);
      this.gameResults.set(results);
    } catch {
      this.error.set('Could not load results.');
    } finally {
      this.loading.set(false);
    }
  }

  get standings(): { player: string; pts: number }[] {
    const r = this.result();
    if (!r) return [];
    return Object.entries(r.final_standings)
      .map(([player, pts]) => ({ player, pts }))
      .sort((a, b) => b.pts - a.pts);
  }

  getGameResult(gameId: string): GameResult | undefined {
    return this.gameResults().find((r) => r.game_id === gameId);
  }

  getMedalEmoji(rank: number): string {
    if (rank === 0) return '🥇';
    if (rank === 1) return '🥈';
    if (rank === 2) return '🥉';
    return `${rank + 1}`;
  }
}
