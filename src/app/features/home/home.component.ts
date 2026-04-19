import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GauntletService } from '../../core/services/gauntlet.service';
import { Gauntlet } from '../../core/models/gauntlet.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  gauntlets = signal<Gauntlet[]>([]);
  loading = signal(true);
  error = signal('');

  constructor(private gauntletService: GauntletService) {}

  async ngOnInit() {
    try {
      const all = await this.gauntletService.getAll();
      this.gauntlets.set(all);
    } catch (e: any) {
      this.error.set('Could not load gauntlets. Is PocketBase running?');
    } finally {
      this.loading.set(false);
    }
  }

  get activeGauntlets() {
    return this.gauntlets().filter(g => g.status === 'active');
  }

  get draftGauntlets() {
    return this.gauntlets().filter(g => g.status === 'draft');
  }
}
