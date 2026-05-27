import dharamshalaGameplay from './assets/images/stadiums/dharamshala-gameplay.png';
import lordsGameplay from './assets/images/stadiums/lords-gameplay.png';
import mcgGameplay from './assets/images/stadiums/mcg-gameplay.png';
import oldTraffordGameplay from './assets/images/stadiums/old-trafford-gameplay.png';

export const APP_CONFIG = {
  NAME: 'CRICMOTION AI',
  VERSION: '4.1.2-STABLE',
  DEVELOPER: 'Shadow Cricket Gaming',
  THEME: {
    PRIMARY: '#00f2ff',
    SECONDARY: '#ff00ea',
    ACCENT: '#ff2d55',
    BG: '#02050a'
  }
};

export const DIFFICULTY_MODES = [
  { id: 'EASY', label: 'ROOKIE', multiplier: 1.0 },
  { id: 'MEDIUM', label: 'PRO', multiplier: 1.5 },
  { id: 'HARD', label: 'LEGEND', multiplier: 2.0 }
];

export const TEAMS = [
  { id: 'IND', name: 'INDIA', flag: '🇮🇳', code: 'in' },
  { id: 'AUS', name: 'AUSTRALIA', flag: '🇦🇺', code: 'au' },
  { id: 'ENG', name: 'ENGLAND', flag: '🇬🇧', code: 'gb' },
  { id: 'PAK', name: 'PAKISTAN', flag: '🇵🇰', code: 'pk' },
  { id: 'NZ', name: 'NEW ZEALAND', flag: '🇳🇿', code: 'nz' },
  { id: 'SA', name: 'SOUTH AFRICA', flag: '🇿🇦', code: 'za' },
  { id: 'WI', name: 'WEST INDIES', flag: '🏝️', code: 'jm' }, // Using Jamaica for WI representative
  { id: 'SL', name: 'SRI LANKA', flag: '🇱🇰', code: 'lk' },
  { id: 'AFG', name: 'AFGHANISTAN', flag: '🇦🇫', code: 'af' },
  { id: 'BAN', name: 'BANGLADESH', flag: '🇧🇩', code: 'bd' },
  { id: 'IRE', name: 'IRELAND', flag: '🇮🇪', code: 'ie' },
  { id: 'ZIM', name: 'ZIMBABWE', flag: '🇿🇼', code: 'zw' },
];

export const VENUES = [
  { 
    id: 'LORDS', 
    name: "LORD'S", 
    img: lordsGameplay,
    gameplayBg: lordsGameplay,
    desc: 'Historic slope, balanced carry.'
  },
  { 
    id: 'MCG', 
    name: 'MCG', 
    img: mcgGameplay,
    gameplayBg: mcgGameplay,
    desc: 'Big boundaries, stadium cauldron.'
  },
  {
    id: 'DHARAMSHALA',
    name: 'DHARAMSHALA',
    img: dharamshalaGameplay,
    gameplayBg: dharamshalaGameplay,
    desc: 'Mountain backdrop, crisp carry.'
  },
  {
    id: 'OLD_TRAFFORD',
    name: 'OLD TRAFFORD',
    img: oldTraffordGameplay,
    gameplayBg: oldTraffordGameplay,
    desc: 'Cloud cover, classic seam feel.'
  }
];

export const getVenueById = (venueId: string) =>
  VENUES.find((venue) => venue.id === venueId) ?? VENUES[0];
