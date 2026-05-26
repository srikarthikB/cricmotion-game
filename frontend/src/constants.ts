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
    id: 'LDN_OVAL', 
    name: 'LONDON OVAL', 
    img: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&q=80&w=400',
    desc: 'Classic turf, high bounce.'
  },
  { 
    id: 'MEL_GND', 
    name: 'MELBOURNE ARENA', 
    img: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&q=80&w=400',
    desc: 'Fast outfield, seaside breeze.'
  },
  {
    id: 'DXB_STAD',
    name: 'DUBAI NEXUS',
    img: 'https://images.unsplash.com/photo-1593341646782-e0b495cff86d?auto=format&fit=crop&q=80&w=1200',
    desc: 'Futuristic dome, zero wind.'
  },
  {
    id: 'CAPE_TOWN',
    name: 'CAPE TOWN HEIGHTS',
    img: 'https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?auto=format&fit=crop&q=80&w=1200',
    desc: 'Scenic view, swing paradise.'
  }
];
