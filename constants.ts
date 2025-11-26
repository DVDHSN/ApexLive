import { Driver, TireCompound } from './types';

export const TEAM_COLORS: Record<string, string> = {
  "Red Bull Racing": "#3671C6",
  "Mercedes": "#27F4D2",
  "Ferrari": "#E80020",
  "McLaren": "#FF8000",
  "Aston Martin": "#229971",
  "Alpine": "#0093CC",
  "Williams": "#64C4FF",
  "RB": "#6692FF",
  "Sauber": "#52E252",
  "Haas": "#B6BABD"
};

export const INITIAL_DRIVERS: Driver[] = [
  { id: 'max', code: 'VER', name: 'Max Verstappen', team: 'Red Bull Racing', teamColor: TEAM_COLORS["Red Bull Racing"], position: 1, gapToLeader: 0, interval: 0, lastLapTime: '1:32.405', currentSector1: 2, currentSector2: 0, currentSector3: 0, tire: TireCompound.MEDIUM, tireAge: 12, pitStops: 0, status: 'ACTIVE' },
  { id: 'nor', code: 'NOR', name: 'Lando Norris', team: 'McLaren', teamColor: TEAM_COLORS["McLaren"], position: 2, gapToLeader: 2.4, interval: 2.4, lastLapTime: '1:32.510', currentSector1: 1, currentSector2: 1, currentSector3: 0, tire: TireCompound.MEDIUM, tireAge: 11, pitStops: 0, status: 'ACTIVE' },
  { id: 'lec', code: 'LEC', name: 'Charles Leclerc', team: 'Ferrari', teamColor: TEAM_COLORS["Ferrari"], position: 3, gapToLeader: 4.1, interval: 1.7, lastLapTime: '1:32.650', currentSector1: 0, currentSector2: 0, currentSector3: 0, tire: TireCompound.HARD, tireAge: 18, pitStops: 0, status: 'ACTIVE' },
  { id: 'pia', code: 'PIA', name: 'Oscar Piastri', team: 'McLaren', teamColor: TEAM_COLORS["McLaren"], position: 4, gapToLeader: 6.5, interval: 2.4, lastLapTime: '1:32.700', currentSector1: 0, currentSector2: 0, currentSector3: 1, tire: TireCompound.MEDIUM, tireAge: 11, pitStops: 0, status: 'ACTIVE' },
  { id: 'ham', code: 'HAM', name: 'Lewis Hamilton', team: 'Mercedes', teamColor: TEAM_COLORS["Mercedes"], position: 5, gapToLeader: 9.2, interval: 2.7, lastLapTime: '1:33.100', currentSector1: 0, currentSector2: 0, currentSector3: 0, tire: TireCompound.MEDIUM, tireAge: 13, pitStops: 0, status: 'ACTIVE' },
  { id: 'rus', code: 'RUS', name: 'George Russell', team: 'Mercedes', teamColor: TEAM_COLORS["Mercedes"], position: 6, gapToLeader: 11.5, interval: 2.3, lastLapTime: '1:33.050', currentSector1: 0, currentSector2: 0, currentSector3: 0, tire: TireCompound.HARD, tireAge: 19, pitStops: 0, status: 'ACTIVE' },
  { id: 'sai', code: 'SAI', name: 'Carlos Sainz', team: 'Ferrari', teamColor: TEAM_COLORS["Ferrari"], position: 7, gapToLeader: 14.0, interval: 2.5, lastLapTime: '1:33.200', currentSector1: 0, currentSector2: 0, currentSector3: 0, tire: TireCompound.HARD, tireAge: 18, pitStops: 0, status: 'ACTIVE' },
  { id: 'alo', code: 'ALO', name: 'Fernando Alonso', team: 'Aston Martin', teamColor: TEAM_COLORS["Aston Martin"], position: 8, gapToLeader: 18.2, interval: 4.2, lastLapTime: '1:33.800', currentSector1: 0, currentSector2: 0, currentSector3: 0, tire: TireCompound.MEDIUM, tireAge: 10, pitStops: 0, status: 'ACTIVE' },
];
