import React, { useState, useEffect, useRef } from 'react';
import { Driver, TireCompound } from '../types';
import { ChevronUp, ChevronDown, Minus } from 'lucide-react';

interface Props {
  drivers: Driver[];
}

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
    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${borderColor} ${bgColor} ${textColor} text-[10px] font-bold shadow-sm`}>
      {label}
    </div>
  );
};

// Sub-component to handle position change animation
const PositionBadge = ({ position, isOut, isLeader, defaultClass }: { position: number, isOut: boolean, isLeader: boolean, defaultClass: string }) => {
  const [trend, setTrend] = useState<'UP' | 'DOWN' | null>(null);
  const prevPosRef = useRef<number>(position);

  useEffect(() => {
    // Only animate if valid positions and not first render (implicitly handled by diff check)
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
    
    // If they go out, update ref but don't show trend arrows usually
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
      <span className={`transition-all duration-300 transform ${
          trend === 'UP' ? 'text-green-500 scale-125' : 
          trend === 'DOWN' ? 'text-red-500 scale-110' : 
          defaultClass
      }`}>
        {position}
      </span>
    </div>
  );
};

const LiveLeaderboard: React.FC<Props> = ({ drivers }) => {
  return (
    <div className="bg-[#111] border border-[#222] rounded-lg h-full flex flex-col overflow-hidden shadow-lg relative">
      {/* Header Decoration */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-transparent to-transparent z-20"></div>
      
      <div className="px-4 py-3 bg-[#151515] border-b border-[#222] flex justify-between items-center shrink-0">
        <h3 className="font-orbitron font-bold text-xs text-neutral-300 uppercase tracking-widest">Classification</h3>
        <div className="flex gap-1">
           <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></div>
           <div className="w-1.5 h-1.5 rounded-full bg-neutral-700"></div>
        </div>
      </div>
      
      <div className="overflow-auto flex-1 custom-scrollbar bg-[#0A0A0A]">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#151515] text-[10px] uppercase text-neutral-500 sticky top-0 z-10 font-bold tracking-widest border-b border-[#222] font-orbitron shadow-md">
            <tr>
              <th className="py-2 px-2 text-center w-8 sm:w-10">Pos</th>
              <th className="py-2 px-2">Driver</th>
              <th className="py-2 px-2 text-right w-16 hidden sm:table-cell">Int</th>
              <th className="py-2 px-2 text-center w-10 hidden md:table-cell">Age</th>
              <th className="py-2 px-2 text-center w-8 sm:w-10">Tyre</th>
            </tr>
          </thead>
          <tbody className="text-neutral-200 text-sm font-medium font-rajdhani">
            {drivers.map((driver, index) => {
               const isOut = driver.status === 'OUT';
               const isLeader = driver.position === 1 && !isOut;
               const drsActive = driver.drsAvailable && !isOut;
               
               // Formatting Interval
               let intervalDisplay = '';
               if (isOut) intervalDisplay = 'STOP';
               else if (isLeader) intervalDisplay = 'Leader';
               else if (driver.interval > 0) intervalDisplay = `+${driver.interval.toFixed(3)}`;
               else intervalDisplay = '+0.000';

               let rowClass = 'border-b border-[#1A1A1A] transition-colors group relative ';
               if (isOut) {
                   rowClass += 'bg-[#080808] text-neutral-600 grayscale opacity-80';
               } else if (isLeader) {
                   rowClass += 'bg-gradient-to-r from-[#222] to-transparent border-l-2 border-l-yellow-500';
               } else {
                   rowClass += 'hover:bg-[#151515] border-l-2 border-l-transparent hover:border-l-red-500';
               }

               const posClass = isOut ? 'text-red-600 tracking-widest text-[10px] font-black' : isLeader ? 'text-yellow-400' : 'text-neutral-400 group-hover:text-white';

               return (
                <tr key={driver.id} className={rowClass}>
                  
                  {/* POSITION */}
                  <td className={`py-3 md:py-2 px-2 text-center font-bold font-rajdhani text-base`}>
                    <PositionBadge 
                        position={driver.position || (index + 1)} 
                        isOut={isOut} 
                        isLeader={isLeader}
                        defaultClass={posClass}
                    />
                  </td>
                  
                  {/* DRIVER INFO */}
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-3">
                      {/* Team Line */}
                      <div className="w-1 h-8 rounded-full" style={{ backgroundColor: driver.teamColor }}></div>
                      
                      {/* Headshot (Hidden on mobile) */}
                      <div className="w-9 h-9 rounded bg-[#1a1a1a] overflow-hidden relative shrink-0 border border-[#333] hidden sm:block">
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

                      <div className="flex flex-col min-w-0">
                         <div className="flex items-center gap-2">
                            <span className={`font-bold uppercase font-rajdhani text-lg leading-none tracking-tight ${isOut ? 'text-neutral-600 line-through decoration-red-900/50' : 'text-white'}`}>
                                {driver.code}
                            </span>
                            
                            {/* DRS Indicator - Always visible slot, toggles style */}
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
                  </td>

                  {/* INTERVAL */}
                  <td className={`py-2 px-2 text-right font-rajdhani font-semibold tabular-nums hidden sm:table-cell ${isOut ? 'text-red-900/50 italic text-xs' : isLeader ? 'text-yellow-500' : 'text-neutral-300'}`}>
                     {intervalDisplay}
                  </td>

                  {/* TYRE AGE */}
                  <td className={`py-2 px-2 text-center font-rajdhani font-medium hidden md:table-cell ${isOut ? 'text-neutral-800' : 'text-neutral-400'} tabular-nums`}>
                      {isOut || driver.tireAge === undefined ? '-' : `${driver.tireAge} L`}
                  </td>

                  {/* TYRE */}
                  <td className={`py-2 px-2 flex justify-center items-center ${isOut ? 'opacity-20' : ''}`}>
                    <TireIcon compound={driver.tire} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LiveLeaderboard;