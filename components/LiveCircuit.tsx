import React, { useState, useEffect, useRef } from 'react';
import TrackMap from './TrackMap';
import { Driver, OpenF1Session } from '../types';
import { getLaps, getLocations, getLocationsAtTime, getCarData } from '../services/openf1Service';

interface LiveCircuitProps {
  session: OpenF1Session;
  currentTime: Date;
  drivers: Driver[];
  playbackSpeed: number;
}

// Helper: Linear Interpolation
const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

const LiveCircuit: React.FC<LiveCircuitProps> = ({ session, currentTime, drivers, playbackSpeed }) => {
  const [trackPath, setTrackPath] = useState<string | null>(null);
  const [mapTransform, setMapTransform] = useState<{ minX: number, minY: number, scale: number, offsetX: number, offsetY: number } | null>(null);
  const [driverCoordinates, setDriverCoordinates] = useState<Record<string, { x: number, y: number }>>({});
  const [startLineCoords, setStartLineCoords] = useState<{ x: number, y: number } | null>(null);
  const [loadingMap, setLoadingMap] = useState(false);
  
  // Followed Driver State
  const [activeDriverId, setActiveDriverId] = useState<string | null>(null);
  const [activeDriverTelemetry, setActiveDriverTelemetry] = useState<{ speed: number; gear: number; throttle: number; brake: number; rpm: number } | null>(null);
  
  // Buffer to hold location packets for interpolation
  // Structure: { [driverId]: [{ x, y, date (ms) }, ...] }
  const locationBuffer = useRef<Record<string, { x: number, y: number, date: number }[]>>({});
  const lastFetchTime = useRef<number>(0);
  
  // Buffer for Telemetry (Followed Driver)
  const telemetryBuffer = useRef<{ date: number, speed: number, gear: number, throttle: number, brake: number, rpm: number }[]>([]);
  const lastTelemetryFetchTime = useRef<number>(0);

  // Refs to prevent stale closures
  const latestProps = useRef({ session, currentTime, activeDriverId });
  useEffect(() => { latestProps.current = { session, currentTime, activeDriverId }; }, [session, currentTime, activeDriverId]);

  // 1. Generate Static Track Map
  useEffect(() => {
    let isMounted = true;
    
    const generateMap = async () => {
      if (!session) return;
      setLoadingMap(true);

      try {
        // 1. Get a completed lap (Lap 2 is usually good and clean)
        let referenceLap = null;
        const potentialDrivers = ['1', '16', '55', '4', '81', '44', '63']; // VER, LEC, SAI, NOR, PIA, HAM, RUS
        
        for (const dId of potentialDrivers) {
            const laps = await getLaps(session.session_key, dId);
            const validLap = laps.find((l: any) => l.lap_number === 2 && l.duration_sector_1); 
            if (validLap) {
                referenceLap = validLap;
                break;
            }
        }
        
        if (!referenceLap) {
            const allLaps = await getLaps(session.session_key);
            referenceLap = allLaps.find((l: any) => l.lap_number === 2);
        }

        if (!referenceLap && isMounted) {
            console.warn("No reference lap found for map generation.");
            setLoadingMap(false);
            return;
        }

        // 2. Fetch locations for this lap
        const locations = await getLocations(
            session.session_key, 
            referenceLap.driver_number, 
            referenceLap.date_start, 
            new Date(new Date(referenceLap.date_start).getTime() + (referenceLap.lap_duration * 1000) + 5000).toISOString()
        );

        if (!locations || locations.length === 0) return;

        // 3. Calculate Bounding Box
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        locations.forEach((loc: any) => {
            if (loc.x < minX) minX = loc.x;
            if (loc.x > maxX) maxX = loc.x;
            if (loc.y < minY) minY = loc.y;
            if (loc.y > maxY) maxY = loc.y;
        });

        // 4. Generate Path & Transform
        const VIEWBOX_SIZE = 800;
        const PADDING = 60;
        
        const width = maxX - minX;
        const height = maxY - minY;
        const scale = Math.min((VIEWBOX_SIZE - PADDING * 2) / width, (VIEWBOX_SIZE - PADDING * 2) / height);
        
        const offsetX = (VIEWBOX_SIZE - width * scale) / 2;
        const offsetY = (VIEWBOX_SIZE - height * scale) / 2;

        const pathData = locations.map((loc: any, i: number) => {
            const x = (loc.x - minX) * scale + offsetX;
            const y = 800 - ((loc.y - minY) * scale + offsetY); 
            return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
        }).join(' ');
        
        const finalPath = `${pathData} Z`;

        if (isMounted) {
            setTrackPath(finalPath);
            setMapTransform({ minX, minY, scale, offsetX, offsetY });
            setStartLineCoords({ x: locations[0].x, y: locations[0].y });
            setLoadingMap(false);
        }

      } catch (e) {
          console.error("Error generating map:", e);
          if (isMounted) setLoadingMap(false);
      }
    };

    generateMap();

    return () => { isMounted = false; };
  }, [session?.session_key]);

  // 2. Data Fetching Loop (Buffering) - LOCATIONS
  useEffect(() => {
    let isMounted = true;
    
    const fetchBatch = async () => {
        const { session, currentTime } = latestProps.current;
        if (!session || !currentTime || !mapTransform) return;

        const nowMs = currentTime.getTime();
        if (nowMs - lastFetchTime.current < 1000) return; // Max 1 fetch per sec
        
        try {
            lastFetchTime.current = nowMs;
            const fetchStart = new Date(nowMs - 1000).toISOString();
            const data = await getLocationsAtTime(session.session_key, fetchStart, 4);

            if (!isMounted) return;

            // Process into buffer
            data.forEach((d: any) => {
                const dId = d.driver_number.toString();
                if (!locationBuffer.current[dId]) locationBuffer.current[dId] = [];
                
                const timestamp = new Date(d.date).getTime();
                const existing = locationBuffer.current[dId].find(p => p.date === timestamp);
                if (!existing) {
                    locationBuffer.current[dId].push({
                        x: d.x,
                        y: d.y,
                        date: timestamp
                    });
                }
            });

            // Clean Buffer
            Object.keys(locationBuffer.current).forEach(dId => {
                locationBuffer.current[dId].sort((a, b) => a.date - b.date);
                const cutoff = nowMs - 2000;
                locationBuffer.current[dId] = locationBuffer.current[dId].filter(p => p.date > cutoff);
            });

        } catch (e) {
            console.error("Loc fetch error", e);
        }
    };

    const interval = setInterval(fetchBatch, 1000); 
    fetchBatch(); 

    return () => {
        isMounted = false;
        clearInterval(interval);
    };
  }, [session, mapTransform]);

  // 3. Telemetry Fetching Loop (For Active Driver)
  useEffect(() => {
    let isMounted = true;

    const fetchTelemetry = async () => {
       const { session, currentTime, activeDriverId } = latestProps.current;
       if (!session || !currentTime || !activeDriverId) {
          if (!activeDriverId) setActiveDriverTelemetry(null);
          return;
       }

       const nowMs = currentTime.getTime();
       // Fetch every 250ms for telemetry
       if (nowMs - lastTelemetryFetchTime.current < 250) return;

       try {
          lastTelemetryFetchTime.current = nowMs;
          // Fetch small window around now (past 1s, future 2s)
          const data = await getCarData(session.session_key, activeDriverId, new Date(nowMs + 2000).toISOString(), 3);
          
          if (!isMounted) return;

          // Merge into buffer
          data.forEach(d => {
              const ts = new Date(d.date).getTime();
              if (!telemetryBuffer.current.find(p => p.date === ts)) {
                 telemetryBuffer.current.push({
                     date: ts,
                     speed: d.speed,
                     rpm: d.rpm,
                     gear: d.gear,
                     throttle: d.throttle,
                     brake: d.brake
                 });
              }
          });

          // Clean buffer
          telemetryBuffer.current.sort((a,b) => a.date - b.date);
          const cutoff = nowMs - 3000;
          telemetryBuffer.current = telemetryBuffer.current.filter(p => p.date > cutoff);

       } catch (e) {
          // ignore
       }
    };

    const interval = setInterval(fetchTelemetry, 250);
    fetchTelemetry();

    return () => {
        isMounted = false;
        clearInterval(interval);
        telemetryBuffer.current = []; // Clear buffer on unmount/id change
    };
  }, [activeDriverId, session]);

  // 4. Animation Loop (Interpolation)
  useEffect(() => {
      let rafId: number;

      const animate = () => {
          const { currentTime, activeDriverId } = latestProps.current;
          const targetTime = currentTime.getTime();
          
          // --- LOCATION INTERPOLATION ---
          const newCoords: Record<string, { x: number, y: number }> = {};
          Object.keys(locationBuffer.current).forEach(dId => {
              const points = locationBuffer.current[dId];
              if (points.length < 2) return;

              let idx = -1;
              for (let i = 0; i < points.length - 1; i++) {
                  if (points[i].date <= targetTime && points[i+1].date > targetTime) {
                      idx = i;
                      break;
                  }
              }

              if (idx !== -1) {
                  const p1 = points[idx];
                  const p2 = points[idx+1];
                  const total = p2.date - p1.date;
                  const elapsed = targetTime - p1.date;
                  const factor = Math.max(0, Math.min(1, elapsed / total));
                  newCoords[dId] = { x: lerp(p1.x, p2.x, factor), y: lerp(p1.y, p2.y, factor) };
              } else {
                  if (points[0].date > targetTime) newCoords[dId] = { x: points[0].x, y: points[0].y };
                  else if (points[points.length-1].date < targetTime) {
                      const last = points[points.length-1];
                      newCoords[dId] = { x: last.x, y: last.y };
                  }
              }
          });

          if (Object.keys(newCoords).length > 0) {
              setDriverCoordinates(newCoords);
          }

          // --- TELEMETRY INTERPOLATION ---
          if (activeDriverId && telemetryBuffer.current.length > 1) {
              const tPoints = telemetryBuffer.current;
              let tIdx = -1;
              for (let i = 0; i < tPoints.length - 1; i++) {
                  if (tPoints[i].date <= targetTime && tPoints[i+1].date > targetTime) {
                      tIdx = i;
                      break;
                  }
              }

              if (tIdx !== -1) {
                  const p1 = tPoints[tIdx];
                  const p2 = tPoints[tIdx+1];
                  const total = p2.date - p1.date;
                  const elapsed = targetTime - p1.date;
                  const factor = Math.max(0, Math.min(1, elapsed / total));

                  setActiveDriverTelemetry({
                      speed: Math.round(lerp(p1.speed, p2.speed, factor)),
                      rpm: Math.round(lerp(p1.rpm, p2.rpm, factor)),
                      throttle: Math.round(lerp(p1.throttle, p2.throttle, factor)),
                      brake: Math.round(lerp(p1.brake, p2.brake, factor)),
                      gear: p1.gear // Discrete
                  });
              }
          } else if (!activeDriverId) {
             setActiveDriverTelemetry(null);
          }

          rafId = requestAnimationFrame(animate);
      };

      rafId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className="h-full bg-[#111] border border-[#222] rounded-lg overflow-hidden shadow-lg relative flex flex-col">
       <div className="px-4 py-3 bg-[#151515] border-b border-[#222] flex justify-between items-center shrink-0 z-10">
          <h3 className="font-orbitron font-bold text-xs text-neutral-300 uppercase tracking-widest flex items-center gap-2">
             Live Circuit Tracker
          </h3>
          <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-500">
             {loadingMap ? <span className="text-yellow-500 animate-pulse">GENERATING GEOMETRY...</span> : <span>GPS SIGNAL: ACTIVE (60hz)</span>}
          </div>
       </div>
       
       <div className="flex-1 relative min-h-0">
          <TrackMap 
            drivers={drivers}
            trackPath={trackPath}
            mapTransform={mapTransform}
            driverCoordinates={driverCoordinates}
            startLineCoordinates={startLineCoords}
            playbackSpeed={playbackSpeed}
            onDriverFollowed={setActiveDriverId}
            driverTelemetry={activeDriverTelemetry}
          />
       </div>
    </div>
  );
};

export default LiveCircuit;