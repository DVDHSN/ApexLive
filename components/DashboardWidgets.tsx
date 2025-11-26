import React from 'react';
import { RaceControlMessage, WeatherData } from '../types';
import { CloudRain, Wind, Thermometer, AlertTriangle } from 'lucide-react';

// --- Track Status Panel (Deprecated here, moved to main layout, but kept for legacy or alternative use) ---
export const TrackStatusPanel = ({ status, time }: { status: 'GREEN' | 'YELLOW' | 'SC' | 'VSC' | 'RED', time: string }) => {
  return null; // Component moved to App.tsx for better layout control
};

// --- Incident Feed ---
export const IncidentFeed = ({ messages }: { messages: RaceControlMessage[] }) => {
  return (
    <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-lg flex flex-col h-full overflow-hidden shadow-lg">
      <div className="px-4 py-3 border-b border-[#2A2A2A] bg-[#222] flex justify-between items-center">
        <h3 className="font-orbitron font-bold text-sm text-neutral-300 uppercase tracking-widest">Incident Feed</h3>
        <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs custom-scrollbar font-exo">
        {messages.length === 0 && <div className="text-neutral-600 italic">No incidents reported.</div>}
        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-3 border-l-2 border-[#333] pl-2 hover:border-red-600 transition-colors">
             <span className="text-neutral-500 shrink-0 font-mono">{msg.timestamp}</span>
             <span className={`${msg.message.includes('SAFETY CAR') || msg.message.includes('YELLOW') ? 'text-yellow-400' : 'text-neutral-300'} font-medium`}>
               {msg.flag && <span className="font-bold mr-1 text-red-500">[{msg.flag}]</span>}
               {msg.message}
             </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Weather Widget ---
export const WeatherWidget = ({ weather }: { weather: WeatherData | null }) => {
  return (
    <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-lg p-4 flex flex-col justify-between h-full shadow-lg">
      <h3 className="font-orbitron font-bold text-sm text-neutral-300 mb-2 uppercase tracking-widest border-b border-[#2A2A2A] pb-2">Weather</h3>
      
      {!weather ? (
         <div className="text-neutral-600 text-xs italic font-exo">Loading telemetry...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-full items-center">
           <div className="flex items-center gap-3 justify-center md:justify-start">
              <Thermometer className="text-neutral-500" size={20} />
              <div>
                 <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider font-exo">Air</div>
                 <div className="text-2xl font-rajdhani font-bold text-white">{weather.air_temperature?.toFixed(1)}°</div>
              </div>
           </div>
           <div className="flex items-center gap-3 justify-center md:justify-start">
              <Thermometer className="text-red-600" size={20} />
              <div>
                 <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider font-exo">Track</div>
                 <div className="text-2xl font-rajdhani font-bold text-red-500">{weather.track_temperature?.toFixed(1)}°</div>
              </div>
           </div>
           <div className="flex items-center gap-3 justify-center md:justify-start">
              <Wind className="text-neutral-400" size={20} />
              <div>
                 <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider font-exo">Wind</div>
                 <div className="text-2xl font-rajdhani font-bold text-white">{weather.wind_speed?.toFixed(1)}</div>
              </div>
           </div>
           <div className="flex items-center gap-3 justify-center md:justify-start">
              <CloudRain className="text-blue-500" size={20} />
              <div>
                 <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider font-exo">Rain</div>
                 <div className="text-2xl font-rajdhani font-bold text-white">{weather.rainfall > 0 ? 'YES' : 'NO'}</div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};