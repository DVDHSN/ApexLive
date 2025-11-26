import React, { useState, useRef } from 'react';
import { Driver } from '../types';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface TrackMapProps {
  drivers: Driver[];
  trackPath: string | null;
  playbackSpeed: number;
  driverCoordinates?: Record<string, {x: number, y: number}>;
  mapTransform?: { minX: number, minY: number, scale: number, offsetX: number, offsetY: number } | null;
}

const TrackMap: React.FC<TrackMapProps> = ({ drivers, trackPath, playbackSpeed, driverCoordinates, mapTransform }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredDriver, setHoveredDriver] = useState<Driver | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  // If no track path is generated yet, show a loading state
  if (!trackPath || !mapTransform) {
    return (
      <div className="relative w-full h-full bg-[#1E1E1E] flex items-center justify-center text-neutral-600 text-xs font-medium animate-pulse uppercase tracking-widest font-exo">
        Generating Circuit Map...
      </div>
    );
  }

  // Filter out retired drivers
  const activeDrivers = drivers.filter(d => d.status !== 'OUT');

  const handleWheel = (e: React.WheelEvent) => {
    // Zoom logic
    const zoomIntensity = 0.1;
    const direction = e.deltaY < 0 ? 1 : -1;
    const factor = Math.exp(direction * zoomIntensity);
    
    // Limit zoom level
    const newScale = Math.min(Math.max(0.5, transform.k * factor), 15);
    
    if (containerRef.current) {
       const rect = containerRef.current.getBoundingClientRect();
       const offsetX = e.clientX - rect.left;
       const offsetY = e.clientY - rect.top;
       
       // Calculate new position to keep the point under cursor stable
       const newX = offsetX - (offsetX - transform.x) * (newScale / transform.k);
       const newY = offsetY - (offsetY - transform.y) * (newScale / transform.k);
       
       setTransform({ x: newX, y: newY, k: newScale });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setTransform({
        ...transform,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
    // Update cursor pos for tooltip
    if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    setTransform({ x: 0, y: 0, k: 1 });
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-[#1E1E1E] overflow-hidden cursor-move group select-none"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ 
          backgroundImage: 'linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)', 
          backgroundSize: `${40 * transform.k}px ${40 * transform.k}px`,
          backgroundPosition: `${transform.x}px ${transform.y}px`
      }}></div>

      {/* Speed Indicator */}
      <div className="absolute top-4 right-4 z-20 text-xs font-bold text-neutral-500 bg-[#121212]/80 px-2 py-1 rounded border border-[#333] font-rajdhani pointer-events-none">
         SPEED: <span className="text-red-500">{playbackSpeed}x</span>
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-2">
         <button onClick={(e) => { e.stopPropagation(); setTransform(t => ({...t, k: Math.min(t.k * 1.5, 15)}))}} className="p-2 bg-[#222] border border-[#333] text-neutral-400 hover:text-white hover:bg-[#333] rounded shadow-lg transition-colors">
            <ZoomIn size={16} />
         </button>
         <button onClick={(e) => { e.stopPropagation(); setTransform(t => ({...t, k: Math.max(t.k / 1.5, 0.5)}))}} className="p-2 bg-[#222] border border-[#333] text-neutral-400 hover:text-white hover:bg-[#333] rounded shadow-lg transition-colors">
            <ZoomOut size={16} />
         </button>
         <button onClick={(e) => { e.stopPropagation(); resetView(); }} className="p-2 bg-[#222] border border-[#333] text-neutral-400 hover:text-white hover:bg-[#333] rounded shadow-lg transition-colors" title="Reset View">
            <Maximize size={16} />
         </button>
      </div>

      {/* Driver Tooltip */}
      {hoveredDriver && (
         <div 
            className="absolute z-30 bg-[#121212]/95 border border-[#333] p-2.5 rounded shadow-2xl backdrop-blur-sm flex items-center gap-3 pointer-events-none min-w-[160px]"
            style={{ 
               left: cursorPos.x + 15, 
               top: cursorPos.y + 15,
            }}
         >
            <div className="w-1.5 h-8 rounded-full shadow-[0_0_10px_currentColor]" style={{ backgroundColor: hoveredDriver.teamColor, color: hoveredDriver.teamColor }}></div>
            <div>
               <div className="text-[10px] text-neutral-400 font-exo uppercase tracking-wider">{hoveredDriver.team}</div>
               <div className="text-sm text-white font-orbitron font-bold leading-none mb-0.5">{hoveredDriver.name}</div>
               <div className="text-[10px] text-neutral-500 font-rajdhani">POS: <span className="text-white font-bold text-xs">{hoveredDriver.position}</span></div>
            </div>
         </div>
      )}

      <svg viewBox="0 0 800 800" className="w-full h-full block pointer-events-none">
        {/* We apply pointer-events-auto to contents we want to interact with */}
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`} className="pointer-events-auto">
            {/* Track Outline (Glow) */}
            <path
              d={trackPath}
              fill="none"
              stroke="#DC2626"
              strokeWidth={14 / transform.k} 
              strokeOpacity="0.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="blur(4px)"
            />
            {/* Main Track */}
            <path
              d={trackPath}
              fill="none"
              stroke="#333"
              strokeWidth={6 / transform.k}
              strokeLinecap="round"
              strokeLinejoin="round"
              id="raceTrack"
            />
            {/* Track Highlight */}
            <path
              d={trackPath}
              fill="none"
              stroke="#555"
              strokeWidth={1 / transform.k}
              strokeOpacity="0.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Driver Markers */}
            {activeDrivers.map((driver) => {
              const coords = driverCoordinates?.[driver.id];
              
              // Only render if we have coordinates for this driver
              if (!coords) return null;

              // Transform raw GPS/Canvas coordinates to SVG Viewbox coordinates
              // cx = (x - minX) * scale + offsetX
              // cy = 800 - ((y - minY) * scale + offsetY)
              const cx = (coords.x - mapTransform.minX) * mapTransform.scale + mapTransform.offsetX;
              const cy = 800 - ((coords.y - mapTransform.minY) * mapTransform.scale + mapTransform.offsetY);

              // Dynamic radius
              const r = Math.max(3, 7 / Math.pow(transform.k, 0.6)); 
              const strokeWidth = 2 / transform.k;

              return (
                <circle 
                    key={driver.id} 
                    cx={cx}
                    cy={cy}
                    r={r} 
                    fill={driver.teamColor} 
                    stroke="#121212" 
                    strokeWidth={strokeWidth}
                    className="cursor-pointer hover:stroke-white transition-all duration-1000 ease-linear"
                    onMouseEnter={() => setHoveredDriver(driver)}
                    onMouseLeave={() => setHoveredDriver(null)}
                />
              );
            })}
        </g>
      </svg>
    </div>
  );
};

export default TrackMap;