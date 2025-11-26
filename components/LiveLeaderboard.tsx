import React from 'react';
import { Driver, TireCompound } from '../types';

interface Props {
  drivers: Driver[];
}

const TireIcon = ({ compound }: { compound: TireCompound }) => {
  let bgColor = 'bg-neutral-700';
  let textColor = 'text-white';
  let label = 'S';

  switch (compound) {
    case TireCompound.SOFT: label = 'Soft'; bgColor = 'bg-red-600'; break;
    case TireCompound.MEDIUM: label = 'Medium'; bgColor = 'bg-yellow-400'; textColor='text-black'; break;
    case TireCompound.HARD: label = 'Hard'; bgColor = 'bg-white'; textColor='text-black'; break;
    case TireCompound.INTER: label = 'Inter'; bgColor = 'bg-green-500'; textColor='text-black'; break;
    case TireCompound.WET: label = 'Wet'; bgColor = 'bg-blue-600'; break;
  }

  return (
    <div className={`px-2 py-0.5 rounded-sm ${bgColor} ${textColor} text-[10px] font-bold uppercase tracking-wider min-w-[50px] text-center shadow-sm font-exo`}>
      {label}
    </div>
  );
};

const LiveLeaderboard: React.FC<Props> = ({ drivers }) => {
  return (
    <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-lg h-full flex flex-col overflow-hidden shadow-xl">
      <div className="px-4 py-3 border-b border-[#2A2A2A] bg-[#222]">
        <h3 className="font-orbitron font-bold text-sm text-neutral-300 uppercase tracking-widest">Live Leaderboard</h3>
      </div>
      
      <div className="overflow-auto flex-1 custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#1E1E1E] text-[11px] uppercase text-neutral-500 sticky top-0 z-10 font-bold tracking-wider border-b border-[#2A2A2A] font-orbitron">
            <tr>
              <th className="p-3 text-center w-10">Pos</th>
              <th className="p-3">Driver</th>
              <th className="p-3 text-right w-20">Gap</th>
              <th className="p-3 text-right w-20">Int</th>
              <th className="p-3 text-right hidden sm:table-cell">Last Lap</th>
              <th className="p-3 text-center">Tyre</th>
              <th className="p-3 text-center hidden md:table-cell">Pits</th>
            </tr>
          </thead>
          <tbody className="text-neutral-200 text-sm font-medium font-rajdhani">
            {drivers.map((driver) => {
               // Lap Time Color Logic
               // 0 = Standard (Neutral)
               // 1 = Personal Best (Green)
               // 2 = Session Best (Purple)
               let lapTimeColor = 'text-neutral-300'; 
               if (driver.currentSector1 === 2) {
                   lapTimeColor = 'text-purple-500 font-bold'; // Session Best
               } else if (driver.currentSector1 === 1) {
                   lapTimeColor = 'text-green-500 font-bold'; // Personal Best
               }
               
               // Gap Logic (To Leader)
               let gapDisplay = '-';
               if (driver.status === 'OUT') gapDisplay = 'DNF';
               else if (driver.position === 1) gapDisplay = 'LEADER';
               else if (driver.gapToLeader > 0) gapDisplay = `+${driver.gapToLeader.toFixed(3)}`;
               
               // Interval Logic (To Car Ahead)
               let intervalDisplay = '-';
               if (driver.status === 'OUT') intervalDisplay = '-';
               else if (driver.position === 1) intervalDisplay = '-';
               else if (driver.interval > 0) intervalDisplay = `+${driver.interval.toFixed(3)}`;

               // Row styling for DNF/OUT drivers and Leader
               const isOut = driver.status === 'OUT';
               const isLeader = driver.position === 1;

               let rowClass = 'border-b border-[#2A2A2A] transition-colors group text-base ';
               if (isOut) {
                   rowClass += 'bg-[#1a1a1a] text-neutral-600 grayscale hover:bg-[#202020]';
               } else if (isLeader) {
                   // Highlight leader with gold tint and border
                   rowClass += 'bg-yellow-900/10 hover:bg-yellow-900/20 border-l-4 border-l-yellow-500 relative';
               } else {
                   rowClass += 'hover:bg-[#252525] border-l-4 border-l-transparent';
               }

               return (
                <tr key={driver.id} className={rowClass}>
                  <td className={`p-3 text-center font-bold w-10 ${isOut ? 'text-red-600' : isLeader ? 'text-yellow-500 text-lg' : 'text-neutral-500 group-hover:text-white'} font-rajdhani`}>
                    {isOut ? 'DNF' : (driver.position === 0 ? '-' : driver.position)}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className={`relative w-8 h-8 rounded overflow-hidden shrink-0 border border-neutral-700 hidden sm:block ${isOut ? 'opacity-30' : 'bg-neutral-800'}`}>
                         {driver.imgUrl ? (
                           <img src={driver.imgUrl} alt={driver.code} className="w-full h-full object-cover object-top" />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-500 font-exo">{driver.code}</div>
                         )}
                         <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: driver.teamColor }}></div>
                      </div>
                      <div className="flex flex-col">
                         <div className="flex items-center gap-2">
                            <span className={`font-bold tracking-tight uppercase font-rajdhani text-lg leading-none ${isOut ? 'text-neutral-600' : isLeader ? 'text-yellow-100' : 'text-white group-hover:text-red-500 transition-colors'}`}>{driver.code}</span>
                            {/* DRS Indicator for specific driver */}
                            {driver.drsAvailable && !isOut && (
                               <div className="bg-green-500 text-black text-[9px] font-bold px-1 rounded font-exo leading-none py-0.5 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]">DRS</div>
                            )}
                         </div>
                         <span className="text-[10px] text-neutral-500 uppercase font-exo leading-none mt-0.5 hidden sm:block">{driver.team.split(' ')[0]}</span>
                      </div>
                    </div>
                  </td>
                  {/* GAP Column */}
                  <td className={`p-3 text-right font-rajdhani font-semibold tabular-nums ${isOut ? 'text-neutral-600 italic' : isLeader ? 'text-yellow-500' : 'text-neutral-300'}`}>
                     {gapDisplay}
                  </td>
                  {/* INT Column */}
                  <td className={`p-3 text-right font-rajdhani font-medium tabular-nums ${isOut ? 'text-neutral-700' : 'text-neutral-400'}`}>
                     {intervalDisplay}
                  </td>
                  <td className={`p-3 text-right font-rajdhani font-semibold tabular-nums hidden sm:table-cell ${isOut ? 'text-neutral-700' : lapTimeColor}`}>
                    {driver.lastLapTime}
                  </td>
                  <td className={`p-3 flex justify-center ${isOut ? 'opacity-30' : ''}`}>
                    <TireIcon compound={driver.tire} />
                  </td>
                   <td className="p-3 text-center text-neutral-500 font-rajdhani hidden md:table-cell">
                    {driver.pitStops}
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