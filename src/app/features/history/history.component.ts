import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { GauntletService } from '../../core/services/gauntlet.service';
import { GauntletResult } from '../../core/models/gauntlet.model';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss'
})
export class HistoryComponent implements OnInit {
  results = signal<GauntletResult[]>([]);
  loading = signal(true);
  error = signal('');
  expanded = signal<string | null>(null);

  constructor(private gauntletService: GauntletService) {}

  async ngOnInit() {
    try {
      const all = await this.gauntletService.getResults();
      this.results.set(all);
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
    return result.expand?.gauntlet_id?.name ?? `Gauntlet ${result.gauntlet_id}`;
  }

  getPlayerCount(result: GauntletResult): number {
    return Object.keys(result.final_standings).length;
  }
}
