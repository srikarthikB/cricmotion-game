import { create } from 'zustand';
import { BackendMatch, GameState, MatchConfig, ScoreData, User } from '../types';

interface GameStore {
  currentState: GameState;
  user: User | null;
  matchConfig: MatchConfig;
  backendMatch: BackendMatch | null;
  score: ScoreData;
  isAudioEnabled: boolean;
  isHapticEnabled: boolean;
  graphicsQuality: 'LOW' | 'MEDIUM' | 'STRETCHED' | 'ULTRA';
  isMotionBlurEnabled: boolean;
  isAnonymousDataEnabled: boolean;
  isPushAlertsEnabled: boolean;
  
  // Actions
  setState: (state: GameState) => void;
  setUser: (user: User | null) => void;
  updateMatchConfig: (config: Partial<MatchConfig>) => void;
  setBackendMatch: (match: BackendMatch | null) => void;
  updateScore: (score: Partial<ScoreData>) => void;
  resetScore: () => void;
  toggleAudio: () => void;
  toggleHaptic: () => void;
  setGraphicsQuality: (quality: 'LOW' | 'MEDIUM' | 'STRETCHED' | 'ULTRA') => void;
  toggleMotionBlur: () => void;
  toggleAnonymousData: () => void;
  togglePushAlerts: () => void;
}

const initialScore: ScoreData = {
  runs: 0,
  wickets: 0,
  balls: 0,
  overProgress: '0.0',
  currentOver: [],
};

const initialMatchConfig: MatchConfig = {
  overs: 5,
  wickets: 10,
  isRunChase: false,
  difficulty: 'MEDIUM',
  venue: 'STADIUM_A',
  team: 'INDIA',
};

export const useGameStore = create<GameStore>((set) => ({
  currentState: 'SPLASH',
  user: null,
  matchConfig: initialMatchConfig,
  backendMatch: null,
  score: initialScore,
  isAudioEnabled: true,
  isHapticEnabled: true,
  graphicsQuality: 'ULTRA',
  isMotionBlurEnabled: true,
  isAnonymousDataEnabled: false,
  isPushAlertsEnabled: true,

  setState: (state) => set({ currentState: state }),
  setUser: (user) => set({ user }),
  updateMatchConfig: (config) => set((state) => ({ 
    matchConfig: { ...state.matchConfig, ...config } 
  })),
  setBackendMatch: (match) => set({ backendMatch: match }),
  updateScore: (score) => set((state) => ({ 
    score: { ...state.score, ...score } 
  })),
  resetScore: () => set({ score: initialScore }),
  toggleAudio: () => set((state) => ({ isAudioEnabled: !state.isAudioEnabled })),
  toggleHaptic: () => set((state) => ({ isHapticEnabled: !state.isHapticEnabled })),
  setGraphicsQuality: (quality) => set({ graphicsQuality: quality }),
  toggleMotionBlur: () => set((state) => ({ isMotionBlurEnabled: !state.isMotionBlurEnabled })),
  toggleAnonymousData: () => set((state) => ({ isAnonymousDataEnabled: !state.isAnonymousDataEnabled })),
  togglePushAlerts: () => set((state) => ({ isPushAlertsEnabled: !state.isPushAlertsEnabled })),
}));
