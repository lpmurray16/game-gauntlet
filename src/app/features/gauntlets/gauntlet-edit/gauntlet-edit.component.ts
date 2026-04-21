import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { GauntletService } from '../../../core/services/gauntlet.service';
import { RawgService } from '../../../core/services/rawg.service';
import { RawgGame } from '../../../core/models/game.model';
import { Gauntlet, GauntletGame, ScoringMode } from '../../../core/models/gauntlet.model';

interface GameEntry {
  title: string;
  platform: string;
  cover_url: string;
  genre: string;
  year: number | undefined;
  rawg_id: string;
}

@Component({
  selector: 'app-gauntlet-edit',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './gauntlet-edit.component.html',
  styleUrl: './gauntlet-edit.component.scss',
})
export class GauntletEditComponent implements OnInit, OnDestroy {
  gauntlet = signal<Gauntlet | null>(null);
  loading = signal(true);
  saving = signal(false);
  error = signal('');

  name = '';
  playerInputs: string[] = [];
  games: GauntletGame[] = [];
  originalGames: GauntletGame[] = []; // Track existing games

  showAddGameForm = false;
  rawgQuery = '';
  rawgResults = signal<RawgGame[]>([]);
  rawgSearching = signal(false);
  showRawgDropdown = signal(false);
  newGame: GameEntry = this.blankGame();

  private rawgSearch$ = new Subject<string>();
  private searchSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gauntletService: GauntletService,
    private rawgService: RawgService,
  ) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    try {
      const [g, games] = await Promise.all([
        this.gauntletService.getById(id),
        this.gauntletService.getGames(id),
      ]);
      this.gauntlet.set(g);
      this.name = g.name;
      this.playerInputs = [...g.player_names];
      this.games = games.map((game) => ({ ...game, points_for_rank: [...game.points_for_rank] }));
      this.originalGames = [...this.games];
    } catch {
      this.error.set('Could not load gauntlet.');
    } finally {
      this.loading.set(false);
    }

    this.searchSub = this.rawgSearch$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((q) => {
          if (q.length < 2) {
            this.rawgResults.set([]);
            this.rawgSearching.set(false);
            return [];
          }
          this.rawgSearching.set(true);
          return this.rawgService.search(q);
        }),
      )
      .subscribe({
        next: (results) => {
          this.rawgResults.set(results);
          this.showRawgDropdown.set(results.length > 0);
          this.rawgSearching.set(false);
        },
        error: () => this.rawgSearching.set(false),
      });
  }

  ngOnDestroy() {
    this.searchSub?.unsubscribe();
  }

  blankGame(): GameEntry {
    return { title: '', platform: '', cover_url: '', genre: '', year: undefined, rawg_id: '' };
  }

  get validPlayers() {
    return this.playerInputs.filter((p) => p.trim().length > 0);
  }

  addPlayer() {
    if (this.playerInputs.length < 8) this.playerInputs.push('');
  }

  removePlayer(i: number) {
    if (this.playerInputs.length > 2) this.playerInputs.splice(i, 1);
  }

  hasResult(gameId: string): boolean {
    // Games with tournament_mode=false need results; games with tournament_mode=true need matches
    const game = this.games.find((g) => g.id === gameId);
    if (!game) return false;
    if (game.tournament_mode) {
      return game.completed; // Tournament games marked completed at game level
    }
    return game.completed; // Regular games marked completed when result saved
  }

  removeGame(i: number) {
    this.games.splice(i, 1);
  }

  openAddGame() {
    this.newGame = this.blankGame();
    this.rawgQuery = '';
    this.rawgResults.set([]);
    this.showRawgDropdown.set(false);
    this.showAddGameForm = true;
  }

  onRawgSearch() {
    this.rawgSearch$.next(this.rawgQuery.trim());
  }

  selectRawgGame(rg: RawgGame) {
    this.newGame.title = rg.name;
    this.newGame.rawg_id = String(rg.id);
    this.newGame.cover_url = rg.background_image || '';
    this.newGame.year = rg.released ? parseInt(rg.released.substring(0, 4)) : undefined;
    this.newGame.genre = rg.genres?.[0]?.name || '';
    this.newGame.platform = rg.platforms?.[0]?.platform?.name || '';
    this.rawgQuery = rg.name;
    this.showRawgDropdown.set(false);
  }

  confirmAddGame() {
    if (!this.newGame.title.trim()) {
      this.error.set('Game title is required.');
      return;
    }
    this.error.set('');
    const i = this.games.length;
    this.games.push({
      id: '', // New game, no ID yet
      gauntlet_id: this.gauntlet()!.id,
      order: i + 1,
      title: this.newGame.title,
      platform: this.newGame.platform,
      cover_url: this.newGame.cover_url || undefined,
      genre: this.newGame.genre || undefined,
      year: this.newGame.year,
      rawg_id: this.newGame.rawg_id || undefined,
      scoring_mode: 'rank' as ScoringMode,
      tournament_mode: false,
      points_for_rank: [10, 6, 3, 1, 1, 1, 1, 1].slice(0, this.validPlayers.length),
      points_for_winner: 10,
      points_for_loser: 0,
      points_per_match_win: 3,
      points_per_match_loss: 0,
      completed: false,
    });
    this.showAddGameForm = false;
  }

  updateRankPoints(cfg: GauntletGame, rankIdx: number, val: string) {
    cfg.points_for_rank[rankIdx] = parseInt(val) || 0;
  }

  trackByIndex(index: number) {
    return index;
  }

  async save() {
    if (!this.name.trim()) {
      this.error.set('Gauntlet name is required.');
      return;
    }
    if (this.validPlayers.length < 2) {
      this.error.set('At least 2 players required.');
      return;
    }
    if (this.games.length === 0) {
      this.error.set('At least 1 game required.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    try {
      const gauntletId = this.gauntlet()!.id;

      // Update gauntlet metadata
      await this.gauntletService.updateGauntlet(gauntletId, {
        name: this.name.trim(),
        player_names: this.validPlayers,
      });

      // Handle games: update existing, create new
      for (let i = 0; i < this.games.length; i++) {
        const game = this.games[i];
        game.order = i + 1; // Reassign orders

        if (game.id) {
          // Update existing game
          await this.gauntletService.updateGame(game.id, game);
        } else {
          // Create new game
          await this.gauntletService.createGame({
            ...game,
            gauntlet_id: gauntletId,
          });
        }
      }

      // Handle deleted games (in originalGames but not in games)
      for (const original of this.originalGames) {
        if (original.id && !this.games.find((g) => g.id === original.id)) {
          await this.gauntletService.deleteGame(original.id);
        }
      }

      this.router.navigate(['/gauntlets', gauntletId]);
    } catch {
      this.error.set('Failed to save changes.');
    } finally {
      this.saving.set(false);
    }
  }
}
