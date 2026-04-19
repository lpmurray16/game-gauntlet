import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';
import { GameService } from '../../../core/services/game.service';
import { RawgService } from '../../../core/services/rawg.service';
import { Game, RawgGame } from '../../../core/models/game.model';

@Component({
  selector: 'app-game-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './game-form.component.html',
  styleUrl: './game-form.component.scss',
})
export class GameFormComponent implements OnInit {
  isEdit = false;
  gameId = '';
  saving = signal(false);
  error = signal('');
  rawgResults = signal<RawgGame[]>([]);
  rawgLoading = signal(false);
  showDropdown = signal(false);

  private rawgSearch$ = new Subject<string>();

  form: Partial<Game> = {
    title: '',
    platform: '',
    genre: '',
    year: undefined,
    cover_url: '',
    rawg_id: '',
    notes: '',
  };

  constructor(
    private gameService: GameService,
    private rawgService: RawgService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    this.gameId = this.route.snapshot.paramMap.get('id') ?? '';
    this.isEdit = !!this.gameId;

    if (this.isEdit) {
      this.gameService.getById(this.gameId).then((g) => {
        this.form = { ...g };
      });
    }

    this.rawgSearch$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((q) => {
          this.rawgLoading.set(true);
          return this.rawgService.searchRaw(q);
        }),
      )
      .subscribe({
        next: (res) => {
          this.rawgResults.set(res.results ?? []);
          this.rawgLoading.set(false);
          this.showDropdown.set(true);
        },
        error: () => {
          this.rawgLoading.set(false);
        },
      });
  }

  onRawgInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    if (val.length >= 2) {
      this.rawgSearch$.next(val);
    } else {
      this.rawgResults.set([]);
      this.showDropdown.set(false);
    }
  }

  selectRawgGame(rg: RawgGame) {
    this.form.title = rg.name;
    this.form.rawg_id = String(rg.id);
    this.form.cover_url = rg.background_image ?? '';
    this.form.genre = rg.genres?.[0]?.name ?? '';
    this.form.year = rg.released ? parseInt(rg.released.substring(0, 4)) : undefined;
    const platforms = rg.platforms?.map((p) => p.platform.name).join(', ') ?? '';
    this.form.platform = platforms;
    this.showDropdown.set(false);
    this.rawgResults.set([]);
  }

  closeDropdown() {
    setTimeout(() => this.showDropdown.set(false), 200);
  }

  async save() {
    if (!this.form.title?.trim()) {
      this.error.set('Title is required.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      const data = {
        title: this.form.title!,
        platform: this.form.platform ?? '',
        genre: this.form.genre ?? '',
        year: this.form.year ?? undefined,
        cover_url: this.form.cover_url ?? '',
        rawg_id: this.form.rawg_id ?? '',
        notes: this.form.notes ?? '',
      };
      if (this.isEdit) {
        await this.gameService.update(this.gameId, data);
      } else {
        await this.gameService.create(data as any);
      }
      this.router.navigate(['/games']);
    } catch (e: any) {
      this.error.set('Failed to save game. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }
}
