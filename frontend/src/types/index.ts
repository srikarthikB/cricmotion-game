export type GameState = 'SPLASH' | 'AUTH' | 'DASHBOARD' | 'MATCH_SETTINGS' | 'CALIBRATION' | 'PLAY' | 'PAUSE' | 'SUMMARY' | 'STATS' | 'TOURNAMENT' | 'SETTINGS';

export interface User {
  id: string;
  name: string;
  xp: number;
  level: number;
  avatar: string;
}

export interface MatchConfig {
  overs: number;
  wickets: number;
  isRunChase: boolean;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  venue: string;
  team: string;
}

export interface BackendMatch {
  gameId: string;
  target: number;
  overs: number;
}

export interface ScoreData {
  runs: number;
  wickets: number;
  balls: number;
  overProgress: string;
  currentOver: number[];
  target?: number;
}

export interface ShotResult {
  score: number; // 0, 1, 2, 3, 4, 6
  type: 'STRAIGHT' | 'PULL' | 'DRIVE' | 'CUT' | 'DEFENSE' | 'MISS' | 'WICKET';
  power: number; // 0-100
  timing: 'EARLY' | 'PERFECT' | 'LATE' | 'POOR';
}
