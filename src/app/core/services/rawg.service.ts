import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RawgGame } from '../models/game.model';

@Injectable({ providedIn: 'root' })
export class RawgService {
  private base = 'https://api.rawg.io/api';

  constructor(private http: HttpClient) {}

  search(query: string): Observable<RawgGame[]> {
    if (!query.trim()) return of([]);
    const url = `${this.base}/games?key=${environment.rawgApiKey}&search=${encodeURIComponent(query)}&page_size=10`;
    return this.http.get<{ results: RawgGame[] }>(url).pipe(map((res) => res.results));
  }

  searchAsync(query: string): Promise<RawgGame[]> {
    return firstValueFrom(this.search(query));
  }

  searchRaw(query: string): Observable<{ results: RawgGame[] }> {
    if (!query.trim()) return of({ results: [] });
    const url = `${this.base}/games?key=${environment.rawgApiKey}&search=${encodeURIComponent(query)}&page_size=10`;
    return this.http.get<{ results: RawgGame[] }>(url);
  }
}
