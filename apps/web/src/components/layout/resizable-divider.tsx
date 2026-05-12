"use client";

import { useCallback, useRef } from "react";

interface ResizableDividerProps {
  direction: "horizontal" | "vertical";
  onResize: (delta: number) => void;
}

export function ResizableDivider({ direction, onResize }: ResizableDividerProps) {
  const lastPos = useRef(0);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      lastPos.current = direction === "horizontal" ? e.clientX : e.clientY;

      document.body.style.userSelect = "none";
      document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
    },
    [direction],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!(e.buttons & 1)) return;

      const currentPos = direction === "horizontal" ? e.clientX : e.clientY;
      const delta = currentPos - lastPos.current;

      if (delta !== 0) {
        lastPos.current = currentPos;
        onResize(delta);
      }
    },
    [direction, onResize],
  );

  const handlePointerUp = useCallback(() => {
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, []);

  const isHorizontal = direction === "horizontal";

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative shrink-0 select-none touch-none transition-colors hover:bg-sidebar-hover ${
        isHorizontal
          ? "w-[3px] cursor-col-resize border-x border-border"
          : "h-[3px] cursor-row-resize border-y border-border"
      }`}
    >
      <div
        className={`absolute ${
          isHorizontal
            ? "inset-y-0 -left-1 -right-1"
            : "inset-x-0 -top-1 -bottom-1"
        }`}
      />
    </div>
  );
}
