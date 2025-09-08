"use client";
import { useState, useEffect } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { TileGenerateModal } from "./TileGenerateModal";

interface TileControlsProps {
  x: number;
  y: number;
  z: number;
  exists: boolean;
  onGenerate: (prompt: string) => Promise<void>;
  onRegenerate: (prompt: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onGenerateClick: () => void;
  forceOpenModal?: boolean;
  onModalOpenChange?: (open: boolean) => void;
}

export default function TileControls({ x, y, z, exists, onGenerate, onRegenerate, onDelete: _onDelete, onGenerateClick, forceOpenModal, onModalOpenChange }: TileControlsProps) {
  const [generateModalOpen, setGenerateModalOpen] = useState(false);

  // Handle forced modal opening from parent
  useEffect(() => {
    if (forceOpenModal) {
      setGenerateModalOpen(true);
    }
  }, [forceOpenModal]);

  const handleModalOpenChange = (open: boolean) => {
    setGenerateModalOpen(open);
    onModalOpenChange?.(open);
  };

  // Deletion capability removed

  return (
    <div className="flex gap-1">
      <Tooltip.Provider delayDuration={300}>
        {!exists ? (
          // Generate button for empty tiles
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button 
                className="w-7 h-7 rounded border border-emerald-700 bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-all hover:scale-110 hover:shadow-lg" 
                title="Generate tile"
                onClick={onGenerateClick}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className="bg-gray-900 text-white px-2 py-1 rounded text-xs leading-none z-[10002]" sideOffset={5}>
                Generate new tile
                <Tooltip.Arrow className="fill-gray-900" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        ) : (
          // Regenerate and Delete buttons for existing tiles
          <>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button 
                  className="w-7 h-7 rounded border border-blue-700 bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-all hover:scale-110 hover:shadow-lg" 
                  title="Regenerate tile"
                  onClick={onGenerateClick}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 8a6 6 0 1 0 6-6v3m0-3L5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="bg-gray-900 text-white px-2 py-1 rounded text-xs leading-none z-[10002]" sideOffset={5}>
                  Regenerate tile
                  <Tooltip.Arrow className="fill-gray-900" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>

            {/* Delete functionality removed */}
          </>
        )}
      </Tooltip.Provider>
      
      {/* Generate/Regenerate Modal */}
      <TileGenerateModal
        open={generateModalOpen}
        onClose={() => handleModalOpenChange(false)}
        x={x}
        y={y}
        z={z}
        onUpdate={() => {
          console.log('Generation successful, updating tiles...');
          // Force tile refresh by adding timestamp to bust cache
          const tiles = document.querySelectorAll('img[src*="/api/tiles/"]');
          tiles.forEach((img: Element) => {
            const htmlImg = img as HTMLImageElement;
            const url = new URL(htmlImg.src);
            url.searchParams.set('v', Date.now().toString());
            htmlImg.src = url.toString();
          });
        }}
      />
    </div>
  );
}