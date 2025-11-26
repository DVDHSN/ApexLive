import React, { useState, useEffect } from 'react';
import { Driver, TelemetryData } from '../types';
import { getCarData } from '../services/openf1Service';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, AreaChart, Area } from 'recharts';
import { Activity, Gauge, Zap, TableProperties } from 'lucide-react';

interface TelemetryDashboardProps {
  sessionKey: number;
  currentTime: Date;
  drivers: Driver[];
  isPlaying: boolean;
}

const TelemetryDashboard: React.FC<TelemetryDashboardProps> = ({ sessionKey, currentTime, drivers, isPlaying }) => {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryData[]>([]);
  const [currentPacket, setCurrentPacket] = useState<TelemetryData | null>(null);

  // Set initial selected driver
  useEffect(() => {
    if (!selectedDriverId && drivers.length > 0) {
      // Prefer Max or the first driver
      const preferred = drivers.find(d => d.code === 'VER') || drivers[0];
      setSelectedDriverId(preferred.id);
    }
  }, [drivers, selectedDriverId]);

  // Fetch Loop with AbortController
  useEffect(() => {
    if (!selectedDriverId || !currentTime) return;

    const controller = new AbortController();

    const fetchTelemetry = async () => {
      try {
        // Fetch 60 seconds of history for charts
        const data = await getCarData(sessionKey, selectedDriverId, currentTime.toISOString(), 60, controller.signal);
        
        if (controller.signal.aborted) return;

        setTelemetry(data);
        
        if (data.length > 0) {
          setCurrentPacket(data[data.length - 1]);
        } else {
          setCurrentPacket(null);
        }
      } catch (e) {
        // Ignore errors
      }
    };

    fetchTelemetry();
    return () => controller.abort();
  }, [currentTime, selectedDriverId, sessionKey]);

  const selectedDriver = drivers.find(d => d.id === selectedDriverId);

  if (!selectedDriver) return <div className="p-10 text-neutral-500 font-exo">Loading Driver Data...</div>;

  return (
    <div className="flex h-full gap-4">
      {/* Sidebar: Driver Selector */}
      <div className="w-64 bg-[#1E1E1E] border border-[#2A2A2A] rounded-lg overflow-hidden flex flex-col shadow-xl">
        <div className="p-3 bg-[#222] border-b border-[#2A2A2A]">
           <h3 className="font-orbitron text-xs font-bold text-neutral-400 uppercase tracking-widest">Select Driver</h3>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
           {drivers.map(driver => (
             <button
               key={driver.id}
               onClick={() => setSelectedDriverId(driver.id)}
               className={`w-full flex items-center gap-3 p-3 border-b border-[#2A2A2A] transition-colors ${selectedDriverId === driver.id ? 'bg-red-600/10 border-l-4 border-l-red-600' : 'hover:bg-[#252525] border-l-4 border-l-transparent'}`}
             >
                <div className="relative w-10 h-10 bg-neutral-800 rounded overflow-hidden shrink-0">
                   {driver.imgUrl ? (
                     <img src={driver.imgUrl} alt={driver.code} className="w-full h-full object-cover object-top" />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center text-xs font-bold">{driver.code}</div>
                   )}
                </div>
                <div className="text-left">
                   <div className={`font-orbitron font-bold leading-none ${selectedDriverId === driver.id ? 'text-red-500' : 'text-neutral-200'}`}>{driver.code}</div>
                   <div className="text-[10px] text-neutral-500 uppercase font-exo mt-1">{driver.team.split(' ')[0]}</div>
                </div>
             </button>
           ))}
        </div>
      </div>

      {/* Main Telemetry Panel */}
      <div className="flex-1 bg-[#121212] flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
         
         {/* Top Row: Live Gauges */}
         <div className="grid grid-cols-4 gap-4 h-48 shrink-0">
            {/* Gear & Speed */}
            <div className="col-span-1 bg-[#1E1E1E] border border-[#2A2A2A] rounded-lg p-4 flex flex-col items-center justify-center relative shadow-lg overflow-hidden">
               <div className="absolute top-2 left-3 text-[10px] font-orbitron text-neutral-500 uppercase tracking-widest">Gear</div>
               <div className="font-rajdhani font-bold text-8xl text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                 {currentPacket?.gear ?? '-'}
               </div>
               <div className="text-4xl font-rajdhani font-bold text-red-600 mt-[-10px]">
                 {currentPacket?.speed ?? 0} <span className="text-sm text-neutral-500 font-exo font-medium uppercase">km/h</span>
               </div>
            </div>

            {/* RPM Gauge */}
            <div className="col-span-2 bg-[#1E1E1E] border border-[#2A2A2A] rounded-lg p-6 flex flex-col justify-center shadow-lg relative">
               <div className="absolute top-2 left-3 text-[10px] font-orbitron text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                 <Gauge size={14} /> RPM
               </div>
               <div className="w-full bg-[#111] h-8 rounded-full overflow-hidden border border-[#333] relative mt-4">
                  <div 
                    className="h-full transition-all duration-100 ease-linear" 
                    style={{ 
                        width: `${Math.min(((currentPacket?.rpm || 0) / 13000) * 100, 100)}%`,
                        background: 'linear-gradient(90deg, #22c55e 0%, #eab308 70%, #ef4444 90%)'
                    }}
                  />
                  {/* RPM Ticks */}
                  <div className="absolute inset-0 flex justify-between px-4 items-center">
                     {[3,6,9,12].map(k => (
                        <div key={k} className="h-full w-px bg-black/50 relative group">
                           <span className="absolute bottom-[-20px] left-[-10px] text-[9px] text-neutral-600 font-mono">{k}k</span>
                        </div>
                     ))}
                  </div>
               </div>
               <div className="text-right mt-3 font-mono text-2xl text-white font-bold tracking-widest">
                  {currentPacket?.rpm ?? 0}
               </div>
            </div>

             {/* DRS & Throttle/Brake Digital */}
             <div className="col-span-1 grid grid-rows-2 gap-4">
                 <div className={`rounded-lg border border-[#2A2A2A] flex flex-col items-center justify-center relative ${currentPacket?.drs && currentPacket.drs > 9 ? 'bg-green-900/20 shadow-[0_0_20px_rgba(34,197,94,0.2)]' : 'bg-[#1E1E1E]'}`}>
                    <div className="absolute top-2 left-3 text-[10px] font-orbitron text-neutral-500 uppercase tracking-widest flex items-center gap-1">
                      <Zap size={12} /> DRS
                    </div>
                    <div className={`font-orbitron font-black text-3xl uppercase ${currentPacket?.drs && currentPacket.drs > 9 ? 'text-green-500 animate-pulse' : 'text-neutral-700'}`}>
                       {currentPacket?.drs && currentPacket.drs > 9 ? 'OPEN' : 'CLOSED'}
                    </div>
                 </div>
                 <div className="bg-[#1E1E1E] rounded-lg border border-[#2A2A2A] flex items-center justify-around p-2">
                     <div className="text-center">
                        <div className="text-[9px] uppercase text-neutral-500 font-bold mb-1">Throttle</div>
                        <div className="h-10 w-3 bg-neutral-800 rounded-full relative overflow-hidden border border-[#333]">
                           <div className="absolute bottom-0 left-0 right-0 bg-green-500 transition-all duration-75" style={{ height: `${currentPacket?.throttle || 0}%` }}></div>
                        </div>
                     </div>
                     <div className="text-center">
                        <div className="text-[9px] uppercase text-neutral-500 font-bold mb-1">Brake</div>
                        <div className="h-10 w-3 bg-neutral-800 rounded-full relative overflow-hidden border border-[#333]">
                           <div className="absolute bottom-0 left-0 right-0 bg-red-600 transition-all duration-75" style={{ height: `${currentPacket?.brake || 0}%` }}></div>
                        </div>
                     </div>
                 </div>
             </div>
         </div>

         {/* New Section: Real-Time Data Table */}
         <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-lg p-4 shadow-lg shrink-0">
             <h4 className="text-xs font-orbitron font-bold text-neutral-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                 <TableProperties size={14} /> Real-Time Data Packet
             </h4>
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                 <div className="bg-[#121212] p-3 rounded border border-[#333] flex flex-col items-center">
                     <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-1">Speed</span>
                     <span className="text-xl font-rajdhani font-bold text-white">{currentPacket?.speed ?? '-'} <span className="text-xs text-neutral-600 font-medium">km/h</span></span>
                 </div>
                 <div className="bg-[#121212] p-3 rounded border border-[#333] flex flex-col items-center">
                     <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-1">RPM</span>
                     <span className="text-xl font-rajdhani font-bold text-white">{currentPacket?.rpm ?? '-'}</span>
                 </div>
                 <div className="bg-[#121212] p-3 rounded border border-[#333] flex flex-col items-center">
                     <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-1">Gear</span>
                     <span className="text-xl font-rajdhani font-bold text-white">{currentPacket?.gear ?? '-'}</span>
                 </div>
                 <div className="bg-[#121212] p-3 rounded border border-[#333] flex flex-col items-center">
                     <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-1">Throttle</span>
                     <span className="text-xl font-rajdhani font-bold text-green-500">{currentPacket?.throttle ?? '-'} <span className="text-xs text-neutral-600 font-medium">%</span></span>
                 </div>
                 <div className="bg-[#121212] p-3 rounded border border-[#333] flex flex-col items-center">
                     <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-1">Brake</span>
                     <span className="text-xl font-rajdhani font-bold text-red-500">{currentPacket?.brake ?? '-'} <span className="text-xs text-neutral-600 font-medium">%</span></span>
                 </div>
                 <div className="bg-[#121212] p-3 rounded border border-[#333] flex flex-col items-center">
                     <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-1">DRS</span>
                     <span className={`text-xl font-rajdhani font-bold ${currentPacket?.drs && currentPacket.drs > 9 ? 'text-green-500' : 'text-neutral-400'}`}>
                         {currentPacket?.drs && currentPacket.drs > 9 ? 'OPEN' : 'CLOSED'}
                     </span>
                 </div>
             </div>
         </div>

         {/* Charts Row 1: Throttle & Brake */}
         <div className="h-64 bg-[#1E1E1E] border border-[#2A2A2A] rounded-lg p-4 shadow-lg shrink-0">
             <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-orbitron font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                  <Activity size={14} /> Throttle vs Brake Trace
                </h4>
             </div>
             <ResponsiveContainer width="100%" height="90%">
                <AreaChart data={telemetry}>
                   <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                   <XAxis dataKey="date" hide />
                   <YAxis domain={[0, 100]} hide />
                   <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#121212', border: '1px solid #333', fontSize: '12px' }}
                      itemStyle={{ padding: 0 }}
                      labelFormatter={() => ''}
                   />
                   <Area type="monotone" dataKey="throttle" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} strokeWidth={2} name="Throttle %" animationDuration={0} isAnimationActive={false} />
                   <Area type="monotone" dataKey="brake" stroke="#dc2626" fill="#dc2626" fillOpacity={0.2} strokeWidth={2} name="Brake %" animationDuration={0} isAnimationActive={false} />
                </AreaChart>
             </ResponsiveContainer>
         </div>

         {/* Charts Row 2: Speed */}
         <div className="h-64 bg-[#1E1E1E] border border-[#2A2A2A] rounded-lg p-4 shadow-lg shrink-0">
             <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-orbitron font-bold text-neutral-400 uppercase tracking-widest">
                  Speed Trace (km/h)
                </h4>
             </div>
             <ResponsiveContainer width="100%" height="90%">
                <LineChart data={telemetry}>
                   <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                   <XAxis dataKey="date" hide />
                   <YAxis domain={['auto', 'auto']} tick={{fill:'#666', fontSize: 10}} tickLine={false} axisLine={false} />
                   <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#121212', border: '1px solid #333', fontSize: '12px' }}
                      labelFormatter={() => ''}
                   />
                   <Line type="monotone" dataKey="speed" stroke="#3b82f6" strokeWidth={2} dot={false} name="Speed" animationDuration={0} isAnimationActive={false} />
                </LineChart>
             </ResponsiveContainer>
         </div>
      </div>
    </div>
  );
};

export default TelemetryDashboard;