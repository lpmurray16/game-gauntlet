import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'gauntlets/new',
    loadComponent: () =>
      import('./features/gauntlets/gauntlet-builder/gauntlet-builder.component').then(
        (m) => m.GauntletBuilderComponent,
      ),
  },
  {
    path: 'gauntlets/:id/results',
    loadComponent: () =>
      import('./features/gauntlets/gauntlet-results/gauntlet-results.component').then(
        (m) => m.GauntletResultsComponent,
      ),
  },
  {
    path: 'gauntlets/:id/game/:gameIndex',
    loadComponent: () =>
      import('./features/gauntlets/score-entry/score-entry.component').then(
        (m) => m.ScoreEntryComponent,
      ),
  },
  {
    path: 'gauntlets/:id',
    loadComponent: () =>
      import('./features/gauntlets/gauntlet-view/gauntlet-view.component').then(
        (m) => m.GauntletViewComponent,
      ),
  },
  {
    path: 'history',
    loadComponent: () =>
      import('./features/history/history.component').then((m) => m.HistoryComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
