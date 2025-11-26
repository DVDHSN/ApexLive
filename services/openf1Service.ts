import { Driver, OpenF1Session, TelemetryData, RaceControlMessage, TireCompound, WeatherData } from '../types';

const API_BASE = 'https://api.openf1.org/v1';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to handle API limits or errors with retry logic
const fetchAPI = async (endpoint: string, retries = 3, backoff = 1000, init?: RequestInit) => {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, init);
    
    // Handle Rate Limiting
    if (res.status === 429) {
      if (retries > 0) {
        console.warn(`[ApexLive] Rate limited (429). Retrying in ${backoff}ms... (${endpoint})`);
        await delay(backoff);
        return fetchAPI(endpoint, retries - 1, backoff * 2, init);
      } else {
        throw new Error("API Rate Limit Exceeded - Try again later");
      }
    }

    if (!res.ok) throw new Error(`OpenF1 API Error: ${res.statusText}`);
    return await res.json();
  } catch (e: any) {
    // Ignore abort errors (user paused/cancelled)
    if (e.name === 'AbortError') return [];
    
    console.error(e);
    return []; // Return empty array to prevent app crash
  }
};

export const getSessions = async (year: number): Promise<OpenF1Session[]> => {
  // Fetch all sessions for the year
  const sessions = await fetchAPI(`/sessions?year=${year}`);
  // Sort by date
  return sessions.sort((a: any, b: any) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime());
};

export const getSessionDrivers = async (sessionKey: number): Promise<Driver[]> => {
  const driversData = await fetchAPI(`/drivers?session_key=${sessionKey}`);
  
  // Map to our internal Driver interface
  return driversData.map((d: any) => ({
    id: d.driver_number.toString(),
    code: d.name_acronym,
    name: d.full_name,
    team: d.team_name,
    teamColor: `#${d.team_colour}` || '#333',
    position: 0, // Will be updated by live data
    gapToLeader: 0,
    interval: 0,
    lastLapTime: '-',
    currentSector1: 0,
    currentSector2: 0,
    currentSector3: 0,
    tire: TireCompound.SOFT, // Default, will be updated by stint logic
    tireAge: 0,
    pitStops: 0,
    status: 'ACTIVE',
    imgUrl: d.headshot_url
  }));
};

// Fetch a snapshot of positions at a specific time (or latest if no time provided)
export const getPositionsAtTime = async (sessionKey: number, date: string, windowSeconds: number = 2, signal?: AbortSignal) => {
  const endDate = new Date(new Date(date).getTime() + (windowSeconds * 1000)).toISOString();
  return await fetchAPI(`/position?session_key=${sessionKey}&date>=${date}&date<${endDate}`, 3, 1000, { signal });
};

// Get historical positions for initialization (lookback)
export const getHistoricalPositions = async (sessionKey: number, endDate: string, lookbackSeconds: number = 180) => {
    const startDate = new Date(new Date(endDate).getTime() - (lookbackSeconds * 1000)).toISOString();
    return await fetchAPI(`/position?session_key=${sessionKey}&date>=${startDate}&date<=${endDate}`);
};

export const getIntervalsAtTime = async (sessionKey: number, date: string, windowSeconds: number = 2, signal?: AbortSignal) => {
  const endDate = new Date(new Date(date).getTime() + (windowSeconds * 1000)).toISOString();
  return await fetchAPI(`/intervals?session_key=${sessionKey}&date>=${date}&date<${endDate}`, 3, 1000, { signal });
};

// New: Get intervals in a larger past window (useful for initialization to populate missing data)
export const getHistoricalIntervals = async (sessionKey: number, endDate: string, lookbackSeconds: number = 60) => {
    const startDate = new Date(new Date(endDate).getTime() - (lookbackSeconds * 1000)).toISOString();
    return await fetchAPI(`/intervals?session_key=${sessionKey}&date>=${startDate}&date<=${endDate}`);
};

export const getLaps = async (sessionKey: number, driverNumber?: string, lapNumber?: number) => {
  let url = `/laps?session_key=${sessionKey}`;
  if (driverNumber) url += `&driver_number=${driverNumber}`;
  if (lapNumber) url += `&lap_number=${lapNumber}`;
  return await fetchAPI(url);
};

export const getRaceControlMessages = async (sessionKey: number) => {
  return await fetchAPI(`/race_control?session_key=${sessionKey}`);
};

// Renamed and updated for specific car data fetching for the telemetry dashboard
export const getCarData = async (sessionKey: number, driverNumber: string, date: string, lookbackSeconds: number = 30, signal?: AbortSignal): Promise<TelemetryData[]> => {
  const endDate = new Date(date).toISOString();
  const startDate = new Date(new Date(date).getTime() - (lookbackSeconds * 1000)).toISOString();
  
  const data = await fetchAPI(`/car_data?session_key=${sessionKey}&driver_number=${driverNumber}&date>=${startDate}&date<=${endDate}`, 3, 1000, { signal });
  
  // Sort by date just in case
  const sorted = data.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return sorted.map((d: any) => ({
    date: d.date,
    speed: d.speed,
    throttle: d.throttle,
    brake: d.brake,
    rpm: d.rpm,
    gear: d.n_gear,
    drs: d.drs
  }));
};

// Fetch location data (x, y) to generate track map
export const getLocations = async (sessionKey: number, driverNumber: string, startDate: string, endDate: string) => {
  return await fetchAPI(`/location?session_key=${sessionKey}&driver_number=${driverNumber}&date>=${startDate}&date<${endDate}`);
};

// New: Fetch locations for ALL drivers at a specific time (window)
export const getLocationsAtTime = async (sessionKey: number, date: string, windowSeconds: number = 1, signal?: AbortSignal) => {
  const endDate = new Date(new Date(date).getTime() + (windowSeconds * 1000)).toISOString();
  return await fetchAPI(`/location?session_key=${sessionKey}&date>=${date}&date<${endDate}`, 3, 1000, { signal });
};

export const getWeather = async (sessionKey: number, date: string, windowSeconds: number = 60, signal?: AbortSignal): Promise<WeatherData[]> => {
  const endDate = new Date(new Date(date).getTime() + (windowSeconds * 1000)).toISOString();
  // Fetch slightly wider window to ensure we catch a reading
  const startDate = new Date(new Date(date).getTime() - (60 * 1000)).toISOString();
  const data = await fetchAPI(`/weather?session_key=${sessionKey}&date>=${startDate}&date<=${endDate}`, 3, 1000, { signal });
  return data;
};

export const getStints = async (sessionKey: number) => {
  return await fetchAPI(`/stints?session_key=${sessionKey}`);
};