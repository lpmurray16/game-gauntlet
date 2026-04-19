import { Injectable } from '@angular/core';
import { PocketBaseService } from './pocketbase.service';
import { Gauntlet, GauntletResult, GameConfig, GameResult } from '../models/gauntlet.model';

@Injectable({ providedIn: 'root' })
export class GauntletService {
  private col = 'gauntlets';
  private resultCol = 'gauntlet_results';

  constructor(private pbs: PocketBaseService) {}

  async getAll(): Promise<Gauntlet[]> {
    const result = await this.pbs.pb.collection(this.col).getList(1, 200, { sort: '-created' });
    return result.items.map((r) => this.deserialize(r));
  }

  async getById(id: string): Promise<Gauntlet> {
    const record = await this.pbs.pb.collection(this.col).getOne(id);
    return this.deserialize(record);
  }

  async create(data: {
    name: string;
    player_names: string[];
    game_configs: GameConfig[];
  }): Promise<Gauntlet> {
    const record = await this.pbs.pb.collection(this.col).create({
      name: data.name,
      player_names: JSON.stringify(data.player_names),
      game_configs: JSON.stringify(data.game_configs),
      game_results: JSON.stringify([]),
      status: 'draft',
    });
    return this.deserialize(record);
  }

  async updateGauntlet(
    id: string,
    data: {
      name: string;
      player_names: string[];
      game_configs: GameConfig[];
    },
  ): Promise<Gauntlet> {
    const record = await this.pbs.pb.collection(this.col).update(id, {
      name: data.name,
      player_names: JSON.stringify(data.player_names),
      game_configs: JSON.stringify(data.game_configs),
    });
    return this.deserialize(record);
  }

  async updateStatus(id: string, status: 'draft' | 'active' | 'completed'): Promise<Gauntlet> {
    const record = await this.pbs.pb.collection(this.col).update(id, { status });
    return this.deserialize(record);
  }

  async saveGameResult(
    gauntletId: string,
    gauntlet: Gauntlet,
    result: GameResult,
  ): Promise<Gauntlet> {
    const existing = [...gauntlet.game_results];
    const idx = existing.findIndex((r) => r.game_id === result.game_id);
    if (idx >= 0) {
      existing[idx] = result;
    } else {
      existing.push(result);
    }
    const record = await this.pbs.pb.collection(this.col).update(gauntletId, {
      game_results: JSON.stringify(existing),
    });
    return this.deserialize(record);
  }

  async finalize(gauntlet: Gauntlet): Promise<GauntletResult> {
    const standings: Record<string, number> = {};
    for (const player of gauntlet.player_names) {
      standings[player] = 0;
    }
    for (const result of gauntlet.game_results) {
      for (const [player, pts] of Object.entries(result.points_awarded)) {
        standings[player] = (standings[player] ?? 0) + pts;
      }
    }
    const winner = Object.entries(standings).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

    await this.pbs.pb.collection(this.col).update(gauntlet.id, { status: 'completed' });

    const resultRecord = await this.pbs.pb.collection(this.resultCol).create({
      gauntlet_id: gauntlet.id,
      final_standings: JSON.stringify(standings),
      winner,
      completed_at: new Date().toISOString(),
    });
    return this.deserializeResult(resultRecord);
  }

  async getResults(): Promise<GauntletResult[]> {
    const result = await this.pbs.pb.collection(this.resultCol).getList(1, 200, {
      sort: '-completed_at',
    });
    return result.items.map((r) => this.deserializeResult(r));
  }

  async getResultByGauntletId(gauntletId: string): Promise<GauntletResult | null> {
    try {
      const records = await this.pbs.pb.collection(this.resultCol).getList(1, 1, {
        filter: `gauntlet_id="${gauntletId}"`,
      });
      return records.items.length ? this.deserializeResult(records.items[0]) : null;
    } catch {
      return null;
    }
  }

  private deserialize(r: any): Gauntlet {
    return {
      id: r.id,
      name: r.name,
      status: r.status,
      player_names: this.parseJson(r.player_names, []),
      game_configs: this.parseJson(r.game_configs, []),
      game_results: this.parseJson(r.game_results, []),
      created: r.created,
      updated: r.updated,
    };
  }

  private deserializeResult(r: any): GauntletResult {
    return {
      id: r.id,
      gauntlet_id: r.gauntlet_id,
      final_standings: this.parseJson(r.final_standings, {}),
      winner: r.winner,
      completed_at: r.completed_at,
      expand: r.expand
        ? { gauntlet_id: r.expand.gauntlet_id ? this.deserialize(r.expand.gauntlet_id) : undefined }
        : undefined,
    };
  }

  private parseJson(val: any, fallback: any): any {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return fallback;
      }
    }
    return val ?? fallback;
  }
}
