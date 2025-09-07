"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams as useSearchParamsHook } from "next/navigation";
import dynamic from "next/dynamic";
import { useClient } from "./ClientProvider";
import ApiKeyModal, { type ApiProvider } from "./ApiKeyModal";
import { signedFetch } from "@/lib/requestSigning";

const TileControls = dynamic(() => import("./TileControls"), { ssr: false });

const MAX_Z = Number(process.env.NEXT_PUBLIC_ZMAX ?? 8);

export default function MapClient() {
  const ref = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number; screenX: number; screenY: number } | null>(null);
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number; screenX: number; screenY: number } | null>(null);
  const selectedTileRef = useRef<typeof selectedTile>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const suppressOpenUntil = useRef<number>(0);
  const [tileExists, setTileExists] = useState<Record<string, boolean>>({});
  const router = useRouter();
  const searchParams = useSearchParamsHook();
  const updateTimeoutRef = useRef<any>(undefined);
  
  // API Key management
  const { apiKeyState, setApiKey, getDecryptedApiKey, clearApiKey } = useClient();
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [forceOpenTileModal, setForceOpenTileModal] = useState(false);

  useEffect(() => {
    selectedTileRef.current = selectedTile;
  }, [selectedTile]);

  // Removed automatic API key modal showing - now triggered only when generating

  // Handle clearing API key
  const handleClearApiKey = () => {
    clearApiKey();
    setShowApiKeyModal(true); // Show modal to enter new key
  };

  // Handle generate click - check API key before opening modal
  const handleGenerateClick = () => {
    if (!apiKeyState.apiKey) {
      console.log('🔐 No API key found, showing API key modal');
      setShowApiKeyModal(true);
    } else {
      console.log('🔐 API key found, opening tile generation modal');
      setForceOpenTileModal(true);
    }
  };

  // Handle tile modal state changes
  const handleTileModalOpenChange = (open: boolean) => {
    if (!open) {
      setForceOpenTileModal(false);
    }
  };

  // Close menu when clicking anywhere outside of it
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!selectedTileRef.current) return;
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
      
      // Check if click is inside a modal/dialog (Radix UI portals)
      const target = e.target as Element;
      const isInModal = target.closest('[data-radix-dialog-content]') || 
                       target.closest('[role="dialog"]') || 
                       target.closest('[data-modal]') ||
                       target.closest('[data-radix-alert-dialog-content]') ||
                       target.closest('[data-radix-dropdown-content]') ||
                       target.closest('[data-radix-tooltip-content]') ||
                       // Check for high z-index elements (modals, dropdowns, etc.)
                       (() => {
                         let el = target as Element | null;
                         while (el && el !== document.body) {
                           const style = window.getComputedStyle(el);
                           const zIndex = parseInt(style.zIndex);
                           if (zIndex >= 10000) return true;
                           el = el.parentElement;
                         }
                         return false;
                       })();
      
      if (isInModal) {
        return;
      }
      
      setSelectedTile(null);
      selectedTileRef.current = null;
      // Prevent the same click from immediately re-opening via map click
      suppressOpenUntil.current = performance.now() + 250;
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, []);

  // Update URL with debouncing
  const updateURL = useCallback((m: any) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = window.setTimeout(() => {
      const center = m.getCenter();
      const zoom = m.getZoom();
      const params = new URLSearchParams();
      params.set('z', zoom.toString());
      params.set('lat', center.lat.toFixed(6));
      params.set('lng', center.lng.toFixed(6));
      
      // Update URL without triggering navigation
      const newURL = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', newURL);
    }, 300); // Debounce for 300ms
  }, []);

  // Check if a tile exists
  const checkTileExists = useCallback(async (x: number, y: number) => {
    try {
      const response = await fetch(`/api/meta/${MAX_Z}/${x}/${y}`);
      const data = await response.json();
      const exists = data.status === "READY";
      setTileExists(prev => ({ ...prev, [`${x},${y}`]: exists }));
      return exists;
    } catch {
      return false;
    }
  }, []);

  // Handle tile generation
  const handleGenerate = useCallback(async (x: number, y: number, prompt: string) => {
    try {
      // Get decrypted API key - this will now be handled in TileGenerateModal
      const decryptedApiKey = await getDecryptedApiKey();
      if (!decryptedApiKey) {
        console.error('🔐 Failed to get decrypted API key for tile generation');
        return;
      }

      // Use signed requests for enhanced security
      const USE_SIGNED_REQUESTS = false; // Set to true to enable request signing
      
      let response: Response;
      if (USE_SIGNED_REQUESTS) {
        // Signed request - API key never transmitted
        response = await signedFetch(`/api/claim/${MAX_Z}/${x}/${y}`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-API-Provider": apiKeyState.provider || "Google"
          },
          body: JSON.stringify({ prompt })
        }, decryptedApiKey);
      } else {
        // Traditional request with API key in header
        response = await fetch(`/api/claim/${MAX_Z}/${x}/${y}`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-API-Key": decryptedApiKey,
            "X-API-Provider": apiKeyState.provider || "Google"
          },
          body: JSON.stringify({ prompt })
        });
      }
      
      if (response.ok) {
        // Start polling for completion
        if (map) {
          import('leaflet').then((L) => {
            pollTileStatus(x, y, map, L);
          });
        }
        setTileExists(prev => ({ ...prev, [`${x},${y}`]: true }));
      }
    } catch (error) {
      console.error("Failed to generate tile:", error);
      throw error;
    }
  }, [map, apiKeyState, getDecryptedApiKey]);

  // Handle tile regeneration
  const handleRegenerate = useCallback(async (x: number, y: number, prompt: string) => {
    try {
      // Get decrypted API key - this will now be handled in TileGenerateModal
      const decryptedApiKey = await getDecryptedApiKey();
      if (!decryptedApiKey) {
        console.error('Failed to decrypt API key');
        return;
      }

      const response = await fetch(`/api/invalidate/${MAX_Z}/${x}/${y}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-API-Key": decryptedApiKey,
          "X-API-Provider": apiKeyState.provider || "Google"
        },
        body: JSON.stringify({ prompt })
      });
      
      if (response.ok) {
        // Start polling for completion
        if (map) {
          import('leaflet').then((L) => {
            pollTileStatus(x, y, map, L);
          });
        }
      }
    } catch (error) {
      console.error("Failed to regenerate tile:", error);
      throw error;
    }
  }, [map, apiKeyState, getDecryptedApiKey]);

  // Handle tile deletion
  const handleDelete = useCallback(async (x: number, y: number) => {
    try {
      const response = await fetch(`/api/delete/${MAX_Z}/${x}/${y}`, {
        method: "DELETE"
      });
      
      if (response.ok) {
        // Force refresh tiles with a cache-busting URL so the deleted
        // tile is immediately replaced by the default image.
        const tileLayer = (map as any)?._tileLayer;
        if (tileLayer?.setUrl) {
          tileLayer.setUrl(`/api/tiles/{z}/{x}/{y}?v=${Date.now()}`);
        } else if (tileLayer) {
          // Fallback: remove/re-add the layer with a new timestamped template
          const L = await import('leaflet');
          (map as any).removeLayer(tileLayer);
          const newTileLayer = L.tileLayer(`/api/tiles/{z}/{x}/{y}?v=${Date.now()}`, { 
            tileSize: 256, 
            minZoom: 0, 
            maxZoom: MAX_Z, 
            noWrap: true,
            updateWhenIdle: false,
            updateWhenZooming: false,
            keepBuffer: 0,
            // Handle 404s by serving default tile
            errorTileUrl: '/api/default-tile'
          });
          newTileLayer.addTo(map as any);
          (map as any)._tileLayer = newTileLayer;
        }
        setTileExists(prev => ({ ...prev, [`${x},${y}`]: false }));
      }
    } catch (error) {
      console.error("Failed to delete tile:", error);
      throw error;
    }
  }, [map]);

  useEffect(() => {
    if (!ref.current || map) return;
    
    // Dynamic import for Leaflet to avoid SSR issues
    import('leaflet').then((L) => {
      // Parse initial position from URL
      const initialZoom = searchParams?.get('z') ? parseInt(searchParams.get('z')!) : 2;
      const initialLat = searchParams?.get('lat') ? parseFloat(searchParams.get('lat')!) : null;
      const initialLng = searchParams?.get('lng') ? parseFloat(searchParams.get('lng')!) : null;
      
      const m = L.map(ref.current!, { 
        crs: L.CRS.Simple, 
        minZoom: 0, 
        maxZoom: MAX_Z,
        zoom: initialZoom
      });
      
      const world = (1 << MAX_Z) * 256;
      const sw = m.unproject([0, world] as any, MAX_Z);
      const ne = m.unproject([world, 0] as any, MAX_Z);
      const bounds = new L.LatLngBounds(sw, ne);
      m.setMaxBounds(bounds);
      
      // Set initial view
      if (initialLat !== null && initialLng !== null) {
        m.setView([initialLat, initialLng], initialZoom);
      } else {
        m.fitBounds(bounds);
      }

      // Add timestamp to force fresh tiles on page load
      const tileLayer = L.tileLayer(`/api/tiles/{z}/{x}/{y}?v=${Date.now()}`, { 
        tileSize: 256, 
        minZoom: 0, 
        maxZoom: MAX_Z, 
        noWrap: true,
        updateWhenIdle: false,
        updateWhenZooming: false,
        keepBuffer: 0,
        // Handle 404s by serving default tile
        errorTileUrl: '/default-tile.webp'
      });
      tileLayer.addTo(m);
      
      // Store reference for refresh
      (m as any)._tileLayer = tileLayer;

      // Update URL when map moves
      m.on('moveend', () => updateURL(m));
      m.on('zoomend', () => updateURL(m));

      // Keep selected tile menu positioned correctly while moving/zooming
      const updateSelectedPosition = () => {
        const current = selectedTileRef.current;
        if (!current) return;
        const tileCenterWorld = L.point((current.x + 0.5) * 256, (current.y + 0.5) * 256);
        const tileCenterLatLng = m.unproject(tileCenterWorld, m.getZoom());
        const tileCenterScreen = m.latLngToContainerPoint(tileCenterLatLng);
        setSelectedTile(prev => prev ? ({ ...prev, screenX: tileCenterScreen.x, screenY: tileCenterScreen.y }) : prev);
      };
      m.on('move', updateSelectedPosition);
      m.on('zoomend', updateSelectedPosition);

      // Track mouse hover over tiles
      m.on("mousemove", async (e: any) => {
        if (m.getZoom() !== m.getMaxZoom()) {
          setHoveredTile(null);
          // Reset cursor when not interactive
          m.getContainer().style.cursor = '';
          return;
        }
        
        const p = m.project(e.latlng, m.getZoom());
        const x = Math.floor(p.x / 256);
        const y = Math.floor(p.y / 256);
        
        // Update hovered tile if changed
        if (!hoveredTile || hoveredTile.x !== x || hoveredTile.y !== y) {
          // Calculate the center of the tile
          const tileCenterWorld = L.point((x + 0.5) * 256, (y + 0.5) * 256);
          const tileCenterLatLng = m.unproject(tileCenterWorld, m.getZoom());
          const tileCenterScreen = m.latLngToContainerPoint(tileCenterLatLng);
          
          setHoveredTile({ 
            x, 
            y, 
            screenX: tileCenterScreen.x,
            screenY: tileCenterScreen.y
          });

          // Indicate clickable area via cursor
          m.getContainer().style.cursor = 'pointer';
          
          // Check if tile exists
          const key = `${x},${y}`;
          if (!(key in tileExists)) {
            checkTileExists(x, y);
          }
        }
      });

      m.on("mouseleave", () => {
        setHoveredTile(null);
        // Reset cursor when leaving the map
        m.getContainer().style.cursor = '';
      });

      m.on("zoomstart", () => {
        setHoveredTile(null);
        setSelectedTile(null);
      });

      // Open menu on click at max zoom without breaking drag
      m.on('click', (e: any) => {
        if (m.getZoom() !== m.getMaxZoom()) {
          return;
        }
        // If a menu is already open, close it instead of opening another
        if (selectedTileRef.current) {
          setSelectedTile(null);
          selectedTileRef.current = null;
          // Also update hover tile to current click position so the highlight can show
          const pNow = m.project(e.latlng, m.getZoom());
          const hx = Math.floor(pNow.x / 256);
          const hy = Math.floor(pNow.y / 256);
          const centerWorld = L.point((hx + 0.5) * 256, (hy + 0.5) * 256);
          const centerLatLng = m.unproject(centerWorld, m.getZoom());
          const centerScreen = m.latLngToContainerPoint(centerLatLng);
          setHoveredTile({ x: hx, y: hy, screenX: centerScreen.x, screenY: centerScreen.y });
          return;
        }
        // Respect suppression window set by outside clicks
        if (performance.now() < suppressOpenUntil.current) {
          return;
        }
        const p = m.project(e.latlng, m.getZoom());
        const x = Math.floor(p.x / 256);
        const y = Math.floor(p.y / 256);
        const tileCenterWorld = L.point((x + 0.5) * 256, (y + 0.5) * 256);
        const tileCenterLatLng = m.unproject(tileCenterWorld, m.getZoom());
        const tileCenterScreen = m.latLngToContainerPoint(tileCenterLatLng);
        setSelectedTile({ x, y, screenX: tileCenterScreen.x, screenY: tileCenterScreen.y });

        const key = `${x},${y}`;
        if (!(key in tileExists)) {
          checkTileExists(x, y);
        }
      });

      setMap(m);
      
      // Set initial URL if not already set
      if (!searchParams.get('z')) {
        updateURL(m);
      }
    });
  }, [map, searchParams, updateURL, hoveredTile, tileExists, checkTileExists]);

  // Poll for tile generation completion
  const pollTileStatus = async (x: number, y: number, m: any, L: any) => {
    let attempts = 0;
    const maxAttempts = 30; // Poll for up to 30 seconds
    
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/meta/${MAX_Z}/${x}/${y}`);
        const data = await response.json();
        
        if (data.status === "READY") {
          console.log(`Tile ready at ${MAX_Z}/${x}/${y}, refreshing...`);
          
          // Get the tile layer
          const tileLayer = (m as any)._tileLayer;
          if (tileLayer) {
            // Debug: log all tile keys to find the right format
            if (tileLayer._tiles) {
              console.log('Current tile keys:', Object.keys(tileLayer._tiles));
            }
            
            // Try different key formats
            const keys = [
              `${x}:${y}:${MAX_Z}`,
              `${MAX_Z}:${x}:${y}`,
              `${x}_${y}_${MAX_Z}`,
              `${MAX_Z}_${x}_${y}`
            ];
            
            let tileFound = false;
            for (const key of keys) {
              if (tileLayer._tiles && tileLayer._tiles[key]) {
                const tileEl = tileLayer._tiles[key].el;
                if (tileEl && tileEl.src) {
                  // Force reload with cache buster
                  tileEl.src = `/api/tiles/${MAX_Z}/${x}/${y}?t=${Date.now()}`;
                  console.log(`Updated tile src with key ${key}: ${tileEl.src}`);
                  tileFound = true;
                  break;
                }
              }
            }
            
            if (!tileFound) {
              console.log(`Tile not found in DOM, forcing full redraw`);
              // Remove and re-add the layer with new timestamp
              m.removeLayer(tileLayer);
              const newTileLayer = L.tileLayer(`/api/tiles/{z}/{x}/{y}?v=${Date.now()}`, { 
                tileSize: 256, 
                minZoom: 0, 
                maxZoom: MAX_Z, 
                noWrap: true,
                updateWhenIdle: false,
                updateWhenZooming: false,
                keepBuffer: 0,
                // Handle 404s by serving default tile
                errorTileUrl: '/default-tile.webp'
              });
              newTileLayer.addTo(m);
              (m as any)._tileLayer = newTileLayer;
            }
          }
        } else if (data.status === "PENDING" && attempts < maxAttempts) {
          attempts++;
          setTimeout(checkStatus, 1000); // Check again in 1 second
        }
      } catch (error) {
        console.error("Error checking tile status:", error);
      }
    };
    
    setTimeout(checkStatus, 1000); // Start checking after 1 second
  };

  return (
    <div className="w-full h-full relative">
      <div className="p-3 z-10 absolute top-2 left-2 bg-white/90 rounded-xl shadow-lg flex flex-col gap-2">
        <div className="text-sm text-gray-600">
          {map && map.getZoom() === MAX_Z ? 
            "Hover to highlight, click to open menu" : 
            "Zoom to max level to interact with tiles"}
        </div>
        {searchParams.get('z') && (
          <div className="text-xs text-gray-400">
            Position: z={searchParams.get('z')}, lat={searchParams.get('lat')}, lng={searchParams.get('lng')}
          </div>
        )}
      </div>

      {/* API Key Status & Clear Button */}
      <div className="z-[9999] absolute top-2 right-2 bg-white/90 rounded-xl shadow-lg">
        {apiKeyState.apiKey ? (
          <div className="p-3 flex items-center gap-3">
            <div className="flex flex-col">
              <div className="text-sm font-medium text-gray-700">
                {apiKeyState.provider} API
              </div>
              <div className="text-xs text-green-600 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Connected
              </div>
            </div>
            <button
              onClick={handleClearApiKey}
              className="px-3 py-1.5 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
              title="Clear API Key"
            >
              Clear
            </button>
          </div>
        ) : (
          <div className="p-3">
            <button
              onClick={() => setShowApiKeyModal(true)}
              className="px-3 py-1.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
            >
              Set API Key
            </button>
          </div>
        )}
      </div>
      
      {/* Hover highlight at max zoom (visual only, non-interactive) */}
      {hoveredTile && !selectedTile && map && map.getZoom() === MAX_Z && (
        <div
          className="absolute"
          style={{
            left: hoveredTile.screenX - 128,
            top: hoveredTile.screenY - 128,
            width: 256,
            height: 256,
            background: 'rgba(255,255,255,0.1)',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        />
      )}

      {/* Tile menu shown on click */}
      {selectedTile && map && map.getZoom() === MAX_Z && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: selectedTile.screenX,
            top: selectedTile.screenY,
            transform: 'translate(-50%, -50%)',
            zIndex: 500,
          }}
        >
          <div
            ref={menuRef}
            className="pointer-events-auto bg-white rounded-lg shadow-xl p-2 border border-gray-200"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs text-gray-500 mb-1">
              Tile ({selectedTile.x}, {selectedTile.y})
            </div>
            <TileControls
              x={selectedTile.x}
              y={selectedTile.y}
              z={MAX_Z}
              exists={tileExists[`${selectedTile.x},${selectedTile.y}`] || false}
              onGenerate={(prompt) => handleGenerate(selectedTile.x, selectedTile.y, prompt)}
              onRegenerate={(prompt) => handleRegenerate(selectedTile.x, selectedTile.y, prompt)}
              onDelete={() => handleDelete(selectedTile.x, selectedTile.y)}
              onGenerateClick={handleGenerateClick}
              forceOpenModal={forceOpenTileModal}
              onModalOpenChange={handleTileModalOpenChange}
            />
          </div>
        </div>
      )}
      
      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onSave={async (apiKey: string, provider: ApiProvider) => {
          await setApiKey(apiKey, provider);
          setShowApiKeyModal(false);
          // After setting API key, open the tile modal
          setForceOpenTileModal(true);
        }}
      />
      
      {/* Instructions message at bottom */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-[1100]">
        <div className="bg-black/75 text-white px-4 py-2 rounded-lg text-sm max-w-md text-center backdrop-blur-sm">
          <div className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              {map && map.getZoom() === MAX_Z ? 
                "Click any tile to open generation menu" : 
                "Zoom to max level → Click tile → Generate content"}
            </span>
          </div>
        </div>
      </div>

      <div ref={ref} className="w-full h-full" />
    </div>
  );
}
