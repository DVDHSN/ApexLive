import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Driver, TelemetryData } from '../types';
import { getCarData } from '../services/openf1Service';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, AreaChart, Area } from 'recharts';
import { Activity, Cpu, ChevronsRight, AlertCircle, Gauge, Zap } from 'lucide-react';

interface TelemetryDashboardProps {
  sessionKey: number;
  currentTime: Date;
  drivers: Driver[];
  isPlaying: boolean;
}

interface DisplayData extends TelemetryData {
  gForce: number;
}

// Linear Interpolation Helper with safety checks
const lerp = (start: number, end: number, factor: number) => {
    const s = Number.isFinite(start) ? start : 0;
    const e = Number.isFinite(end) ? end : 0;
    return s + (e - s) * factor;
};

// Calculate interpolated physics values for a specific timestamp
const getInterpolatedData = (data: TelemetryData[], time: Date): DisplayData | null => {
  if (!data || data.length === 0) return null;
  
  const timeMs = time.getTime();
  
  // Find the two packets bounding the current time
  let idx = -1;
  // Iterate backwards as we likely want recent data
  for (let i = data.length - 1; i >= 0; i--) {
    if (new Date(data[i].date).getTime() <= timeMs) {
      idx = i;
      break;
    }
  }

  // Edge Cases
  if (idx === -1) return { ...data[0], gForce: 0 }; // All data in future
  if (idx === data.length - 1) return { ...data[idx], gForce: 0 }; // End of stream

  const p1 = data[idx];
  const p2 = data[idx + 1];
  
  const t1 = new Date(p1.date).getTime();
  const t2 = new Date(p2.date).getTime();
  
  // Avoid divide by zero
  if (t2 === t1) return { ...p1, gForce: 0 };

  const factor = (timeMs - t1) / (t2 - t1);
  
  // Interpolate Fields
  const speed = lerp(p1.speed, p2.speed, factor);
  const rpm = lerp(p1.rpm, p2.rpm, factor);
  const throttle = lerp(p1.throttle, p2.throttle, factor);
  const brake = lerp(p1.brake, p2.brake, factor);
  
  // G-Force Calculation (derived from speed delta)
  // v in km/h -> m/s is v/3.6
  // delta_v (m/s) / delta_t (s) = a (m/s^2)
  // a / 9.81 = g
  const v1 = Number.isFinite(p1.speed) ? p1.speed / 3.6 : 0;
  const v2 = Number.isFinite(p2.speed) ? p2.speed / 3.6 : 0;
  const dt = (t2 - t1) / 1000;
  const accel = dt > 0 ? (v2 - v1) / dt : 0;
  const gForce = accel / 9.81;

  // Simulate High-RPM Vibration (Noise)
  // Add random jitter if RPM is high to simulate engine vibration
  let displayRpm = rpm;
  if (throttle > 80 || rpm > 10000) {
     const vibration = (Math.random() - 0.5) * 50; 
     displayRpm += vibration;
  }

  return {
    date: time.toISOString(),
    speed: Math.round(speed),
    rpm: Math.round(displayRpm),
    throttle: Math.round(throttle),
    brake: Math.round(brake),
    gear: p1.gear, // Discrete value, don't lerp
    drs: p1.drs,   // Discrete value
    gForce: isNaN(gForce) ? 0 : gForce
  };
};

const TelemetryDashboard: React.FC<TelemetryDashboardProps> = ({ sessionKey, currentTime, drivers, isPlaying }) => {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryData[]>([]);
  const [displayPacket, setDisplayPacket] = useState<DisplayData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Refs to hold latest props without triggering effect re-runs
  const latestProps = useRef({ sessionKey, currentTime, selectedDriverId });

  // Update refs when props change
  useEffect(() => {
    latestProps.current = { sessionKey, currentTime, selectedDriverId };
  }, [sessionKey, currentTime, selectedDriverId]);

  // Set initial selected driver
  useEffect(() => {
    if (!selectedDriverId && drivers.length > 0) {
      const preferred = drivers.find(d => d.code === 'VER') || drivers[0];
      setSelectedDriverId(preferred.id);
    }
  }, [drivers, selectedDriverId]);

  // 1. Data Fetch Loop (Approx 4Hz)
  useEffect(() => {
    let isMounted = true;
    
    const fetchTelemetry = async () => {
      const { sessionKey, currentTime, selectedDriverId } = latestProps.current;
      if (!selectedDriverId || !currentTime) return;
      
      try {
        // Fetch 45 seconds of history
        const data = await getCarData(sessionKey, selectedDriverId, currentTime.toISOString(), 45);
        if (isMounted && data && data.length > 0) {
          setTelemetry(data);
          setIsLoading(false);
        } else if (isMounted && (!data || data.length === 0)) {
           setIsLoading(false);
        }
      } catch (e) {
        console.error("Telemetry fetch error", e);
      }
    };

    setIsLoading(true);
    fetchTelemetry();
    const intervalId = setInterval(fetchTelemetry, 250);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [selectedDriverId]); // Only reset loop fully if driver changes

  // 2. Interpolation Loop (Runs on every render when currentTime changes)
  // This ensures gauges update at the full 10Hz-60Hz rate of the app
  useEffect(() => {
      if (telemetry.length < 2) return;
      const interpolated = getInterpolatedData(telemetry, currentTime);
      if (interpolated) {
          setDisplayPacket(interpolated);
      }
  }, [currentTime, telemetry]);

  const selectedDriver = drivers.find(d => d.id === selectedDriverId);

  if (!selectedDriver) return (
    <div className="w-full h-full flex items-center justify-center bg-[#0A0A0A] text-neutral-500 font-exo animate-pulse">
        Initializing Telemetry Link...
    </div>
  );

  return (
    <div className="grid grid-cols-12 gap-3 h-full min-h-0">
      
      {/* --- LEFT: DRIVER SELECTOR --- */}
      <div className="col-span-12 lg:col-span-3 xl:col-span-2 bg-[#111] border border-[#222] rounded-lg flex flex-col shadow-lg overflow-hidden h-full min-h-0">
        <div className="px-4 py-3 bg-[#151515] border-b border-[#222] shrink-0">
           <h3 className="font-orbitron font-bold text-xs text-neutral-300 uppercase tracking-widest flex items-center gap-2">
              <Cpu size={12} className="text-red-500" /> Signal Source
           </h3>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0A0A0A]">
           {drivers.map((driver) => {
             const isSelected = selectedDriverId === driver.id;
             return (
               <button
                 key={driver.id}
                 onClick={() => {
                     setSelectedDriverId(driver.id);
                     setIsLoading(true);
                     setTelemetry([]); 
                     setDisplayPacket(null);
                 }}
                 className={`w-full flex items-center gap-3 px-3 py-2 border-b border-[#1A1A1A] transition-all group relative ${
                    isSelected ? 'bg-[#1a1a1a]' : 'hover:bg-[#151515]'
                 }`}
               >
                  {/* Selection Indicator */}
                  {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]"></div>}
                  
                  {/* Pos */}
                  <div className={`w-6 text-center font-rajdhani font-bold text-lg ${isSelected ? 'text-white' : 'text-neutral-600'}`}>
                      {driver.position || '-'}
                  </div>

                  {/* Team Color Strip */}
                  <div className="w-1 h-8 rounded-full" style={{ backgroundColor: driver.teamColor }}></div>
                  
                  {/* Info */}
                  <div className="flex flex-col items-start min-w-0">
                     <span className={`font-bold font-rajdhani text-lg leading-none ${isSelected ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-200'}`}>
                        {driver.code}
                     </span>
                     <span className="text-[9px] uppercase text-neutral-600 font-exo truncate w-24 text-left">
                        {driver.team}
                     </span>
                  </div>
               </button>
             );
           })}
        </div>
      </div>

      {/* --- RIGHT: TELEMETRY DATA --- */}
      <div className="col-span-12 lg:col-span-9 xl:col-span-10 flex flex-col gap-3 h-full min-h-0">
         
         {/* 1. COCKPIT PANEL */}
         <div className="bg-[#111] border border-[#222] rounded-lg p-0 shadow-lg shrink-0 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-transparent to-transparent z-10"></div>
            
            <div className="grid grid-cols-12 gap-0 divide-x divide-[#222]">
                
                {/* Header / Driver Info */}
                <div className="col-span-12 md:col-span-3 p-4 flex flex-col justify-center bg-[#151515]">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded bg-neutral-800 overflow-hidden border border-[#333]">
                           {selectedDriver.imgUrl && <img src={selectedDriver.imgUrl} className="w-full h-full object-cover object-top" />}
                        </div>
                        <div>
                            <div className="text-3xl font-bold font-rajdhani text-white leading-none tracking-tight">{selectedDriver.code}</div>
                            <div className="text-[10px] uppercase text-neutral-500 font-exo font-bold">{selectedDriver.team}</div>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-1">
                        <div className="px-2 py-0.5 bg-neutral-800 rounded text-[10px] font-bold text-neutral-400 border border-[#333] flex items-center gap-1">
                             <Zap size={10} className={displayPacket?.gForce && Math.abs(displayPacket.gForce) > 2 ? 'text-yellow-500' : 'text-neutral-600'} />
                             G-FORCE: <span className="text-white tabular-nums">{displayPacket?.gForce.toFixed(1) ?? '0.0'}</span>
                        </div>
                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all duration-200 ${
                            displayPacket?.drs && displayPacket.drs > 9 
                            ? 'bg-green-500/20 text-green-400 border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.3)]' 
                            : 'bg-neutral-800 text-neutral-500 border-[#333]'
                        }`}>
                             {displayPacket?.drs && displayPacket.drs > 9 ? 'DRS ACTIVE' : 'DRS OFF'}
                        </div>
                    </div>
                </div>

                {/* Speed & Gear */}
                <div className="col-span-6 md:col-span-3 p-4 flex flex-col items-center justify-center relative group">
                    <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest absolute top-3 left-4">Speed</span>
                    <div className="flex items-baseline gap-1 mt-2">
                         <span className="text-6xl font-rajdhani font-bold text-white tracking-tighter tabular-nums drop-shadow-md transition-all duration-100 ease-linear">
                             {displayPacket?.speed ?? 0}
                         </span>
                         <span className="text-sm font-exo font-bold text-neutral-500">KM/H</span>
                    </div>
                </div>

                <div className="col-span-6 md:col-span-2 p-4 flex flex-col items-center justify-center bg-[#181818] relative">
                    <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest absolute top-3 left-4">Gear</span>
                    <span className="text-6xl font-rajdhani font-bold text-yellow-500 tracking-tighter drop-shadow-[0_0_10px_rgba(234,179,8,0.4)]">
                        {displayPacket?.gear ?? 'N'}
                    </span>
                </div>

                {/* RPM & Pedals */}
                <div className="col-span-12 md:col-span-4 p-4 flex flex-col justify-center gap-4">
                    {/* RPM Bar */}
                    <div className="w-full">
                        <div className="flex justify-between text-[9px] font-bold text-neutral-500 mb-1 uppercase tracking-wider">
                            <span>RPM</span>
                            <span className="text-white tabular-nums transition-all duration-100 ease-linear">{displayPacket?.rpm ?? 0}</span>
                        </div>
                        <div className="h-4 bg-[#0a0a0a] rounded-sm overflow-hidden border border-[#333] relative">
                             {/* Ticks */}
                             <div className="absolute inset-0 w-full h-full flex justify-between px-[10%] z-10">
                                 {[1,2,3,4,5].map(i => <div key={i} className="w-px h-full bg-[#111]"></div>)}
                             </div>
                             {/* Bar */}
                             <div 
                                className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-600 transition-all duration-100 ease-linear"
                                style={{ width: `${Math.min(((displayPacket?.rpm || 0) / 13500) * 100, 100)}%` }}
                             ></div>
                        </div>
                    </div>

                    {/* Pedals & G-Force Meter */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Inputs */}
                        <div className="flex gap-1 h-6">
                            {/* Throttle */}
                            <div className="flex-1 bg-[#0a0a0a] rounded-sm border border-[#333] overflow-hidden flex flex-col justify-end relative">
                                <div className="absolute bottom-0 w-full bg-green-500 transition-all duration-100 ease-linear opacity-80" style={{ height: `${displayPacket?.throttle || 0}%` }}></div>
                                <span className="absolute bottom-1 left-1 text-[8px] font-bold text-white z-10">THR</span>
                            </div>
                            {/* Brake */}
                            <div className="flex-1 bg-[#0a0a0a] rounded-sm border border-[#333] overflow-hidden flex flex-col justify-end relative">
                                <div className="absolute bottom-0 w-full bg-red-600 transition-all duration-100 ease-linear opacity-80" style={{ height: `${displayPacket?.brake || 0}%` }}></div>
                                <span className="absolute bottom-1 left-1 text-[8px] font-bold text-white z-10">BRK</span>
                            </div>
                        </div>
                        
                        {/* G-Force Meter */}
                        <div className="bg-[#0a0a0a] rounded-sm border border-[#333] relative overflow-hidden flex items-center justify-center">
                            {/* Center Line */}
                            <div className="absolute w-px h-full bg-[#333] left-1/2 z-10"></div>
                            
                            {/* G-Bar */}
                            <div 
                                className={`h-2/3 absolute transition-all duration-100 ease-linear rounded-sm ${
                                    (displayPacket?.gForce || 0) > 0 ? 'bg-green-500 left-1/2 rounded-l-none' : 'bg-red-500 right-1/2 rounded-r-none'
                                }`}
                                style={{ 
                                    width: `${Math.min(Math.abs(displayPacket?.gForce || 0) * 20, 50)}%` // Scale factor for visibility
                                }}
                            ></div>
                            <span className="absolute top-0.5 right-1 text-[7px] text-neutral-600 font-bold">G</span>
                        </div>
                    </div>
                </div>
            </div>
         </div>

         {/* 2. CHARTS GRID */}
         <div className="flex-1 min-h-0 grid grid-rows-2 gap-3 relative">
            
            {telemetry.length === 0 && !isLoading && (
                 <div className="absolute inset-0 z-20 bg-[#0A0A0A]/80 backdrop-blur-sm flex items-center justify-center flex-col gap-2 border border-[#222] rounded-lg">
                     <AlertCircle size={32} className="text-neutral-600" />
                     <span className="text-neutral-500 font-exo font-bold uppercase tracking-wider">No Telemetry Data Available</span>
                 </div>
            )}

            {/* Row 1: Speed Trace */}
            <div className="bg-[#111] border border-[#222] rounded-lg p-3 shadow-lg flex flex-col relative overflow-hidden">
                <div className="flex justify-between items-center mb-1 px-1">
                   <h4 className="font-orbitron font-bold text-xs text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                      <ChevronsRight size={14} className="text-blue-500" /> Speed Trace
                   </h4>
                   <span className="text-[10px] font-mono text-neutral-600">{telemetry.length} samples</span>
                </div>
                <div className="flex-1 w-full min-h-0 relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={telemetry} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                            <XAxis dataKey="date" hide />
                            <YAxis domain={['auto', 'auto']} tick={{ fill: '#444', fontSize: 10, fontFamily: 'Rajdhani' }} axisLine={false} tickLine={false} />
                            <RechartsTooltip 
                                contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#eee', fontSize: '11px', fontFamily: 'Exo 2' }}
                                itemStyle={{ padding: 0 }}
                                labelFormatter={() => ''}
                                cursor={{ stroke: '#555', strokeWidth: 1 }}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="speed" 
                                stroke="#3b82f6" 
                                strokeWidth={2}
                                fillOpacity={1} 
                                fill="url(#colorSpeed)" 
                                isAnimationActive={false} // CRITICAL FOR REALTIME
                                animationDuration={0}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Row 2: Throttle/Brake Trace */}
            <div className="bg-[#111] border border-[#222] rounded-lg p-3 shadow-lg flex flex-col relative overflow-hidden">
                <div className="flex justify-between items-center mb-1 px-1">
                   <h4 className="font-orbitron font-bold text-xs text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                      <Activity size={14} className="text-green-500" /> Inputs Trace
                   </h4>
                </div>
                <div className="flex-1 w-full min-h-0 relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={telemetry} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                            <XAxis dataKey="date" hide />
                            <YAxis domain={[0, 100]} tick={{ fill: '#444', fontSize: 10, fontFamily: 'Rajdhani' }} axisLine={false} tickLine={false} />
                            <RechartsTooltip 
                                contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#eee', fontSize: '11px', fontFamily: 'Exo 2' }}
                                labelFormatter={() => ''}
                                cursor={{ stroke: '#555', strokeWidth: 1 }}
                            />
                            <Area 
                                type="stepAfter" 
                                dataKey="throttle" 
                                stackId="1" 
                                stroke="#22c55e" 
                                strokeWidth={2}
                                fill="#22c55e" 
                                fillOpacity={0.2} 
                                isAnimationActive={false}
                                animationDuration={0}
                            />
                            <Area 
                                type="stepAfter" 
                                dataKey="brake" 
                                stackId="2" 
                                stroke="#dc2626" 
                                strokeWidth={2}
                                fill="#dc2626" 
                                fillOpacity={0.2} 
                                isAnimationActive={false}
                                animationDuration={0}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

         </div>
      </div>
    </div>
  );
};

export default TelemetryDashboard;