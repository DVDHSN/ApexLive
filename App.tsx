import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Driver, RaceControlMessage, TelemetryData, ChatMessage, OpenF1Session, WeatherData, TireCompound } from './types';
import LiveLeaderboard from './components/LiveLeaderboard';
import TrackMap from './components/TrackMap';
import TelemetryDashboard from './components/TelemetryDashboard';
import { IncidentFeed, WeatherWidget } from './components/DashboardWidgets';
import { 
  getSessions, 
  getSessionDrivers, 
  getPositionsAtTime, 
  getHistoricalPositions,
  getIntervalsAtTime, 
  getHistoricalIntervals,
  getRaceControlMessages, 
  getLaps,
  getLocations,
  getLocationsAtTime,
  getWeather,
  getStints
} from './services/openf1Service';
import { 
  Play,
  Pause,
  RefreshCw,
  Zap,
  LayoutDashboard,
  Activity,
  Radio
} from 'lucide-react';

const AVAILABLE_YEARS = [2025, 2024, 2023];
const PLAYBACK_SPEEDS = [1, 5, 10, 30];

// Helper to format seconds to M:SS.ms
const formatLapTime = (seconds: number | string): string => {
  if (typeof seconds === 'string') return seconds; // Already formatted or '-'
  if (!seconds || seconds <= 0) return '-';
  
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${mins}:${secs.padStart(6, '0')}`;
};

export default function App() {
  // Navigation State
  const [currentView, setCurrentView] = useState<'dashboard' | 'telemetry'>('dashboard');

  // Selection State
  const [selectedYear, setSelectedYear] = useState(2025);
  const [allSessions, setAllSessions] = useState<OpenF1Session[]>([]);
  const [meetings, setMeetings] = useState<Record<number, { name: string, sessions: OpenF1Session[] }>>({});
  const [selectedMeetingKey, setSelectedMeetingKey] = useState<number | null>(null);
  const [session, setSession] = useState<OpenF1Session | null>(null);

  // Data State
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [messages, setMessages] = useState<RaceControlMessage[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  
  // Track Map State
  const [trackPath, setTrackPath] = useState<string | null>(null);
  const [mapTransform, setMapTransform] = useState<{ minX: number, minY: number, scale: number, offsetX: number, offsetY: number } | null>(null);
  const [driverCoordinates, setDriverCoordinates] = useState<Record<string, {x: number, y: number}>>({});

  // Race Status State
  const [trackStatus, setTrackStatus] = useState<'GREEN' | 'YELLOW' | 'SC' | 'VSC' | 'RED'>('GREEN');
  const [drsEnabled, setDrsEnabled] = useState(false);
  const [completedLaps, setCompletedLaps] = useState(0);
  const [totalLaps, setTotalLaps] = useState(0); 
  const [retiredDrivers, setRetiredDrivers] = useState<Set<string>>(new Set());
  
  // Cache
  const sessionLapsRef = useRef<any[]>([]);
  const sessionStintsRef = useRef<any[]>([]);
  
  // Replay State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentReplayTime, setCurrentReplayTime] = useState<Date | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [sessionEndTime, setSessionEndTime] = useState<Date | null>(null);
  
  // Live Detection State
  const [isSessionLive, setIsSessionLive] = useState(false);
  const [isAtLiveHead, setIsAtLiveHead] = useState(false);

  // Ref to track current time inside interval without re-triggering effect
  const replayTimeRef = useRef<Date | null>(null);
  
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const loopCounterRef = useRef(0);

  // Sync ref with state when state updates from external sources (like init)
  useEffect(() => {
    if (currentReplayTime) {
        replayTimeRef.current = currentReplayTime;
    }
  }, [currentReplayTime]);

  // Check for Live Status
  useEffect(() => {
    if (!session || !currentReplayTime) return;

    // A session is "Live" if the current real time is before the scheduled end time
    // Note: OpenF1 sessions have date_end, but sometimes it runs over. We add 2 hours buffer to be safe.
    const now = new Date();
    const end = new Date(session.date_end);
    // Rough check: is it happening today and within the window?
    const isLive = now >= new Date(session.date_start) && now <= new Date(end.getTime() + 1000 * 60 * 60 * 2);
    setIsSessionLive(isLive);

    // Are we at the "Head" of the live stream? (within 60s of real time)
    // OpenF1 has a slight delay, so "Real Time" is usually ~10-20s behind wall clock
    const diff = Math.abs(now.getTime() - currentReplayTime.getTime());
    const atHead = diff < 60 * 1000; // 60 seconds
    setIsAtLiveHead(atHead);

    if (isLive && atHead && playbackSpeed !== 1) {
       setPlaybackSpeed(1); // Force 1x speed if watching live
    }

  }, [session, currentReplayTime, playbackSpeed]);

  // Core Data Update Logic extracted for reuse (Auto Playback & Manual Seek)
  const fetchDataForTime = useCallback(async (time: Date, signal: AbortSignal, isThrottledUpdate: boolean = false) => {
      if (!session) return;
      
      const isoTime = time.toISOString();
      const windowSeconds = 2; // Standard window

      try {
        const promises: Promise<any>[] = [
           getPositionsAtTime(session.session_key, isoTime, windowSeconds, signal), 
           getIntervalsAtTime(session.session_key, isoTime, windowSeconds * 2, signal),
           // Fetch Locations for real-time map visualization (smaller window for precision)
           getLocationsAtTime(session.session_key, isoTime, 1.5, signal)
        ];
        
        // Only fetch weather occasionally or on forced updates (seek)
        if (!isThrottledUpdate || loopCounterRef.current % 30 === 0) {
           promises.push(getWeather(session.session_key, isoTime, windowSeconds, signal));
        }
  
        const results = await Promise.all(promises);
        
        if (signal.aborted) return;
  
        const positions = results[0];
        const intervals = results[1];
        const locations = results[2];
        // Weather is the last item if fetched
        const weatherData = (!isThrottledUpdate || loopCounterRef.current % 30 === 0) ? results[3] : null;
        
        if (weatherData && weatherData.length > 0) {
           setWeather(weatherData[weatherData.length - 1]);
        }
        
        // Update Driver Coordinates Map
        if (locations && locations.length > 0) {
           const newCoords: Record<string, {x: number, y: number}> = {};
           locations.forEach((loc: any) => {
              // We want the latest coordinate per driver in this window
              newCoords[loc.driver_number] = { x: loc.x, y: loc.y };
           });
           setDriverCoordinates(prev => ({ ...prev, ...newCoords }));
        }

        setDrivers(prev => {
          const newDrivers = [...prev];
          
          positions.forEach((pos: any) => {
            const idx = newDrivers.findIndex(d => d.id === pos.driver_number.toString());
            if (idx !== -1) {
              newDrivers[idx].position = pos.position;
            }
          });
  
          intervals.forEach((int: any) => {
            const idx = newDrivers.findIndex(d => d.id === int.driver_number.toString());
            if (idx !== -1) {
              if (int.gap_to_leader !== null) newDrivers[idx].gapToLeader = parseFloat(int.gap_to_leader);
              if (int.interval !== null) newDrivers[idx].interval = parseFloat(int.interval);
            }
          });
          
          const laps = sessionLapsRef.current;
          const stints = sessionStintsRef.current;

          if (laps && laps.length > 0) {
              newDrivers.forEach(d => {
                  const driverLaps = laps.filter((l: any) => 
                      l.driver_number.toString() === d.id && 
                      new Date(l.date_start) <= time
                  );

                  let currentLapNumber = 0;

                  if (driverLaps.length > 0) {
                      const lastLap = driverLaps[driverLaps.length - 1];
                      if (lastLap.lap_duration) {
                         d.lastLapTime = formatLapTime(lastLap.lap_duration);
                         d.currentSector1 = lastLap.duration_sector_1 ? 1 : 0; 
                      }
                      currentLapNumber = lastLap.lap_number;
                      
                      // Leader updates global lap counter
                      if (d.position === 1) {
                        setCompletedLaps(lastLap.lap_number);
                      }
                  } else {
                     // If no laps completed, might be lap 1
                     currentLapNumber = 1; 
                  }

                  // STINT LOGIC
                  if (stints.length > 0) {
                     const activeStint = stints.find((s: any) => 
                        s.driver_number.toString() === d.id && 
                        s.lap_start <= currentLapNumber && 
                        (s.lap_end === null || s.lap_end >= currentLapNumber)
                     );

                     if (activeStint) {
                        d.tire = activeStint.compound as TireCompound;
                        const tyreAgeAtStart = activeStint.tyre_age_at_start || 0;
                        d.tireAge = (currentLapNumber - activeStint.lap_start) + tyreAgeAtStart;
                     }
                  }
              });
          }

          // Apply Retirement Status
          newDrivers.forEach(d => {
             if (retiredDrivers.has(d.id)) {
                 d.status = 'OUT';
             }
          });
  
          return newDrivers.sort((a, b) => {
             if (a.status === 'OUT' && b.status !== 'OUT') return 1;
             if (a.status !== 'OUT' && b.status === 'OUT') return -1;
             const posA = a.position === 0 ? 999 : a.position;
             const posB = b.position === 0 ? 999 : b.position;
             return posA - posB;
          });
        });
      } catch (error) {
         console.error(error);
      }
  }, [session, retiredDrivers]);

  // 1. Fetch Sessions List when Year Changes
  useEffect(() => {
    const fetchSessionList = async () => {
      // Reset logic
      setIsPlaying(false);
      setSession(null);
      setDrivers([]);
      setSelectedMeetingKey(null);
      setTrackPath(null);
      setMapTransform(null);
      setSessionStartTime(null);
      setSessionEndTime(null);
      
      const controller = new AbortController();
      // We pass null signal here as we want to let this finish usually, 
      // but in a real app we might pass signal.
      
      const sessions = await getSessions(selectedYear);
      setAllSessions(sessions);
      
      const grouped: Record<number, { name: string, sessions: OpenF1Session[] }> = {};
      
      sessions.forEach(s => {
        if (!grouped[s.meeting_key]) {
          grouped[s.meeting_key] = {
            name: `${s.country_name} - ${s.location}`,
            sessions: []
          };
        }
        grouped[s.meeting_key].sessions.push(s);
      });
      
      // Sort sessions within meetings by date
      Object.values(grouped).forEach(group => {
        group.sessions.sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime());
      });

      setMeetings(grouped);

      // Default to the latest meeting
      const meetingKeys = Object.keys(grouped).map(Number);
      if (meetingKeys.length > 0) {
        const sortedMeetingKeys = meetingKeys.sort((a, b) => {
           const timeA = new Date(grouped[a].sessions[0].date_start).getTime();
           const timeB = new Date(grouped[b].sessions[0].date_start).getTime();
           return timeA - timeB;
        });

        const lastMeetingKey = sortedMeetingKeys[sortedMeetingKeys.length - 1];
        setSelectedMeetingKey(lastMeetingKey);
        
        const meetingSessions = grouped[lastMeetingKey].sessions;
        const raceSession = meetingSessions.find(s => s.session_name.toLowerCase() === 'race') 
                            || meetingSessions.find(s => s.session_name.toLowerCase().includes('race'))
                            || meetingSessions[meetingSessions.length - 1];
        setSession(raceSession);
      }
    };
    fetchSessionList();
  }, [selectedYear]);

  // 2. Initialize Session Data
  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();

    const initSession = async () => {
      setIsPlaying(false);
      setMessages([]);
      setTrackStatus('GREEN');
      setDrsEnabled(false);
      setTrackPath(null);
      setMapTransform(null);
      setCompletedLaps(0);
      setTotalLaps(0);
      setRetiredDrivers(new Set());
      sessionLapsRef.current = [];
      sessionStintsRef.current = [];
      setDriverCoordinates({});
      
      const driverList = await getSessionDrivers(session.session_key);
      if (controller.signal.aborted) return;
      setDrivers(driverList);

      // Fetch Laps
      const allLaps = await getLaps(session.session_key);
      if (controller.signal.aborted) return;
      sessionLapsRef.current = allLaps;
      
      // Fetch Stints
      const allStints = await getStints(session.session_key);
      if (controller.signal.aborted) return;
      sessionStintsRef.current = allStints;

      const maxLap = allLaps.reduce((max: number, l: any) => Math.max(max, l.lap_number), 0);
      setTotalLaps(maxLap > 0 ? maxLap : 0);

      const lap1s = allLaps.filter((l: any) => l.lap_number === 1 && l.date_start);
      let startTime = new Date(session.date_start);
      
      if (lap1s.length > 0) {
        lap1s.sort((a: any, b: any) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime());
        const raceStart = new Date(lap1s[0].date_start);
        // Do NOT add offset here to ensure we start at the grid/start line
        raceStart.setSeconds(raceStart.getSeconds() + 0); 
        startTime = raceStart;
      } else {
        startTime.setMinutes(startTime.getMinutes() + 5);
      }

      const endTime = new Date(session.date_end);
      setSessionStartTime(startTime);
      setSessionEndTime(endTime);

      setCurrentReplayTime(startTime);
      replayTimeRef.current = startTime;

      const initialIntervals = await getHistoricalIntervals(session.session_key, startTime.toISOString(), 120);
      
      // Look back 5 minutes to find grid positions, and SORT them to get the latest update per driver
      const initialPositions = await getHistoricalPositions(session.session_key, startTime.toISOString(), 300);
      if (initialPositions && Array.isArray(initialPositions)) {
          initialPositions.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }
      
      if (controller.signal.aborted) return;

      setDrivers(prev => {
        const next = [...prev];
        initialPositions.forEach((pos: any) => {
           const idx = next.findIndex(d => d.id === pos.driver_number.toString());
           if (idx !== -1) {
             next[idx].position = pos.position;
           }
        });

        initialIntervals.forEach((int: any) => {
           const idx = next.findIndex(d => d.id === int.driver_number.toString());
           if (idx !== -1) {
              if (int.gap_to_leader !== null) next[idx].gapToLeader = parseFloat(int.gap_to_leader);
              if (int.interval !== null) next[idx].interval = parseFloat(int.interval);
           }
        });

        const leaderIdx = next.findIndex(d => d.position === 1);
        if (leaderIdx !== -1) {
            next[leaderIdx].gapToLeader = 0;
            next[leaderIdx].interval = 0;
        }

        return next.sort((a, b) => (a.position || 999) - (b.position || 999));
      });

      setIsPlaying(true);

      // Generate Track Map
      const validLapsForMap = allLaps.filter((l: any) => 
          l.lap_duration && 
          l.lap_duration < 200 && 
          l.lap_duration > 40
      );
      validLapsForMap.sort((a: any, b: any) => a.lap_duration - b.lap_duration);
      const referenceLap = validLapsForMap[0] || allLaps.find((l:any) => l.lap_number === 2);

      if (referenceLap && referenceLap.date_start) {
         const duration = referenceLap.lap_duration || 100;
         const mapStartDate = new Date(referenceLap.date_start).toISOString();
         const mapEndDate = new Date(new Date(referenceLap.date_start).getTime() + ((duration + 2) * 1000)).toISOString();

         const locations = await getLocations(
           session.session_key, 
           referenceLap.driver_number, 
           mapStartDate, 
           mapEndDate
         );

         if (locations.length > 0) {
           let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
           locations.forEach((pt: any) => {
             if (pt.x < minX) minX = pt.x;
             if (pt.x > maxX) maxX = pt.x;
             if (pt.y < minY) minY = pt.y;
             if (pt.y > maxY) maxY = pt.y;
           });

           const rangeX = maxX - minX;
           const rangeY = maxY - minY;
           const padding = 40;
           // SVG Viewbox is 800x800
           const scaleX = (800 - padding * 2) / rangeX;
           const scaleY = (800 - padding * 2) / rangeY;
           const scale = Math.min(scaleX, scaleY);
           const offsetX = (800 - rangeX * scale) / 2;
           const offsetY = (800 - rangeY * scale) / 2;

           const d = locations.map((pt: any, i: number) => {
              const x = (pt.x - minX) * scale + offsetX;
              const y = 800 - ((pt.y - minY) * scale + offsetY); // Invert Y for SVG
              return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
           }).join(' ');

           setTrackPath(`${d} Z`);
           setMapTransform({ minX, minY, scale, offsetX, offsetY });
         }
      }
    };

    initSession();
    return () => controller.abort();
  }, [session]);

  // 3. Playback Loop with AbortController for Clean Pause
  useEffect(() => {
    if (!isPlaying || !session) return;

    // Create an AbortController for this run.
    const controller = new AbortController();
    const signal = controller.signal;

    const tick = async () => {
      if (!replayTimeRef.current) return;

      const stepSeconds = 1 * playbackSpeed;
      const nextTime = new Date(replayTimeRef.current.getTime() + (stepSeconds * 1000));
      
      // Update ref immediately
      replayTimeRef.current = nextTime;
      setCurrentReplayTime(nextTime);

      loopCounterRef.current += 1;
      
      // Use shared fetch function (throttled updates = true)
      await fetchDataForTime(nextTime, signal, true);
    };

    const id = setInterval(tick, 1000); // 1 real second
    
    // Cleanup: Stop interval AND abort any pending fetch
    return () => {
      clearInterval(id);
      controller.abort();
    };

  }, [isPlaying, session, playbackSpeed, retiredDrivers, fetchDataForTime]); 

  // 4. Messages & Track Status
  useEffect(() => {
    if (!session || !currentReplayTime) return;

    const fetchMsgs = async () => {
      const msgs = await getRaceControlMessages(session.session_key);
      const validMsgs = msgs.filter((m: any) => new Date(m.date) <= currentReplayTime);
      const sorted = validMsgs.sort((a:any, b:any) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const formattedMsgs = sorted.slice(0, 50).map((m: any, idx: number) => ({
        id: idx,
        timestamp: new Date(m.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        message: m.message,
        flag: m.flag,
        type: 'INFO'
      }));
      setMessages(formattedMsgs);

      if (formattedMsgs.length > 0) {
        // --- PARSE RETIREMENTS ---
        const newRetired = new Set(retiredDrivers);
        let retiredChanged = false;

        formattedMsgs.forEach((msg: any) => {
           const text = msg.message.toUpperCase();
           // Only mark as OUT if explicitly retired or DNF
           // 'STOPPED' is removed to avoid false positives (e.g. spins, red flag stops)
           // Regex looks for "RETIRED", "DNF", or "OUT" followed by a number with optional "CAR/NO/DRIVER" prefix
           if (text.includes('RETIRED') || text.includes('DNF')) {
              const match = text.match(/(?:CAR|NO|DRIVER)?\s*(\d+)/);
              if (match && match[1]) {
                 if (!newRetired.has(match[1])) {
                    newRetired.add(match[1]);
                    retiredChanged = true;
                 }
              }
           }
        });

        if (retiredChanged) {
            setRetiredDrivers(newRetired);
        }

        const latestStatusMsg = formattedMsgs.find((m: any) => 
            /SAFETY CAR|VIRTUAL|RED FLAG|YELLOW FLAG|GREEN FLAG|TRACK CLEAR|RESUME/.test(m.message.toUpperCase())
        );

        if (latestStatusMsg) {
            const text = latestStatusMsg.message.toUpperCase();
            if (text.includes('SAFETY CAR') && !text.includes('ENDING')) setTrackStatus('SC');
            else if (text.includes('VIRTUAL') && !text.includes('ENDING')) setTrackStatus('VSC');
            else if (text.includes('RED') && !text.includes('CLEAR')) setTrackStatus('RED');
            else if (text.includes('YELLOW') && !text.includes('CLEAR')) setTrackStatus('YELLOW');
            else if (text.includes('GREEN') || text.includes('CLEAR') || text.includes('RESUME')) setTrackStatus('GREEN');
        }

        const drsMsg = formattedMsgs.find((m: any) => m.message.toUpperCase().includes('DRS'));
        if (drsMsg) {
            if (drsMsg.message.toUpperCase().includes('ENABLED')) setDrsEnabled(true);
            else if (drsMsg.message.toUpperCase().includes('DISABLED')) setDrsEnabled(false);
        }
      }
    };
    
    const interval = setInterval(fetchMsgs, 5000);
    return () => clearInterval(interval);

  }, [session, currentReplayTime]); 

  // --- Handlers ---

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const timestamp = Number(e.target.value);
    const newTime = new Date(timestamp);
    setIsPlaying(false); // Pause while dragging
    setCurrentReplayTime(newTime);
    replayTimeRef.current = newTime;
  };

  const handleSeekCommit = async () => {
     if (replayTimeRef.current) {
         // Trigger a fetch for the new time immediately
         const controller = new AbortController();
         await fetchDataForTime(replayTimeRef.current, controller.signal, false);
     }
  };

  const handleGoLive = () => {
     if (session) {
         const now = new Date();
         const buffer = new Date(now.getTime() - 30000); 
         setCurrentReplayTime(buffer);
         replayTimeRef.current = buffer;
         setPlaybackSpeed(1);
         setIsPlaying(true);
     }
  };

  const driversWithDrs = drivers.map(d => ({
      ...d,
      drsAvailable: drsEnabled && d.interval < 1.0 && d.position !== 1 && d.status === 'ACTIVE'
  }));

  const timeString = currentReplayTime ? currentReplayTime.toLocaleTimeString([], { hour12: false }) : '--:--:--';
  const displayLap = completedLaps >= totalLaps ? totalLaps : completedLaps + 1;

  return (
    <div className="flex flex-col h-screen bg-[#121212] text-neutral-200 overflow-hidden font-exo selection:bg-red-600 selection:text-white">
      
      {/* --- HEADER --- */}
      <header className="shrink-0 h-16 bg-[#121212] border-b border-[#2A2A2A] flex items-center justify-between px-6 z-20 shadow-md">
        <div className="flex items-center gap-6">
           <div className="font-orbitron font-bold text-2xl tracking-tight flex items-center gap-1">
             <span className="text-red-600 italic">Apex</span><span className="text-white">Live</span>
           </div>
           
           <div className="h-6 w-px bg-[#333]"></div>

           {/* View Navigation */}
           <div className="flex bg-[#1E1E1E] rounded-lg p-1 border border-[#333] gap-1 hidden md:flex">
             <button 
               onClick={() => setCurrentView('dashboard')}
               className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold font-exo uppercase transition-colors ${currentView === 'dashboard' ? 'bg-[#333] text-white' : 'text-neutral-500 hover:text-white'}`}
             >
               <LayoutDashboard size={14} /> Dashboard
             </button>
             <button 
               onClick={() => setCurrentView('telemetry')}
               className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold font-exo uppercase transition-colors ${currentView === 'telemetry' ? 'bg-[#333] text-white' : 'text-neutral-500 hover:text-white'}`}
             >
               <Activity size={14} /> Telemetry
             </button>
           </div>
           
           <div className="h-6 w-px bg-[#333] hidden md:block"></div>

           {/* Session Controls */}
           <div className="flex items-center gap-2 font-exo">
              <select 
                className="bg-[#1E1E1E] text-neutral-300 text-sm font-semibold px-3 py-1.5 rounded border border-[#333] outline-none focus:border-red-600 transition-colors uppercase max-w-[80px] sm:max-w-none"
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
              >
                 {AVAILABLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              
              <select 
                className="bg-[#1E1E1E] text-neutral-300 text-sm font-semibold px-3 py-1.5 rounded border border-[#333] outline-none focus:border-red-600 transition-colors max-w-[120px] sm:max-w-[200px] uppercase truncate"
                value={selectedMeetingKey || ''}
                onChange={e => setSelectedMeetingKey(Number(e.target.value))}
              >
                 <option value="">Select Grand Prix</option>
                 {Object.keys(meetings).map(k => (
                   <option key={k} value={k}>{meetings[Number(k)].name}</option>
                 ))}
              </select>
              
              <select 
                 className="bg-[#1E1E1E] text-neutral-300 text-sm font-semibold px-3 py-1.5 rounded border border-[#333] outline-none focus:border-red-600 transition-colors hidden xl:block uppercase"
                 value={session?.session_key || ''}
                 onChange={e => {
                    const s = allSessions.find(s => s.session_key === Number(e.target.value));
                    if(s) setSession(s);
                 }}
              >
                 <option value="">Select Session</option>
                 {selectedMeetingKey && meetings[selectedMeetingKey]?.sessions.map(s => (
                   <option key={s.session_key} value={s.session_key}>{s.session_name}</option>
                 ))}
              </select>
           </div>
        </div>

        {/* Live & Playback Controls */}
        <div className="flex items-center gap-4">
           {/* Timeline Slider (Visible when not live or not at head) */}
           {sessionStartTime && sessionEndTime && currentReplayTime && (
               <div className="hidden lg:flex flex-col justify-center w-48 xl:w-64 gap-1">
                   <input 
                     type="range" 
                     min={sessionStartTime.getTime()} 
                     max={sessionEndTime.getTime()} 
                     step={1000}
                     value={currentReplayTime.getTime()} 
                     onChange={handleSeek}
                     onMouseUp={handleSeekCommit}
                     className="w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-red-600 hover:accent-red-500"
                   />
                   <div className="flex justify-between text-[9px] text-neutral-500 font-exo font-bold uppercase">
                      <span>{sessionStartTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                      <span>{sessionEndTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                   </div>
               </div>
           )}

           {isSessionLive && (
               <div className="flex items-center gap-2">
                   {isAtLiveHead ? (
                       <div className="flex items-center gap-2 px-3 py-1 bg-red-600/10 border border-red-600/50 rounded animate-pulse">
                          <Radio size={14} className="text-red-500" />
                          <span className="text-xs font-bold text-red-500 font-orbitron tracking-widest">LIVE TIMING</span>
                       </div>
                   ) : (
                       <button 
                         onClick={handleGoLive}
                         className="flex items-center gap-2 px-3 py-1 bg-[#1E1E1E] border border-red-600 text-red-500 rounded hover:bg-red-600 hover:text-white transition-colors"
                       >
                          <Radio size={14} />
                          <span className="text-xs font-bold font-orbitron tracking-widest">GO LIVE</span>
                       </button>
                   )}
               </div>
           )}

           <div className={`flex items-center bg-[#1E1E1E] rounded p-1 gap-1 border border-[#333] ${isAtLiveHead ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
              <button 
                onClick={() => setIsPlaying(!isPlaying)} 
                className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${isPlaying ? 'text-red-500' : 'text-green-500 hover:bg-[#2A2A2A]'}`}
              >
                 {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
              </button>
              {PLAYBACK_SPEEDS.map(speed => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`text-xs font-bold px-3 h-8 rounded transition-colors uppercase font-exo ${playbackSpeed === speed ? 'bg-red-600 text-white' : 'text-neutral-500 hover:text-white hover:bg-[#2A2A2A]'}`}
                >
                  {speed}x
                </button>
              ))}
           </div>
        </div>
      </header>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 overflow-hidden p-4 bg-[#121212]">
         {currentView === 'dashboard' ? (
             <div className="grid grid-cols-12 gap-4 h-full">
                
                {/* LEFT COLUMN: Map & Environmental Data */}
                <div className="col-span-12 lg:col-span-8 flex flex-col gap-4 h-full min-h-0">
                   
                   {/* RACE TITLE ROW */}
                   <div className="flex justify-between items-end pb-2 border-b border-[#2A2A2A]">
                      <div>
                        <h1 className="text-3xl font-orbitron font-bold uppercase tracking-wide leading-none text-white">
                          {session?.session_name === 'Race' ? 'Race' : session?.session_name || 'NO SESSION'}
                        </h1>
                        <div className="text-neutral-500 font-exo font-medium text-lg mt-1 uppercase">
                          {session ? `${session.country_name} // Lap ${displayLap}/${totalLaps || '??'}` : '---'}
                        </div>
                      </div>
                      
                      <div className="flex gap-4">
                         <div className="bg-[#1E1E1E] border border-[#333] rounded px-4 py-2 min-w-[140px]">
                            <div className="text-[10px] uppercase text-neutral-500 font-bold tracking-wider font-orbitron">Session Clock</div>
                            <div className="text-2xl font-rajdhani font-bold tracking-wide text-white">{timeString}</div>
                         </div>
                         <div className={`px-6 py-2 rounded flex items-center justify-center min-w-[200px] font-orbitron font-bold text-2xl uppercase tracking-tighter ${
                            trackStatus === 'GREEN' ? 'bg-green-600 text-white' : 
                            trackStatus === 'RED' ? 'bg-red-600 text-white' : 
                            'bg-yellow-400 text-black'
                         }`}>
                            {trackStatus === 'SC' ? 'SAFETY CAR' : 
                             trackStatus === 'VSC' ? 'VIRTUAL SC' : 
                             trackStatus === 'RED' ? 'RED FLAG' : 
                             trackStatus === 'YELLOW' ? 'YELLOW FLAG' : 'TRACK CLEAR'}
                         </div>
                      </div>
                   </div>
    
                   {/* MAP AREA */}
                   <div className="flex-1 min-h-[300px] bg-[#1E1E1E] border border-[#2A2A2A] rounded-lg relative overflow-hidden shadow-lg">
                      <div className="absolute top-4 left-4 z-10">
                         <div className="text-xs font-bold text-neutral-400 uppercase tracking-widest bg-[#121212]/90 px-3 py-1.5 rounded backdrop-blur border border-[#333] font-orbitron">
                            Live Circuit Map
                         </div>
                      </div>
                      <TrackMap 
                        drivers={driversWithDrs} 
                        trackPath={trackPath} 
                        playbackSpeed={playbackSpeed}
                        driverCoordinates={driverCoordinates}
                        mapTransform={mapTransform} 
                      />
                   </div>
    
                   {/* WIDGETS ROW */}
                   <div className="h-60 shrink-0 grid grid-cols-12 gap-4">
                      <div className="col-span-12 md:col-span-5 h-full">
                         <IncidentFeed messages={messages} />
                      </div>
                      <div className="col-span-12 md:col-span-7 h-full">
                         <WeatherWidget weather={weather} />
                      </div>
                   </div>
                </div>
    
                {/* RIGHT COLUMN: Leaderboard */}
                <div className="col-span-12 lg:col-span-4 h-full min-h-0">
                   <LiveLeaderboard drivers={driversWithDrs} />
                </div>
    
             </div>
         ) : (
            // TELEMETRY VIEW
            session && currentReplayTime ? (
               <TelemetryDashboard 
                 sessionKey={session.session_key} 
                 currentTime={currentReplayTime} 
                 drivers={drivers}
                 isPlaying={isPlaying}
               />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-500 font-exo animate-pulse">
                   Load a session to view telemetry
                </div>
            )
         )}
      </main>
    </div>
  );
}