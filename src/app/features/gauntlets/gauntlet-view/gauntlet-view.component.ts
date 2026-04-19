import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { KeyValuePipe } from '@angular/common';
import { GauntletService } from '../../../core/services/gauntlet.service';
import { Gauntlet, GameConfig, GameResult } from '../../../core/models/gauntlet.model';
import { computeStandings } from '../../../core/utils/scoring';

@Component({
  selector: 'app-gauntlet-view',
  standalone: true,
  imports: [RouterLink, KeyValuePipe],
  templateUrl: './gauntlet-view.component.html',
  styleUrl: './gauntlet-view.component.scss',
})
export class GauntletViewComponent implements OnInit {
  gauntlet = signal<Gauntlet | null>(null);
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
      const g = await this.gauntletService.getById(id);
      this.gauntlet.set(g);
    } catch {
      this.error.set('Could not load gauntlet.');
    } finally {
      this.loading.set(false);
    }
  }

  get standings() {
    const g = this.gauntlet();
    if (!g) return [];
    const s = computeStandings(g.player_names, g.game_results);
    return Object.entries(s).sort((a, b) => b[1] - a[1]);
  }

  getResult(gameId: string): GameResult | undefined {
    return this.gauntlet()?.game_results.find((r) => r.game_id === gameId);
  }

  getConfig(gameId: string): GameConfig | undefined {
    return this.gauntlet()?.game_configs.find((c) => c.game_id === gameId);
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
      const result = await this.gauntletService.finalize(g);
      this.router.navigate(['/gauntlets', g.id, 'results']);
    } catch {
      this.error.set('Failed to finalize gauntlet.');
    } finally {
      this.finishing.set(false);
    }
  }

  get allGamesComplete(): boolean {
    const g = this.gauntlet();
    if (!g) return false;
    return g.game_configs.every((cfg) => {
      const r = this.getResult(cfg.game_id);
      return r?.completed;
    });
  }

  scoringLabel(mode: string): string {
    switch (mode) {
      case 'match':
        return 'Match';
      case 'rank':
        return 'Rank';
      case 'normalized':
        return 'Normalized';
      default:
        return mode;
    }
  }
}
