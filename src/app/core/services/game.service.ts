import { Injectable } from '@angular/core';
import { PocketBaseService } from './pocketbase.service';
import { Game } from '../models/game.model';

@Injectable({ providedIn: 'root' })
export class GameService {
  private collection = 'games';

  constructor(private pbs: PocketBaseService) {}

  async getAll(): Promise<Game[]> {
    const records = await this.pbs.pb.collection(this.collection).getFullList({
      sort: 'title'
    });
    return records as unknown as Game[];
  }

  async getById(id: string): Promise<Game> {
    const record = await this.pbs.pb.collection(this.collection).getOne(id);
    return record as unknown as Game;
  }

  async create(data: Omit<Game, 'id' | 'created' | 'updated'>): Promise<Game> {
    const record = await this.pbs.pb.collection(this.collection).create(data);
    return record as unknown as Game;
  }

  async update(id: string, data: Partial<Game>): Promise<Game> {
    const record = await this.pbs.pb.collection(this.collection).update(id, data);
    return record as unknown as Game;
  }

  async delete(id: string): Promise<void> {
    await this.pbs.pb.collection(this.collection).delete(id);
  }
}
