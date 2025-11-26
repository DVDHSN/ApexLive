
export enum TireCompound {
  SOFT = 'SOFT',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
  INTER = 'INTER',
  WET = 'WET'
}

export enum SessionType {
  PRACTICE = 'Practice',
  QUALIFYING = 'Qualifying',
  RACE = 'Race'
}

export interface Driver {
  id: string; // driver_number
  code: string; // name_acronym
  name: string; // full_name
  team: string; // team_name
  teamColor: string; // team_colour
  position: number;
  gapToLeader: number; // in seconds
  interval: number; // to car ahead
  lastLapTime: string;
  currentSector1: number; // 0 = standard, 1 = personal best, 2 = session best
  currentSector2: number;
  currentSector3: number;
  tire: TireCompound;
  tireAge: number; // laps
  pitStops: number;
  status: 'ACTIVE' | 'PIT' | 'OUT';
  imgUrl?: string; // Headshot URL if available
  drsAvailable?: boolean; // Calculated based on interval < 1s
}

export interface TelemetryData {
  date: string; // ISO timestamp
  speed: number;
  throttle: number; // 0-100
  brake: number; // 0-100
  rpm: number;
  gear: number;
  drs: number; // OpenF1 uses int for DRS
}

export interface RaceControlMessage {
  id: number;
  timestamp: string;
  message: string;
  type: 'INFO' | 'FLAG' | 'SAFETY_CAR' | 'INCIDENT';
  flag?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  isThinking?: boolean;
}

export interface OpenF1Session {
  session_key: number;
  session_name: string;
  date_start: string;
  date_end: string;
  gmt_offset: string;
  session_type: string;
  meeting_key: number;
  location: string;
  country_name: string;
  year: number;
}

export interface WeatherData {
  date: string;
  air_temperature: number;
  track_temperature: number;
  humidity: number;
  wind_speed: number;
  wind_direction: number;
  rainfall: number;
}
