import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Driver, RaceControlMessage, TelemetryData, ChatMessage, OpenF1Session, WeatherData, TireCompound } from './types';
import LiveLeaderboard from './components/LiveLeaderboard';
import TelemetryDashboard from './components/TelemetryDashboard';
import LiveCircuit from './components/LiveCircuit';
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
  Radio,
  Timer,
  Flag,
  Map as MapIcon,
  Settings2,
  X
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
  const [currentView, setCurrentView] = useState<'dashboard' | 'telemetry' | 'circuit'>('dashboard');
  const [showMobileSettings, setShowMobileSettings] = useState(false);

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
  // Guard to prevent overlapping data fetches
  const isFetchingRef = useRef(false);
  
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
    const now = new Date();
    const end = new Date(session.date_end);
    const isLive = now >= new Date(session.date_start) && now <= new Date(end.getTime() + 1000 * 60 * 60 * 2);
    setIsSessionLive(isLive);

    // Are we at the "Head" of the live stream? (within 60s of real time)
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
      
      // FIX: Look at the immediate PAST ([T-1.1s, T]) instead of future to ensure accuracy
      // This ensures we only render what has definitively happened.
      const windowSeconds = 1.1; 
      const fetchTime = new Date(time.getTime() - (windowSeconds * 1000));
      const isoTime = fetchTime.toISOString();
      
      try {
        const promises: Promise<any>[] = [
           getPositionsAtTime(session.session_key, isoTime, windowSeconds, signal), 
           getIntervalsAtTime(session.session_key, isoTime, windowSeconds, signal),
        ];
        
        // Only fetch weather occasionally or on forced updates (seek)
        if (!isThrottledUpdate || loopCounterRef.current % 300 === 0) {
           promises.push(getWeather(session.session_key, isoTime, windowSeconds, signal));
        }
  
        const results = await Promise.all(promises);
        
        if (signal.aborted) return;
  
        // SORTING IS CRITICAL for correctness when multiple packets arrive
        const positions = results[0].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const intervals = results[1].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const weatherData = (!isThrottledUpdate || loopCounterRef.current % 300 === 0) ? results[2] : null;
        
        if (weatherData && weatherData.length > 0) {
           setWeather(weatherData[weatherData.length - 1]);
        }

        setDrivers(prev => {
          // CRITICAL FIX: Create a shallow copy of objects to avoid mutating state directly
          const newDrivers = prev.map(d => ({ ...d }));
          
          positions.forEach((pos: any) => {
            const driver = newDrivers.find(d => d.id === pos.driver_number.toString());
            // Only update if we have a valid position
            if (driver && pos.position) {
              driver.position = pos.position;
            }
          });
  
          intervals.forEach((int: any) => {
            const driver = newDrivers.find(d => d.id === int.driver_number.toString());
            if (driver) {
              if (int.gap_to_leader !== null && int.gap_to_leader !== undefined) driver.gapToLeader = parseFloat(int.gap_to_leader);
              if (int.interval !== null && int.interval !== undefined) driver.interval = parseFloat(int.interval);
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
                 d.interval = 0; // Clear interval for DNF
                 d.gapToLeader = 0;
             } else {
                 d.status = 'ACTIVE';
             }
          });
  
          return newDrivers.sort((a, b) => {
             // Put retired drivers at the bottom
             if (a.status === 'OUT' && b.status !== 'OUT') return 1;
             if (a.status !== 'OUT' && b.status === 'OUT') return -1;
             
             // Sort by position
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
      setSessionStartTime(null);
      setSessionEndTime(null);
      
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
      setCompletedLaps(0);
      setTotalLaps(0);
      setRetiredDrivers(new Set());
      sessionLapsRef.current = [];
      sessionStintsRef.current = [];
      
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
        startTime = new Date(lap1s[0].date_start);
      } else {
        startTime.setMinutes(startTime.getMinutes() + 5);
      }

      // Extend session end time by 20 minutes
      const endTime = new Date(new Date(session.date_end).getTime() + 20 * 60000);
      
      setSessionStartTime(startTime);
      setSessionEndTime(endTime);

      setCurrentReplayTime(startTime);
      replayTimeRef.current = startTime;

      // Look back further for grid positions (10 mins)
      const initialPositions = await getHistoricalPositions(session.session_key, startTime.toISOString(), 600);
      const initialIntervals = await getHistoricalIntervals(session.session_key, startTime.toISOString(), 60);
      
      if (initialPositions && Array.isArray(initialPositions)) {
          initialPositions.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }
      
      if (controller.signal.aborted) return;

      setDrivers(prev => {
        const next = prev.map(d => ({...d}));
        // Apply historical positions
        initialPositions.forEach((pos: any) => {
           const d = next.find(d => d.id === pos.driver_number.toString());
           if (d) {
             d.position = pos.position;
           }
        });

        initialIntervals.forEach((int: any) => {
           const d = next.find(d => d.id === int.driver_number.toString());
           if (d) {
              if (int.gap_to_leader !== null) d.gapToLeader = parseFloat(int.gap_to_leader);
              if (int.interval !== null) d.interval = parseFloat(int.interval);
           }
        });

        const leader = next.find(d => d.position === 1);
        if (leader) {
            leader.gapToLeader = 0;
            leader.interval = 0;
        }

        return next.sort((a, b) => (a.position || 999) - (b.position || 999));
      });

      setIsPlaying(true);
    };

    initSession();
    return () => controller.abort();
  }, [session]);

  // 3. Playback Loop
  useEffect(() => {
    if (!isPlaying || !session) return;

    const controller = new AbortController();
    const signal = controller.signal;

    const tick = async () => {
      if (!replayTimeRef.current) return;

      const updateIntervalMs = 100;
      const raceTimeDeltaSeconds = playbackSpeed * (updateIntervalMs / 1000);
      
      const nextTime = new Date(replayTimeRef.current.getTime() + (raceTimeDeltaSeconds * 1000));
      
      replayTimeRef.current = nextTime;
      setCurrentReplayTime(nextTime);

      loopCounterRef.current += 1;
      
      // Fetch data every 1 real second
      if (loopCounterRef.current % 10 === 0) {
          if (!isFetchingRef.current) {
             isFetchingRef.current = true;
             fetchDataForTime(nextTime, signal, true)
                .finally(() => {
                   isFetchingRef.current = false;
                });
          }
      }
    };

    const id = setInterval(tick, 100); 
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
        type: 'INFO',
        driver_number: m.driver_number
      }));
      setMessages(formattedMsgs);

      if (formattedMsgs.length > 0) {
        const newRetired = new Set(retiredDrivers);
        let retiredChanged = false;

        formattedMsgs.forEach((msg: any) => {
           const text = msg.message.toUpperCase();
           // Enhanced Retirement Detection
           if (text.includes('RETIRED') || text.includes('DNF') || text.includes('STOPPED') || text.includes('WITHDRAWN')) {
              // Extract Driver Number from text or msg object
              let targetId = null;
              if (msg.driver_number) {
                 targetId = msg.driver_number.toString();
              } else {
                 // Try to match "Car 14", "No. 14", "Driver 14"
                 const numberMatch = text.match(/(?:CAR|NO\.?|DRIVER)\s*(\d+)/i);
                 if (numberMatch && numberMatch[1]) {
                    targetId = numberMatch[1];
                 }
              }

              // Verify this is a valid driver in our session
              if (targetId) {
                  const isValidDriver = drivers.some(d => d.id === targetId);
                  if (isValidDriver && !newRetired.has(targetId)) {
                      newRetired.add(targetId);
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
    setIsPlaying(false); 
    setCurrentReplayTime(newTime);
    replayTimeRef.current = newTime;
  };

  const handleSeekCommit = async () => {
     if (replayTimeRef.current && session) {
        const isoTime = replayTimeRef.current.toISOString();
        const controller = new AbortController();

        const [positions, intervals] = await Promise.all([
             getHistoricalPositions(session.session_key, isoTime, 300),
             getHistoricalIntervals(session.session_key, isoTime, 120)
        ]);
        
        // Fix: Sort historical data by date to ensure we apply the state in correct order
        if (positions) positions.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        const posMap = new Map();
        positions.forEach((p: any) => posMap.set(p.driver_number.toString(), p.position));

        const intMap = new Map();
        intervals.forEach((i: any) => {
            intMap.set(i.driver_number.toString(), {
                gap: i.gap_to_leader,
                int: i.interval
            });
        });

        setDrivers(prev => {
            const next = prev.map(d => ({ ...d })); // Immutable map
            next.forEach(d => {
                const newPos = posMap.get(d.id);
                const newInt = intMap.get(d.id);

                if (newPos !== undefined) d.position = newPos;
                if (newInt?.gap !== undefined && newInt.gap !== null) d.gapToLeader = parseFloat(newInt.gap);
                if (newInt?.int !== undefined && newInt.int !== null) d.interval = parseFloat(newInt.int);
                
                d.currentSector1 = 0;
                d.currentSector2 = 0;
                d.currentSector3 = 0;
            });
            return next.sort((a, b) => (a.position || 999) - (b.position || 999));
        });

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
    <div className="flex flex-col h-[100dvh] bg-[#0A0A0A] text-neutral-200 overflow-hidden font-exo selection:bg-red-600 selection:text-white relative">
      
      {/* --- HEADER --- */}
      <header className="shrink-0 h-14 bg-[#111] border-b border-[#222] flex items-center justify-between px-3 md:px-4 z-20 shadow-lg relative">
        <div className="flex items-center gap-4 md:gap-6">
           <div className="font-orbitron font-black text-xl tracking-tighter flex items-center gap-1 select-none">
             <span className="text-red-600 italic">APEX</span><span className="text-white">LIVE</span>
           </div>
           
           <div className="h-4 w-px bg-[#333] hidden md:block"></div>

           {/* Desktop Navigation */}
           <div className="flex gap-1 hidden md:flex">
             <button 
               onClick={() => setCurrentView('dashboard')}
               className={`flex items-center gap-2 px-3 py-1.5 rounded text-[10px] font-bold font-exo uppercase tracking-wider transition-all ${currentView === 'dashboard' ? 'bg-[#222] text-white border border-[#333]' : 'text-neutral-500 hover:text-white border border-transparent'}`}
             >
               <LayoutDashboard size={12} /> Dashboard
             </button>
             <button 
               onClick={() => setCurrentView('telemetry')}
               className={`flex items-center gap-2 px-3 py-1.5 rounded text-[10px] font-bold font-exo uppercase tracking-wider transition-all ${currentView === 'telemetry' ? 'bg-[#222] text-white border border-[#333]' : 'text-neutral-500 hover:text-white border border-transparent'}`}
             >
               <Activity size={12} /> Telemetry
             </button>
             <button 
               onClick={() => setCurrentView('circuit')}
               className={`flex items-center gap-2 px-3 py-1.5 rounded text-[10px] font-bold font-exo uppercase tracking-wider transition-all ${currentView === 'circuit' ? 'bg-[#222] text-white border border-[#333]' : 'text-neutral-500 hover:text-white border border-transparent'}`}
             >
               <MapIcon size={12} /> Circuit
             </button>
           </div>
           
           <div className="h-4 w-px bg-[#333] hidden md:block"></div>

           {/* Desktop Selectors (Hidden on Mobile) */}
           <div className="hidden md:flex items-center gap-2 font-exo">
              <select 
                className="bg-[#111] text-neutral-300 text-xs font-bold px-2 py-1 rounded border border-[#333] outline-none focus:border-red-600 transition-colors uppercase cursor-pointer hover:bg-[#1a1a1a]"
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
              >
                 {AVAILABLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              
              <select 
                className="bg-[#111] text-neutral-300 text-xs font-bold px-2 py-1 rounded border border-[#333] outline-none focus:border-red-600 transition-colors max-w-[160px] uppercase truncate cursor-pointer hover:bg-[#1a1a1a]"
                value={selectedMeetingKey || ''}
                onChange={e => setSelectedMeetingKey(Number(e.target.value))}
              >
                 <option value="">Select Grand Prix</option>
                 {Object.keys(meetings).map(k => (
                   <option key={k} value={k}>{meetings[Number(k)].name}</option>
                 ))}
              </select>
              
              <select 
                 className="bg-[#111] text-neutral-300 text-xs font-bold px-2 py-1 rounded border border-[#333] outline-none focus:border-red-600 transition-colors uppercase cursor-pointer hover:bg-[#1a1a1a] max-w-[160px] truncate"
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

        {/* Controls */}
        <div className="flex items-center gap-4">
           {sessionStartTime && sessionEndTime && currentReplayTime && (
               <div className="hidden lg:flex flex-col justify-center w-64 gap-1 group">
                   <div className="relative h-1 bg-neutral-800 rounded-full overflow-hidden">
                      <div className="absolute top-0 bottom-0 left-0 bg-red-600" style={{ width: `${((currentReplayTime.getTime() - sessionStartTime.getTime()) / (sessionEndTime.getTime() - sessionStartTime.getTime())) * 100}%`}}></div>
                   </div>
                   <input 
                     type="range" 
                     min={sessionStartTime.getTime()} 
                     max={sessionEndTime.getTime()} 
                     step={1000}
                     value={currentReplayTime.getTime()} 
                     onChange={handleSeek}
                     onMouseUp={handleSeekCommit}
                     className="absolute w-64 h-4 opacity-0 cursor-pointer"
                   />
                   <div className="flex justify-between text-[9px] text-neutral-600 font-exo font-bold uppercase group-hover:text-neutral-400 transition-colors">
                      <span>{sessionStartTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                      <span>{sessionEndTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                   </div>
               </div>
           )}

           {isSessionLive && (
               <div className="flex items-center gap-2">
                   {isAtLiveHead ? (
                       <div className="flex items-center gap-2 px-3 py-1 bg-red-900/20 border border-red-500/30 rounded animate-pulse">
                          <Radio size={12} className="text-red-500" />
                          <span className="text-[10px] font-bold text-red-500 font-orbitron tracking-widest hidden sm:inline">LIVE</span>
                       </div>
                   ) : (
                       <button 
                         onClick={handleGoLive}
                         className="flex items-center gap-2 px-3 py-1 bg-[#222] border border-red-600 text-red-500 rounded hover:bg-red-600 hover:text-white transition-colors"
                       >
                          <Radio size={12} />
                          <span className="text-[10px] font-bold font-orbitron tracking-widest hidden sm:inline">GO LIVE</span>
                       </button>
                   )}
               </div>
           )}

           <div className={`flex items-center bg-[#111] rounded p-0.5 gap-0.5 border border-[#222] ${isAtLiveHead ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
              <button 
                onClick={() => setIsPlaying(!isPlaying)} 
                className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${isPlaying ? 'text-red-500 hover:bg-[#1a1a1a]' : 'text-green-500 hover:bg-[#1a1a1a]'}`}
              >
                 {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              </button>
              {PLAYBACK_SPEEDS.map(speed => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`text-[9px] font-bold px-2 h-7 rounded transition-colors uppercase font-exo hidden sm:block ${playbackSpeed === speed ? 'bg-[#333] text-white' : 'text-neutral-600 hover:text-neutral-300 hover:bg-[#1a1a1a]'}`}
                >
                  {speed}x
                </button>
              ))}
           </div>

           {/* Mobile Settings Toggle */}
           <button 
             className="md:hidden p-2 text-neutral-400 hover:text-white"
             onClick={() => setShowMobileSettings(!showMobileSettings)}
           >
             {showMobileSettings ? <X size={20} /> : <Settings2 size={20} />}
           </button>
        </div>
      </header>

      {/* Mobile Settings Panel */}
      {showMobileSettings && (
        <div className="absolute top-14 left-0 w-full bg-[#0F0F0F] border-b border-[#222] z-50 p-4 flex flex-col gap-4 shadow-2xl animate-in slide-in-from-top-5 md:hidden">
             <div className="flex justify-between items-center border-b border-[#222] pb-2">
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest font-orbitron flex items-center gap-2">
                    <Settings2 size={12} className="text-red-600" /> Session Configuration
                </h3>
                <button onClick={() => setShowMobileSettings(false)} className="text-neutral-500 hover:text-white"><X size={16} /></button>
             </div>
             
             <div className="grid grid-cols-2 gap-3">
                 <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-neutral-600 uppercase tracking-wider">Season</label>
                    <select 
                        className="bg-[#1a1a1a] text-white text-sm font-bold px-3 py-3 rounded border border-[#333] outline-none focus:border-red-600 uppercase"
                        value={selectedYear}
                        onChange={e => { setSelectedYear(Number(e.target.value)); }}
                    >
                        {AVAILABLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                 </div>
                 <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-neutral-600 uppercase tracking-wider">Session Type</label>
                    <select 
                         className="bg-[#1a1a1a] text-white text-sm font-bold px-3 py-3 rounded border border-[#333] outline-none focus:border-red-600 uppercase truncate"
                         value={session?.session_key || ''}
                         onChange={e => {
                            const s = allSessions.find(s => s.session_key === Number(e.target.value));
                            if(s) setSession(s);
                            setShowMobileSettings(false);
                         }}
                    >
                         <option value="">Select Session</option>
                         {selectedMeetingKey && meetings[selectedMeetingKey]?.sessions.map(s => (
                           <option key={s.session_key} value={s.session_key}>{s.session_name}</option>
                         ))}
                    </select>
                 </div>
             </div>

             <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-neutral-600 uppercase tracking-wider">Grand Prix</label>
                <select 
                    className="bg-[#1a1a1a] text-white text-sm font-bold px-3 py-3 rounded border border-[#333] outline-none focus:border-red-600 uppercase"
                    value={selectedMeetingKey || ''}
                    onChange={e => { setSelectedMeetingKey(Number(e.target.value)); }}
                >
                    <option value="">Select Grand Prix</option>
                    {Object.keys(meetings).map(k => (
                        <option key={k} value={k}>{meetings[Number(k)].name}</option>
                    ))}
                </select>
             </div>
        </div>
      )}

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 overflow-hidden p-2 md:p-3 bg-[#0A0A0A] pb-20 md:pb-3 relative z-10">
         {currentView === 'dashboard' ? (
             <div className="flex flex-col lg:flex-row gap-3 h-full">
                
                {/* 1. LEFT COLUMN: LEADERBOARD (Broadcast Style) */}
                {/* Fixed widths for better table stability on large screens, Full width on Mobile */}
                <div className="w-full lg:w-[380px] xl:w-[450px] shrink-0 h-[40%] lg:h-full min-h-0 flex flex-col transition-all duration-300">
                   <LiveLeaderboard drivers={driversWithDrs} />
                </div>

                {/* 2. RIGHT COLUMN: MAIN FEED & STATS */}
                <div className="flex-1 h-full min-h-0 flex flex-col gap-3 min-w-0">
                   
                   {/* 2a. Session Header Info (Hide on mobile landscape if needed, but keep for now) */}
                   <div className="bg-[#111] border border-[#222] rounded-lg p-3 md:p-4 flex items-center justify-between shadow-lg shrink-0">
                      <div className="flex flex-col min-w-0">
                         <div className="flex items-center gap-2 mb-1">
                            <span className="w-1.5 h-4 md:h-6 bg-red-600 block rounded-sm"></span>
                            <h1 className="text-lg md:text-2xl font-orbitron font-black uppercase tracking-tight text-white leading-none truncate">
                              {session?.session_name || 'NO SESSION'}
                            </h1>
                         </div>
                         <div className="text-neutral-500 font-exo font-bold text-xs md:text-sm uppercase tracking-wider pl-3.5 truncate">
                            {session ? `${session.country_name} // ${session.year}` : '---'}
                         </div>
                      </div>

                      <div className="flex items-center gap-2 md:gap-4 ml-4">
                         {/* Lap Counter */}
                         <div className="flex flex-col items-end">
                            <span className="text-[8px] md:text-[10px] text-neutral-500 uppercase font-bold tracking-wider font-orbitron">Lap</span>
                            <div className="flex items-baseline gap-1">
                               <span className="text-xl md:text-3xl font-rajdhani font-bold text-white">{displayLap}</span>
                               <span className="text-sm md:text-lg font-rajdhani font-medium text-neutral-600">/ {totalLaps || '--'}</span>
                            </div>
                         </div>
                         
                         <div className="w-px h-8 md:h-10 bg-[#222] hidden sm:block"></div>

                         {/* Timer */}
                         <div className="flex flex-col items-end min-w-[70px] md:min-w-[100px] hidden sm:flex">
                            <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider font-orbitron flex items-center gap-1"><Timer size={10} /> Time</span>
                            <span className="text-xl md:text-3xl font-rajdhani font-bold text-white tabular-nums">{timeString}</span>
                         </div>

                         {/* Status Flag */}
                         <div className={`h-8 md:h-12 px-2 md:px-6 rounded flex items-center justify-center gap-2 md:gap-3 font-orbitron font-bold text-sm md:text-xl uppercase tracking-tighter shadow-inner ${
                            trackStatus === 'GREEN' ? 'bg-green-600/10 text-green-500 border border-green-600/30' : 
                            trackStatus === 'RED' ? 'bg-red-600 text-white animate-pulse' : 
                            'bg-yellow-500 text-black animate-pulse'
                         }`}>
                            <Flag size={16} className="md:w-5 md:h-5" fill="currentColor" />
                            <span className="hidden sm:inline">
                            {trackStatus === 'SC' ? 'SAFETY CAR' : 
                             trackStatus === 'VSC' ? 'VIRTUAL SC' : 
                             trackStatus === 'RED' ? 'RED FLAG' : 
                             trackStatus === 'YELLOW' ? 'YELLOW FLAG' : 'GREEN'}
                            </span>
                            {/* Mobile Abbr */}
                            <span className="sm:hidden">
                            {trackStatus === 'SC' ? 'SC' : 
                             trackStatus === 'VSC' ? 'VSC' : 
                             trackStatus === 'RED' ? 'RED' : 
                             trackStatus === 'YELLOW' ? 'YEL' : 'GRN'}
                            </span>
                         </div>
                      </div>
                   </div>

                   {/* 2b. Main Content Split */}
                   <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-rows-12 gap-3">
                      {/* Incident Feed */}
                      <div className="flex-1 md:row-span-8 bg-[#111] border border-[#222] rounded-lg overflow-hidden flex flex-col shadow-lg relative min-h-[150px]">
                         <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-red-600 to-transparent opacity-50"></div>
                         <IncidentFeed messages={messages} />
                      </div>
                      
                      {/* Weather & Tire Stats */}
                      <div className="h-24 md:row-span-4 md:h-auto bg-[#111] border border-[#222] rounded-lg overflow-hidden shadow-lg shrink-0">
                         <WeatherWidget weather={weather} />
                      </div>
                   </div>
                </div>
    
             </div>
         ) : currentView === 'telemetry' ? (
            // TELEMETRY VIEW
            session && currentReplayTime ? (
               <div className="h-full overflow-y-auto lg:overflow-hidden">
                   <TelemetryDashboard 
                     sessionKey={session.session_key} 
                     currentTime={currentReplayTime} 
                     drivers={drivers}
                     isPlaying={isPlaying}
                   />
               </div>
            ) : (
                <div className="w-full h-full flex items-center justify-center flex-col gap-4 text-neutral-600 font-exo">
                   <Activity size={48} className="opacity-20" />
                   <span className="animate-pulse">Load a session to view telemetry</span>
                </div>
            )
         ) : (
            // CIRCUIT VIEW
            session && currentReplayTime ? (
               <LiveCircuit 
                  session={session}
                  currentTime={currentReplayTime}
                  drivers={drivers}
                  playbackSpeed={playbackSpeed}
               />
            ) : (
               <div className="w-full h-full flex items-center justify-center flex-col gap-4 text-neutral-600 font-exo">
                  <MapIcon size={48} className="opacity-20" />
                  <span className="animate-pulse">Load a session to view circuit map</span>
               </div>
            )
         )}
      </main>

      {/* --- BOTTOM NAVIGATION (MOBILE ONLY) --- */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#111] border-t border-[#222] flex items-center justify-around z-50 pb-safe">
         <button 
           onClick={() => setCurrentView('dashboard')}
           className={`flex flex-col items-center gap-1 p-2 ${currentView === 'dashboard' ? 'text-white' : 'text-neutral-600'}`}
         >
           <LayoutDashboard size={20} className={currentView === 'dashboard' ? 'stroke-red-600' : ''} />
           <span className="text-[10px] font-bold font-exo uppercase tracking-wide">Dash</span>
         </button>
         <button 
           onClick={() => setCurrentView('telemetry')}
           className={`flex flex-col items-center gap-1 p-2 ${currentView === 'telemetry' ? 'text-white' : 'text-neutral-600'}`}
         >
           <Activity size={20} className={currentView === 'telemetry' ? 'stroke-red-600' : ''} />
           <span className="text-[10px] font-bold font-exo uppercase tracking-wide">Data</span>
         </button>
         <button 
           onClick={() => setCurrentView('circuit')}
           className={`flex flex-col items-center gap-1 p-2 ${currentView === 'circuit' ? 'text-white' : 'text-neutral-600'}`}
         >
           <MapIcon size={20} className={currentView === 'circuit' ? 'stroke-red-600' : ''} />
           <span className="text-[10px] font-bold font-exo uppercase tracking-wide">Map</span>
         </button>
      </nav>
    </div>
  );
}