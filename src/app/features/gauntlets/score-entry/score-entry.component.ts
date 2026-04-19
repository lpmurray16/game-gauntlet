import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GauntletService } from '../../../core/services/gauntlet.service';
import { Gauntlet, GameConfig, GameResult } from '../../../core/models/gauntlet.model';
import { calculatePoints } from '../../../core/utils/scoring';

@Component({
  selector: 'app-score-entry',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './score-entry.component.html',
  styleUrl: './score-entry.component.scss',
})
export class ScoreEntryComponent implements OnInit {
  gauntlet = signal<Gauntlet | null>(null);
  config = signal<GameConfig | null>(null);
  loading = signal(true);
  saving = signal(false);
  error = signal('');

  gameIndex = 0;
  scores: Record<string, number> = {};
  winner: Record<string, number> = {};

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gauntletService: GauntletService,
  ) {}

  async ngOnInit() {
    const gauntletId = this.route.snapshot.paramMap.get('id')!;
    this.gameIndex = parseInt(this.route.snapshot.paramMap.get('gameIndex') ?? '0');

    try {
      const g = await this.gauntletService.getById(gauntletId);
      this.gauntlet.set(g);

      const cfg = g.game_configs[this.gameIndex];
      this.config.set(cfg ?? null);

      if (cfg) {
        const existing = g.game_results.find((r) => r.game_id === cfg.game_id);
        for (const p of g.player_names) {
          this.scores[p] = existing?.scores[p] ?? 0;
          this.winner[p] = existing?.scores[p] ?? 0;
        }
      }
    } catch {
      this.error.set('Could not load game data.');
    } finally {
      this.loading.set(false);
    }
  }

  get isWinner() {
    return this.config()?.scoring_mode === 'winner';
  }

  get isHighscore() {
    return this.config()?.scoring_mode === 'highscore';
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
    const cfg = this.config();
    if (!g || !cfg) return;

    this.saving.set(true);
    this.error.set('');
    try {
      const rawScores = this.isWinner ? { ...this.winner } : { ...this.scores };
      const pointsAwarded = calculatePoints(cfg, rawScores);
      const result: GameResult = {
        game_id: cfg.game_id,
        scores: rawScores,
        points_awarded: pointsAwarded,
        completed: true,
      };
      const updated = await this.gauntletService.saveGameResult(g.id, g, result);
      this.gauntlet.set(updated);
      this.router.navigate(['/gauntlets', g.id]);
    } catch {
      this.error.set('Failed to save results.');
    } finally {
      this.saving.set(false);
    }
  }

  getRankPreview(): { player: string; pts: number }[] {
    const cfg = this.config();
    if (!cfg) return [];
    const rawScores = this.isWinner ? { ...this.winner } : { ...this.scores };
    const pts = calculatePoints(cfg, rawScores);
    return Object.entries(pts)
      .map(([player, p]) => ({ player, pts: p }))
      .sort((a, b) => b.pts - a.pts);
  }
}
