import { GameConfig, GameResult } from '../models/gauntlet.model';

export function calculatePoints(
  config: GameConfig,
  scores: Record<string, number>,
): Record<string, number> {
  const players = Object.keys(scores);
  const awarded: Record<string, number> = {};
  for (const p of players) awarded[p] = 0;

  if (config.scoring_mode === 'winner') {
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const topScore = sorted[0]?.[1];
    for (const [player, score] of sorted) {
      awarded[player] = score === topScore ? config.points_for_winner : 0;
    }
  } else if (config.scoring_mode === 'rank') {
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    sorted.forEach(([player], i) => {
      awarded[player] = config.points_for_rank[i] ?? 0;
    });
  } else if (config.scoring_mode === 'highscore') {
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const winningScore = sorted[0]?.[1] ?? 0;
    for (const [player, score] of sorted) {
      const isWinner = score === winningScore;
      const base = isWinner ? config.points_for_winner : config.points_for_loser;
      const bonus = winningScore > 0 ? Math.round((score / winningScore) * 2) : 0;
      awarded[player] = base + bonus;
    }
  }

  return awarded;
}

export function computeStandings(
  playerNames: string[],
  results: GameResult[],
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
