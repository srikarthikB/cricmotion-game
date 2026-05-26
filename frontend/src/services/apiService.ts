import axios from 'axios';
import { MatchConfig } from '../types';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const backendDifficulty: Record<MatchConfig['difficulty'], 'easy' | 'medium' | 'hard'> = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
};

export const apiService = {
  // Auth
  getStoredUser: () => {
    const stored = localStorage.getItem('cricket_user');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return null;
      }
    }
    return null;
  },

  createAccount: async (name: string) => {
    const user = { 
      id: 'user_' + Math.random().toString(36).substr(2, 9), 
      name: name || 'Rookie Operator', 
      xp: 0, 
      level: 1,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`
    };
    localStorage.setItem('cricket_user', JSON.stringify(user));
    return user;
  },

  logout: () => {
    localStorage.removeItem('cricket_user');
  },

  loginGuest: async () => {
    // const response = await api.post('/auth/guest');
    // return response.data;
    return { 
      id: 'guest_' + Math.random().toString(36).substr(2, 9), 
      name: 'Rookie Operator', 
      xp: 0, 
      level: 1,
      avatar: ''
    };
  },

  // Match
  startMatch: async (config: Pick<MatchConfig, 'difficulty'> & { playerName?: string }) => {
    const response = await api.post('/start-game', {
      player_name: config.playerName || 'Player',
      difficulty: backendDifficulty[config.difficulty] || 'medium'
    });

    return response.data;
  },

  updateScore: async (matchId: string, scoreData: any) => {
    // await api.post(`/match/${matchId}/score`, scoreData);
  },

  getLeaderboard: async () => {
    // const response = await api.get('/leaderboard');
    // return response.data;
    return [
      { name: 'Sachin T.', score: 10500, avatar: '' },
      { name: 'Virat K.', score: 9800, avatar: '' },
      { name: 'Rohit S.', score: 8700, avatar: '' },
    ];
  },

  // Calibration
  saveCalibration: async (data: any) => {
    // await api.post('/calibration/save', data);
  }
};
