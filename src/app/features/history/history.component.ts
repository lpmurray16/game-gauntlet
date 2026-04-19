import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { GauntletService } from '../../core/services/gauntlet.service';
import { Gauntlet, GauntletResult } from '../../core/models/gauntlet.model';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent implements OnInit {
  results = signal<GauntletResult[]>([]);
  gauntlets = signal<Gauntlet[]>([]);
  loading = signal(true);
  error = signal('');
  expanded = signal<string | null>(null);

  constructor(private gauntletService: GauntletService) {}

  async ngOnInit() {
    try {
      const [results, gauntlets] = await Promise.all([
        this.gauntletService.getResults(),
        this.gauntletService.getAll(),
      ]);
      this.results.set(results);
      this.gauntlets.set(gauntlets);
    } catch {
      this.error.set('Could not load history. Is PocketBase running?');
    } finally {
      this.loading.set(false);
    }
  }

  toggleExpand(id: string) {
    this.expanded.set(this.expanded() === id ? null : id);
  }

  getStandings(result: GauntletResult): { player: string; pts: number }[] {
    return Object.entries(result.final_standings)
      .map(([player, pts]) => ({ player, pts }))
      .sort((a, b) => b.pts - a.pts);
  }

  getGauntletName(result: GauntletResult): string {
    return (
      this.gauntlets().find((g) => g.id === result.gauntlet_id)?.name ??
      `Gauntlet ${result.gauntlet_id}`
    );
  }

  getPlayerCount(result: GauntletResult): number {
    return Object.keys(result.final_standings).length;
  }
}
