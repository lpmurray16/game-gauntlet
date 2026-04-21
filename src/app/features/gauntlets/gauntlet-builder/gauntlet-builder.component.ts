import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { GauntletService } from '../../../core/services/gauntlet.service';
import { RawgService } from '../../../core/services/rawg.service';
import { RawgGame } from '../../../core/models/game.model';
import { GauntletGame, ScoringMode } from '../../../core/models/gauntlet.model';

interface GameEntry {
  title: string;
  platform: string;
  cover_url: string;
  genre: string;
  year: number | undefined;
  rawg_id: string;
}

@Component({
  selector: 'app-gauntlet-builder',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './gauntlet-builder.component.html',
  styleUrl: './gauntlet-builder.component.scss',
})
export class GauntletBuilderComponent implements OnInit, OnDestroy {
  step = signal(1);
  saving = signal(false);
  error = signal('');

  name = '';
  playerInputs: string[] = ['', ''];

  addedGames: GameEntry[] = [];
  gameConfigs: GauntletGame[] = [];

  showAddGameForm = false;
  rawgQuery = '';
  rawgResults = signal<RawgGame[]>([]);
  rawgSearching = signal(false);
  showRawgDropdown = signal(false);

  newGame: GameEntry = this.blankGame();

  private rawgSearch$ = new Subject<string>();
  private searchSub?: Subscription;

  constructor(
    private gauntletService: GauntletService,
    private rawgService: RawgService,
    private router: Router,
  ) {}

  ngOnInit() {
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

  goToStep2() {
    if (!this.name.trim()) {
      this.error.set('Enter a gauntlet name.');
      return;
    }
    if (this.validPlayers.length < 2) {
      this.error.set('Add at least 2 players.');
      return;
    }
    this.error.set('');
    this.step.set(2);
  }

  goToStep3() {
    if (this.addedGames.length === 0) {
      this.error.set('Add at least 1 game.');
      return;
    }
    this.error.set('');
    this.gameConfigs = this.addedGames.map((g, i) => ({
      id: '', // Will be set by PocketBase
      gauntlet_id: '', // Will be set after gauntlet creation
      order: i + 1,
      title: g.title,
      platform: g.platform,
      cover_url: g.cover_url || undefined,
      genre: g.genre || undefined,
      year: g.year,
      rawg_id: g.rawg_id || undefined,
      scoring_mode: 'rank' as ScoringMode,
      tournament_mode: false,
      points_for_rank: [10, 6, 3, 1, 1, 1, 1, 1].slice(0, this.validPlayers.length),
      points_for_winner: 10,
      points_for_loser: 0,
      points_per_match_win: 3,
      points_per_match_loss: 0,
      completed: false,
    }));
    this.step.set(3);
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
    this.addedGames.push({ ...this.newGame });
    this.showAddGameForm = false;
  }

  removeGame(i: number) {
    this.addedGames.splice(i, 1);
  }

  updateRankPoints(cfg: GauntletGame, rankIdx: number, val: string) {
    cfg.points_for_rank[rankIdx] = parseInt(val) || 0;
  }

  async save() {
    this.saving.set(true);
    this.error.set('');
    try {
      // Step 1: Create gauntlet (just metadata now)
      const gauntlet = await this.gauntletService.create({
        name: this.name.trim(),
        player_names: this.validPlayers,
      });

      // Step 2: Create each game as a separate record
      for (let i = 0; i < this.gameConfigs.length; i++) {
        const cfg = this.gameConfigs[i];
        await this.gauntletService.createGame({
          ...cfg,
          gauntlet_id: gauntlet.id,
        });
      }

      this.router.navigate(['/gauntlets', gauntlet.id]);
    } catch {
      this.error.set('Failed to create gauntlet. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }

  trackByIndex(index: number) {
    return index;
  }
}
