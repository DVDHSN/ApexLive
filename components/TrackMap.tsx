import React, { useState, useRef, useEffect } from 'react';
import { Driver } from '../types';
import { ZoomIn, ZoomOut, Maximize, Target } from 'lucide-react';

interface TrackMapProps {
  drivers: Driver[];
  trackPath: string | null;
  sectorPaths?: { s1: string, s2: string, s3: string } | null;
  activeSector?: 1 | 2 | 3 | null;
  playbackSpeed: number;
  driverCoordinates?: Record<string, {x: number, y: number}>;
  startLineCoordinates?: {x: number, y: number} | null;
  mapTransform?: { minX: number, minY: number, scale: number, offsetX: number, offsetY: number } | null;
  onDriverFollowed?: (driverId: string | null) => void;
  driverTelemetry?: { speed: number; gear: number; throttle: number; brake: number; rpm: number } | null;
}

const TrackMap: React.FC<TrackMapProps> = ({ 
  drivers, 
  trackPath,
  sectorPaths,
  activeSector, 
  playbackSpeed, 
  driverCoordinates, 
  startLineCoordinates, 
  mapTransform,
  onDriverFollowed,
  driverTelemetry
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredDriver, setHoveredDriver] = useState<Driver | null>(null);
  const [followedDriverId, setFollowedDriverId] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  // Sync internal follow state with parent
  useEffect(() => {
    if (onDriverFollowed) {
        onDriverFollowed(followedDriverId);
    }
  }, [followedDriverId, onDriverFollowed]);

  // Auto-follow logic
  useEffect(() => {
    if (followedDriverId && driverCoordinates && mapTransform) {
        const coords = driverCoordinates[followedDriverId];
        if (coords) {
             // Calculate Driver Position in SVG Space
             const cx = (coords.x - mapTransform.minX) * mapTransform.scale + mapTransform.offsetX;
             const cy = 800 - ((coords.y - mapTransform.minY) * mapTransform.scale + mapTransform.offsetY);
             
             // Center the view on the driver
             // Target SVG Center is 400,400
             setTransform(prev => ({
                 ...prev,
                 x: 400 - (cx * prev.k),
                 y: 400 - (cy * prev.k)
             }));
        }
    }
  }, [driverCoordinates, followedDriverId, mapTransform]);

  const handleWheel = (e: React.WheelEvent) => {
    // Zooming breaks follow mode to give user control
    if (followedDriverId) setFollowedDriverId(null);

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
    setFollowedDriverId(null); // Manual pan breaks follow mode
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
    setFollowedDriverId(null);
    setTransform({ x: 0, y: 0, k: 1 });
  };

  const handleDriverClick = (driverId: string) => {
      setFollowedDriverId(driverId);
      // Zoom in if we aren't already zoomed in significantly
      setTransform(prev => ({
          ...prev,
          k: Math.max(prev.k, 6) // Auto-zoom to 6x
      }));
  };

  // Safe Guard: Ensure mapTransform exists before rendering map details
  // If no track path is generated yet, show a loading state
  if (!trackPath || !mapTransform) {
    return (
      <div className="relative w-full h-full bg-[#1E1E1E] flex items-center justify-center text-neutral-600 text-xs font-medium animate-pulse uppercase tracking-widest font-exo">
        Generating Circuit Map...
      </div>
    );
  }

  // Calculate Start Line SVG Position
  let startCx = 0, startCy = 0;
  if (startLineCoordinates) {
      startCx = (startLineCoordinates.x - mapTransform.minX) * mapTransform.scale + mapTransform.offsetX;
      startCy = 800 - ((startLineCoordinates.y - mapTransform.minY) * mapTransform.scale + mapTransform.offsetY);
  }

  const followedDriver = drivers.find(d => d.id === followedDriverId);
  const activeDrivers = drivers.filter(d => d.status !== 'OUT');

  // Sector Color helper
  const getSectorColor = (sectorNum: number) => {
      if (!followedDriverId) return '#333'; // Default track color
      if (activeSector === sectorNum) return '#FACC15'; // Highlight (Yellow-400)
      return '#333'; // Dimmed
  };
  
  const getSectorOpacity = (sectorNum: number) => {
      if (!followedDriverId) return 1;
      if (activeSector === sectorNum) return 1;
      return 0.3;
  };
  
  const getSectorWidth = (sectorNum: number) => {
      if (followedDriverId && activeSector === sectorNum) return 8 / transform.k;
      return 6 / transform.k;
  }

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-[#1E1E1E] overflow-hidden cursor-move group select-none touch-none"
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
         PLAYBACK: <span className="text-red-500">{playbackSpeed}x</span>
      </div>

      {/* Follow Indicator */}
      {followedDriver && (
         <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 bg-red-900/20 border border-red-500/50 rounded shadow-lg backdrop-blur-md animate-pulse pointer-events-none">
            <Target size={14} className="text-red-500" />
            <span className="text-red-500 font-bold font-orbitron text-xs tracking-widest">LOCKED: {followedDriver.code}</span>
         </div>
      )}

      {/* Driver Telemetry HUD (Overlay) */}
      {followedDriver && driverTelemetry && (
        <div className="absolute bottom-20 sm:bottom-8 left-1/2 -translate-x-1/2 bg-[#0A0A0A]/90 backdrop-blur-md border border-neutral-700/50 p-4 rounded-lg shadow-2xl flex items-center gap-6 z-40 pointer-events-none min-w-[280px] justify-center">
             {/* Speed */}
             <div className="flex flex-col items-center">
                 <span className="text-[9px] text-neutral-500 uppercase font-bold tracking-widest mb-1">Speed</span>
                 <div className="text-3xl font-rajdhani font-bold text-white tabular-nums leading-none">
                    {driverTelemetry.speed} <span className="text-xs text-neutral-500 font-medium">km/h</span>
                 </div>
             </div>
             
             <div className="w-px h-8 bg-neutral-800"></div>
             
             {/* Gear */}
             <div className="flex flex-col items-center">
                 <span className="text-[9px] text-neutral-500 uppercase font-bold tracking-widest mb-1">Gear</span>
                 <div className="text-3xl font-rajdhani font-bold text-yellow-500 tabular-nums leading-none">
                    {driverTelemetry.gear === 0 ? 'N' : driverTelemetry.gear}
                 </div>
             </div>

             <div className="w-px h-8 bg-neutral-800"></div>

             {/* Inputs */}
             <div className="flex gap-1.5 h-8 items-end">
                 {/* Throttle */}
                 <div className="w-3 bg-neutral-800/50 rounded-sm overflow-hidden h-full relative border border-neutral-700/50">
                     <div className="absolute bottom-0 w-full bg-green-500 transition-all duration-75 ease-linear" style={{ height: `${driverTelemetry.throttle}%`}}></div>
                 </div>
                 {/* Brake */}
                 <div className="w-3 bg-neutral-800/50 rounded-sm overflow-hidden h-full relative border border-neutral-700/50">
                     <div className="absolute bottom-0 w-full bg-red-600 transition-all duration-75 ease-linear" style={{ height: `${driverTelemetry.brake}%`}}></div>
                 </div>
             </div>
        </div>
      )}

      {/* Zoom Controls (Mobile Friendly) */}
      <div className="absolute bottom-24 sm:bottom-4 right-4 z-20 flex flex-col gap-2">
         <button onClick={(e) => { e.stopPropagation(); setFollowedDriverId(null); setTransform(t => ({...t, k: Math.min(t.k * 1.5, 15)}))}} className="p-3 sm:p-2 bg-[#222] border border-[#333] text-neutral-400 hover:text-white hover:bg-[#333] rounded shadow-lg transition-colors">
            <ZoomIn size={20} />
         </button>
         <button onClick={(e) => { e.stopPropagation(); setFollowedDriverId(null); setTransform(t => ({...t, k: Math.max(t.k / 1.5, 0.5)}))}} className="p-3 sm:p-2 bg-[#222] border border-[#333] text-neutral-400 hover:text-white hover:bg-[#333] rounded shadow-lg transition-colors">
            <ZoomOut size={20} />
         </button>
         <button onClick={(e) => { e.stopPropagation(); resetView(); }} className="p-3 sm:p-2 bg-[#222] border border-[#333] text-neutral-400 hover:text-white hover:bg-[#333] rounded shadow-lg transition-colors" title="Reset View">
            <Maximize size={20} />
         </button>
      </div>

      {/* Driver Tooltip */}
      {hoveredDriver && !isDragging && (
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
        <g 
            transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`} 
            className={`pointer-events-auto ${followedDriverId ? 'transition-transform duration-300 ease-linear' : ''}`}
        >
            {/* Track Glow */}
            <path
              d={trackPath}
              fill="none"
              stroke={followedDriverId ? '#FACC15' : '#DC2626'}
              strokeWidth={14 / transform.k} 
              strokeOpacity={followedDriverId ? '0.05' : '0.1'}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="blur(4px)"
            />

            {/* SECTOR PATHS (On top of base if available) */}
            {sectorPaths ? (
                <>
                    <path d={sectorPaths.s1} fill="none" stroke={getSectorColor(1)} strokeWidth={getSectorWidth(1)} strokeOpacity={getSectorOpacity(1)} strokeLinecap="round" strokeLinejoin="round" />
                    <path d={sectorPaths.s2} fill="none" stroke={getSectorColor(2)} strokeWidth={getSectorWidth(2)} strokeOpacity={getSectorOpacity(2)} strokeLinecap="round" strokeLinejoin="round" />
                    <path d={sectorPaths.s3} fill="none" stroke={getSectorColor(3)} strokeWidth={getSectorWidth(3)} strokeOpacity={getSectorOpacity(3)} strokeLinecap="round" strokeLinejoin="round" />
                </>
            ) : (
                <path
                    d={trackPath}
                    fill="none"
                    stroke="#333"
                    strokeWidth={6 / transform.k}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            )}

            {/* Track Highlight (Centerline thin) */}
            <path
              d={trackPath}
              fill="none"
              stroke="#555"
              strokeWidth={1 / transform.k}
              strokeOpacity="0.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Start/Finish Line */}
            {startLineCoordinates && (
                <g transform={`translate(${startCx}, ${startCy})`}>
                    <line x1={-8/transform.k} y1={0} x2={8/transform.k} y2={0} stroke="white" strokeWidth={3/transform.k} strokeLinecap="square" />
                    <circle cx={0} cy={0} r={2/transform.k} fill="black" />
                    {/* Label scaling inversely to zoom so it remains readable */}
                    <text 
                        y={-6/transform.k} 
                        textAnchor="middle" 
                        fill="white" 
                        fontSize={8/transform.k} 
                        fontWeight="bold" 
                        className="font-exo"
                        style={{ textShadow: '0 0 4px black' }}
                    >
                        S/F
                    </text>
                </g>
            )}

            {/* Driver Markers */}
            {activeDrivers.map((driver) => {
              const coords = driverCoordinates?.[driver.id];
              
              // Only render if we have coordinates for this driver
              if (!coords) return null;

              // Transform raw GPS/Canvas coordinates to SVG Viewbox coordinates
              const cx = (coords.x - mapTransform.minX) * mapTransform.scale + mapTransform.offsetX;
              const cy = 800 - ((coords.y - mapTransform.minY) * mapTransform.scale + mapTransform.offsetY);

              // Dynamic radius
              const r = Math.max(3, 7 / Math.pow(transform.k, 0.6)); 
              const strokeWidth = 2 / transform.k;
              const isFollowed = followedDriverId === driver.id;

              return (
                <g key={driver.id} onClick={(e) => { e.stopPropagation(); handleDriverClick(driver.id); }}>
                    {/* Pulsing effect if followed */}
                    {isFollowed && (
                        <circle cx={cx} cy={cy} r={r * 3} fill={driver.teamColor} opacity="0.2">
                            <animate attributeName="r" from={r} to={r * 4} dur="1.5s" repeatCount="indefinite" />
                            <animate attributeName="opacity" from="0.4" to="0" dur="1.5s" repeatCount="indefinite" />
                        </circle>
                    )}
                    <circle 
                        cx={cx}
                        cy={cy}
                        r={r} 
                        fill={driver.teamColor} 
                        stroke={isFollowed ? 'white' : '#121212'} 
                        strokeWidth={isFollowed ? strokeWidth * 2 : strokeWidth}
                        className="cursor-pointer hover:stroke-white"
                        onMouseEnter={() => setHoveredDriver(driver)}
                        onMouseLeave={() => setHoveredDriver(null)}
                    />
                </g>
              );
            })}
        </g>
      </svg>
    </div>
  );
};

export default TrackMap;