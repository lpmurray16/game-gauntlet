import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameService } from '../../../core/services/game.service';
import { Game } from '../../../core/models/game.model';

@Component({
  selector: 'app-games-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './games-list.component.html',
  styleUrl: './games-list.component.scss'
})
export class GamesListComponent implements OnInit {
  games = signal<Game[]>([]);
  loading = signal(true);
  error = signal('');
  searchQuery = signal('');

  constructor(private gameService: GameService) {}

  async ngOnInit() {
    await this.load();
  }

  async load() {
    try {
      this.loading.set(true);
      const all = await this.gameService.getAll();
      this.games.set(all);
    } catch {
      this.error.set('Could not load games. Is PocketBase running?');
    } finally {
      this.loading.set(false);
    }
  }

  get filteredGames() {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.games();
    return this.games().filter(g =>
      g.title.toLowerCase().includes(q) ||
      g.platform?.toLowerCase().includes(q) ||
      g.genre?.toLowerCase().includes(q)
    );
  }

  onSearch(event: Event) {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  async deleteGame(id: string, event: Event) {
    event.preventDefault();
    if (!confirm('Delete this game from the library?')) return;
    await this.gameService.delete(id);
    await this.load();
  }
}
