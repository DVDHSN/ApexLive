import React from 'react';
import { RaceControlMessage, WeatherData } from '../types';
import { CloudRain, Wind, Thermometer, AlertTriangle, Flag, Info } from 'lucide-react';

export const TrackStatusPanel = ({ status, time }: { status: 'GREEN' | 'YELLOW' | 'SC' | 'VSC' | 'RED', time: string }) => {
  return null; 
};

// --- Incident Feed ---
export const IncidentFeed = ({ messages }: { messages: RaceControlMessage[] }) => {
  return (
    <div className="flex flex-col h-full bg-[#111]">
      <div className="px-4 py-3 border-b border-[#222] bg-[#151515] flex justify-between items-center shrink-0">
        <h3 className="font-orbitron font-bold text-xs text-neutral-300 uppercase tracking-widest flex items-center gap-2">
            <Info size={12} className="text-red-500" /> Race Control Messages
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-0 text-xs custom-scrollbar font-exo">
        {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-neutral-700 italic">No messages received</div>
        )}
        {messages.map((msg) => {
           let borderClass = 'border-l-2 border-neutral-800';
           let bgClass = 'hover:bg-[#1a1a1a]';
           let textClass = 'text-neutral-300';
           
           if (msg.message.includes('YELLOW') || msg.message.includes('SAFETY CAR')) {
               borderClass = 'border-l-2 border-yellow-500';
               bgClass = 'bg-yellow-900/10 hover:bg-yellow-900/20';
               textClass = 'text-yellow-200';
           } else if (msg.message.includes('RED') || msg.message.includes('STOPPED') || msg.message.includes('INCIDENT') || msg.message.includes('PENALTY')) {
               borderClass = 'border-l-2 border-red-600';
               bgClass = 'bg-red-900/10 hover:bg-red-900/20';
               textClass = 'text-red-200';
           } else if (msg.message.includes('GREEN') || msg.message.includes('CLEAR')) {
               borderClass = 'border-l-2 border-green-500';
               textClass = 'text-green-200';
           }

           return (
            <div key={msg.id} className={`flex gap-3 py-2 px-4 border-b border-[#1a1a1a] transition-colors ${borderClass} ${bgClass}`}>
                <span className="text-neutral-500 shrink-0 font-mono text-[10px] pt-0.5 opacity-70">{msg.timestamp}</span>
                <span className={`${textClass} font-medium leading-relaxed`}>
                {msg.flag && <span className="font-bold mr-1.5 px-1 py-0.5 bg-neutral-800 rounded text-[9px] uppercase tracking-wider text-neutral-300">{msg.flag}</span>}
                {msg.message}
                </span>
            </div>
           );
        })}
      </div>
    </div>
  );
};

// --- Weather Widget ---
export const WeatherWidget = ({ weather }: { weather: WeatherData | null }) => {
  return (
    <div className="flex flex-col h-full bg-[#111]">
      <div className="px-4 py-2 border-b border-[#222] bg-[#151515] shrink-0">
         <h3 className="font-orbitron font-bold text-xs text-neutral-300 uppercase tracking-widest">Track Conditions</h3>
      </div>
      
      {!weather ? (
         <div className="flex-1 flex items-center justify-center text-neutral-700 text-xs italic font-exo">Waiting for telemetry...</div>
      ) : (
        <div className="flex-1 grid grid-cols-4 gap-0 divide-x divide-[#222]">
           
           {/* Air Temp */}
           <div className="flex flex-col items-center justify-center p-2 hover:bg-[#1a1a1a] transition-colors group">
              <div className="flex items-center gap-1.5 mb-1 opacity-50 group-hover:opacity-100 transition-opacity">
                  <Thermometer size={14} className="text-neutral-400" />
                  <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-500">Air</span>
              </div>
              <div className="text-xl font-rajdhani font-bold text-white">{weather.air_temperature?.toFixed(1)}<span className="text-xs text-neutral-600 align-top">°C</span></div>
           </div>

           {/* Track Temp */}
           <div className="flex flex-col items-center justify-center p-2 hover:bg-[#1a1a1a] transition-colors group">
              <div className="flex items-center gap-1.5 mb-1 opacity-50 group-hover:opacity-100 transition-opacity">
                  <Thermometer size={14} className="text-red-500" />
                  <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-500">Track</span>
              </div>
              <div className="text-xl font-rajdhani font-bold text-red-100">{weather.track_temperature?.toFixed(1)}<span className="text-xs text-red-900/60 align-top">°C</span></div>
           </div>

           {/* Wind */}
           <div className="flex flex-col items-center justify-center p-2 hover:bg-[#1a1a1a] transition-colors group">
              <div className="flex items-center gap-1.5 mb-1 opacity-50 group-hover:opacity-100 transition-opacity">
                  <Wind size={14} className="text-blue-400" />
                  <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-500">Wind</span>
              </div>
              <div className="text-xl font-rajdhani font-bold text-white">{weather.wind_speed?.toFixed(1)}<span className="text-xs text-neutral-600 ml-1">m/s</span></div>
           </div>

           {/* Rain */}
           <div className="flex flex-col items-center justify-center p-2 hover:bg-[#1a1a1a] transition-colors group">
              <div className="flex items-center gap-1.5 mb-1 opacity-50 group-hover:opacity-100 transition-opacity">
                  <CloudRain size={14} className={weather.rainfall > 0 ? "text-blue-500" : "text-neutral-600"} />
                  <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-500">Rain</span>
              </div>
              <div className={`text-xl font-rajdhani font-bold ${weather.rainfall > 0 ? 'text-blue-400' : 'text-neutral-500'}`}>
                  {weather.rainfall > 0 ? 'YES' : 'NO'}
              </div>
           </div>

        </div>
      )}
    </div>
  );
};