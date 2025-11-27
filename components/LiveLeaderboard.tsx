import React, { useState, useEffect, useRef } from 'react';
import { Driver, TireCompound } from '../types';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface Props {
  drivers: Driver[];
}

const ROW_HEIGHT = 52; // Fixed height for rows to enable absolute positioning calculations

const TireIcon = ({ compound }: { compound: TireCompound }) => {
  let bgColor = 'bg-neutral-800';
  let textColor = 'text-neutral-400';
  let borderColor = 'border-neutral-700';
  let label = 'S';

  switch (compound) {
    case TireCompound.SOFT: 
        label = 'S'; 
        bgColor = 'bg-[#1a1a1a]'; 
        textColor='text-red-500'; 
        borderColor='border-red-600';
        break;
    case TireCompound.MEDIUM: 
        label = 'M'; 
        bgColor = 'bg-[#1a1a1a]'; 
        textColor='text-yellow-400'; 
        borderColor='border-yellow-400';
        break;
    case TireCompound.HARD: 
        label = 'H'; 
        bgColor = 'bg-[#1a1a1a]'; 
        textColor='text-white'; 
        borderColor='border-white';
        break;
    case TireCompound.INTER: 
        label = 'I'; 
        bgColor = 'bg-[#1a1a1a]'; 
        textColor='text-green-500'; 
        borderColor='border-green-500';
        break;
    case TireCompound.WET: 
        label = 'W'; 
        bgColor = 'bg-[#1a1a1a]'; 
        textColor='text-blue-500'; 
        borderColor='border-blue-500';
        break;
  }

  return (
    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${borderColor} ${bgColor} ${textColor} text-[10px] font-bold shadow-sm shrink-0`}>
      {label}
    </div>
  );
};

// Sub-component to handle position change animation
const PositionBadge = ({ position, isOut, isLeader, defaultClass }: { position: number, isOut: boolean, isLeader: boolean, defaultClass: string }) => {
  const [trend, setTrend] = useState<'UP' | 'DOWN' | null>(null);
  const prevPosRef = useRef<number>(position);

  useEffect(() => {
    // Only animate if valid positions and not first render
    if (!isOut && prevPosRef.current !== position) {
      if (position < prevPosRef.current) {
        setTrend('UP');
      } else if (position > prevPosRef.current) {
        setTrend('DOWN');
      }
      prevPosRef.current = position;

      // Reset animation after 3 seconds
      const timer = setTimeout(() => setTrend(null), 3000);
      return () => clearTimeout(timer);
    }
    
    if (isOut) {
        prevPosRef.current = 999;
    }
  }, [position, isOut]);

  if (isOut) {
      return <span className={defaultClass}>DNF</span>;
  }

  return (
    <div className="flex items-center justify-center relative w-full h-full">
      {/* Trend Indicator */}
      <div className={`absolute -left-1 opacity-0 transition-opacity duration-500 ${trend ? 'opacity-100' : ''}`}>
         {trend === 'UP' && <ChevronUp size={12} className="text-green-500 animate-bounce" />}
         {trend === 'DOWN' && <ChevronDown size={12} className="text-red-500 animate-bounce" />}
      </div>

      {/* Position Number */}
      <span className={`transition-all duration-300 transform font-rajdhani font-bold text-base ${
          trend === 'UP' ? 'text-green-500 scale-125' : 
          trend === 'DOWN' ? 'text-red-500 scale-110' : 
          defaultClass
      }`}>
        {position}
      </span>
    </div>
  );
};

interface DriverRowProps {
  driver: Driver;
  index: number;
  isOut: boolean;
  isLeader: boolean;
  drsActive: boolean;
}

// Individual Driver Row Component
const DriverRow: React.FC<DriverRowProps> = ({ driver, index, isOut, isLeader, drsActive }) => {
    // Calculate styling based on state
    let bgClass = 'bg-[#111]';
    let borderClass = 'border-l-2 border-l-transparent';
    
    if (isOut) {
        bgClass = 'bg-[#080808] opacity-60';
    } else if (isLeader) {
        bgClass = 'bg-gradient-to-r from-[#1A1A1A] to-transparent';
        borderClass = 'border-l-2 border-l-yellow-500';
    } else {
        // Default hover effect handled by CSS, strict background needed for absolute positioning overlap
    }

    const posClass = isOut ? 'text-red-600 tracking-widest text-[10px] font-black' : isLeader ? 'text-yellow-400' : 'text-neutral-400';

    return (
        <div 
            className={`absolute left-0 right-0 h-[52px] px-2 flex items-center border-b border-[#1A1A1A] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] hover:bg-[#1a1a1a] ${bgClass} ${borderClass}`}
            style={{ 
                top: index * ROW_HEIGHT,
                zIndex: isLeader ? 10 : 1 // Ensure leader stays visually meaningful
            }}
        >
            {/* POS */}
            <div className="w-8 sm:w-10 shrink-0 flex justify-center items-center h-full">
                 <PositionBadge 
                    position={driver.position} 
                    isOut={isOut} 
                    isLeader={isLeader}
                    defaultClass={posClass}
                />
            </div>

            {/* DRIVER */}
            <div className="flex-1 flex items-center gap-3 min-w-0 px-2">
                 {/* Team Strip */}
                 <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: driver.teamColor }}></div>
                 
                 {/* Headshot */}
                 <div className="w-9 h-9 rounded bg-[#1a1a1a] overflow-hidden relative shrink-0 border border-[#333] hidden sm:block shadow-sm">
                    {driver.imgUrl ? (
                        <img 
                            src={driver.imgUrl} 
                            alt={driver.code} 
                            className="w-full h-full object-cover object-top scale-125 translate-y-1.5" 
                            loading="lazy"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] text-neutral-700 font-bold font-exo">
                            {driver.code}
                        </div>
                    )}
                 </div>

                 {/* Name & Team */}
                 <div className="flex flex-col min-w-0">
                     <div className="flex items-center gap-2">
                        <span className={`font-bold uppercase font-rajdhani text-lg leading-none tracking-tight ${isOut ? 'text-neutral-600 line-through decoration-red-900/50' : 'text-white'}`}>
                            {driver.code}
                        </span>
                        
                        {!isOut && (
                            <div className={`text-[8px] font-black px-1.5 py-0.5 rounded font-exo leading-none transition-all duration-300 border ${
                                drsActive 
                                ? 'bg-green-500 text-black border-green-400 shadow-[0_0_8px_rgba(34,197,94,0.6)]' 
                                : 'bg-[#111] text-neutral-700 border-[#222]'
                            }`}>
                                DRS
                            </div>
                        )}
                     </div>
                     <span className="text-[9px] text-neutral-500 uppercase font-exo leading-none mt-1 truncate max-w-[120px]">{driver.team}</span>
                 </div>
            </div>

            {/* INTERVAL */}
            <div className={`w-16 shrink-0 text-right font-rajdhani font-semibold tabular-nums hidden sm:block ${isOut ? 'text-red-900/50 italic text-xs' : isLeader ? 'text-yellow-500' : 'text-neutral-300'}`}>
                {isOut ? 'STOP' : isLeader ? 'Leader' : driver.interval > 0 ? `+${driver.interval.toFixed(3)}` : '+0.000'}
            </div>

            {/* AGE */}
            <div className={`w-12 shrink-0 text-center font-rajdhani font-medium hidden md:block ${isOut ? 'text-neutral-800' : 'text-neutral-400'} tabular-nums`}>
                 {isOut || driver.tireAge === undefined ? '-' : `${driver.tireAge} L`}
            </div>

            {/* TYRE */}
            <div className={`w-10 shrink-0 flex justify-center items-center ${isOut ? 'opacity-20' : ''}`}>
                 <TireIcon compound={driver.tire} />
            </div>
        </div>
    );
}

const LiveLeaderboard: React.FC<Props> = ({ drivers }) => {
  return (
    <div className="bg-[#111] border border-[#222] rounded-lg h-full flex flex-col overflow-hidden shadow-lg relative">
      {/* Header Decoration */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-transparent to-transparent z-20"></div>
      
      {/* Component Title */}
      <div className="px-4 py-3 bg-[#151515] border-b border-[#222] flex justify-between items-center shrink-0 z-10">
        <h3 className="font-orbitron font-bold text-xs text-neutral-300 uppercase tracking-widest">Classification</h3>
        <div className="flex gap-1">
           <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></div>
           <div className="w-1.5 h-1.5 rounded-full bg-neutral-700"></div>
        </div>
      </div>
      
      {/* Column Headers (Fixed) */}
      <div className="flex items-center px-2 py-2 bg-[#151515] text-[10px] uppercase text-neutral-500 font-bold tracking-widest font-orbitron border-b border-[#222] z-10 shadow-sm">
         <div className="w-8 sm:w-10 text-center">Pos</div>
         <div className="flex-1 px-2">Driver</div>
         <div className="w-16 text-right hidden sm:block">Int</div>
         <div className="w-12 text-center hidden md:block">Age</div>
         <div className="w-10 text-center">Tyre</div>
      </div>

      {/* Scrollable List Container */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0A0A0A] relative">
         <div style={{ height: drivers.length * ROW_HEIGHT }} className="relative w-full">
            {drivers.map((driver, index) => {
               const isOut = driver.status === 'OUT';
               const isLeader = driver.position === 1 && !isOut;
               const drsActive = driver.drsAvailable && !isOut;
               
               return (
                   <DriverRow 
                      key={driver.id} 
                      driver={driver} 
                      index={index} 
                      isOut={isOut} 
                      isLeader={isLeader} 
                      drsActive={!!drsActive} 
                   />
               );
            })}
         </div>
      </div>
    </div>
  );
};

export default LiveLeaderboard;