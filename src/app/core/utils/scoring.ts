import { GameConfig, GameResult } from '../models/gauntlet.model';

export function calculatePoints(
  config: GameConfig,
  scores: Record<string, number>
): Record<string, number> {
  const players = Object.keys(scores);
  const awarded: Record<string, number> = {};
  for (const p of players) awarded[p] = 0;

  if (config.scoring_mode === 'match') {
    const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (winner) awarded[winner] = config.points_for_winner;

  } else if (config.scoring_mode === 'rank') {
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    sorted.forEach(([player], i) => {
      awarded[player] = config.points_for_rank[i] ?? 0;
    });

  } else if (config.scoring_mode === 'normalized') {
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore > 0) {
      for (const [player, score] of Object.entries(scores)) {
        awarded[player] = Math.round((score / maxScore) * config.points_for_winner);
      }
    }
  }

  return awarded;
}

export function computeStandings(
  playerNames: string[],
  results: GameResult[]
): Record<string, number> {
  const standings: Record<string, number> = {};
  for (const p of playerNames) standings[p] = 0;
  for (const result of results) {
    if (!result.completed) continue;
    for (const [player, pts] of Object.entries(result.points_awarded)) {
      standings[player] = (standings[player] ?? 0) + pts;
    }
  }
  return standings;
}
