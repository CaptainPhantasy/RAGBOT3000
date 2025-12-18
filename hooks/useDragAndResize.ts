import { useCallback, useEffect, useRef, useState } from 'react';

export const useDragAndResize = () => {
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const [previewSize, setPreviewSize] = useState({ width: 256, height: 144 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);

  const dragStateRef = useRef({
    isActive: false,
    startX: 0,
    startY: 0,
    startPosX: 0,
    startPosY: 0,
    thresholdMet: false,
  });

  const resizeStateRef = useRef({
    isActive: false,
    handle: null as string | null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    startPosX: 0,
    startPosY: 0,
  });

  const previewPositionRef = useRef(previewPosition);
  const previewSizeRef = useRef(previewSize);

  useEffect(() => {
    previewPositionRef.current = previewPosition;
  }, [previewPosition]);

  useEffect(() => {
    previewSizeRef.current = previewSize;
  }, [previewSize]);

  const DRAG_THRESHOLD = 5;

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (resizeStateRef.current.isActive) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-resize-handle]')) return;

    dragStateRef.current = {
      isActive: false,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: previewPositionRef.current.x,
      startPosY: previewPositionRef.current.y,
      thresholdMet: false,
    };
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const { innerWidth: vw, innerHeight: vh } = window;
    const MIN_WIDTH = 160;
    const MIN_HEIGHT = 90;

    if (dragStateRef.current.startX !== 0) {
      const deltaX = e.clientX - dragStateRef.current.startX;
      const deltaY = e.clientY - dragStateRef.current.startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (!dragStateRef.current.thresholdMet) {
        if (distance >= DRAG_THRESHOLD) {
          dragStateRef.current.thresholdMet = true;
          dragStateRef.current.isActive = true;
          setIsDragging(true);
          document.body.style.cursor = 'grabbing';
        } else {
          return;
        }
      }

      if (dragStateRef.current.isActive) {
        const newX = dragStateRef.current.startPosX + deltaX;
        const newY = dragStateRef.current.startPosY + deltaY;
        const maxX = vw - previewSizeRef.current.width;
        const maxY = vh - previewSizeRef.current.height;
        setPreviewPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY)),
        });
      }
    }

    if (resizeStateRef.current.isActive && resizeStateRef.current.handle) {
      const handle = resizeStateRef.current.handle;
      const deltaX = e.clientX - resizeStateRef.current.startX;
      const deltaY = e.clientY - resizeStateRef.current.startY;
      const aspectRatio = resizeStateRef.current.startWidth / resizeStateRef.current.startHeight;

      let newWidth = resizeStateRef.current.startWidth;
      let newHeight = resizeStateRef.current.startHeight;
      let newX = resizeStateRef.current.startPosX;
      let newY = resizeStateRef.current.startPosY;

      if (handle.includes('corner')) {
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);
        if (absDeltaX > absDeltaY) {
          if (handle.includes('right')) newWidth = Math.max(MIN_WIDTH, resizeStateRef.current.startWidth + deltaX);
          else {
            newWidth = Math.max(MIN_WIDTH, resizeStateRef.current.startWidth - deltaX);
            newX = resizeStateRef.current.startPosX + (resizeStateRef.current.startWidth - newWidth);
          }
          newHeight = newWidth / aspectRatio;
          if (handle.includes('top'))
            newY = resizeStateRef.current.startPosY + (resizeStateRef.current.startHeight - newHeight);
        } else {
          if (handle.includes('bottom')) newHeight = Math.max(MIN_HEIGHT, resizeStateRef.current.startHeight + deltaY);
          else {
            newHeight = Math.max(MIN_HEIGHT, resizeStateRef.current.startHeight - deltaY);
            newY = resizeStateRef.current.startPosY + (resizeStateRef.current.startHeight - newHeight);
          }
          newWidth = newHeight * aspectRatio;
          if (handle.includes('left'))
            newX = resizeStateRef.current.startPosX + (resizeStateRef.current.startWidth - newWidth);
        }
      } else {
        if (handle === 'right')
          newWidth = Math.max(
            MIN_WIDTH,
            Math.min(resizeStateRef.current.startWidth + deltaX, vw - resizeStateRef.current.startPosX),
          );
        else if (handle === 'left') {
          const widthChange = Math.max(
            0,
            Math.min(deltaX, resizeStateRef.current.startPosX + resizeStateRef.current.startWidth - MIN_WIDTH),
          );
          newWidth = resizeStateRef.current.startWidth - widthChange;
          newX = resizeStateRef.current.startPosX + widthChange;
        } else if (handle === 'bottom')
          newHeight = Math.max(
            MIN_HEIGHT,
            Math.min(resizeStateRef.current.startHeight + deltaY, vh - resizeStateRef.current.startPosY),
          );
        else if (handle === 'top') {
          const heightChange = Math.max(
            0,
            Math.min(deltaY, resizeStateRef.current.startPosY + resizeStateRef.current.startHeight - MIN_HEIGHT),
          );
          newHeight = resizeStateRef.current.startHeight - heightChange;
          newY = resizeStateRef.current.startPosY + heightChange;
        }
      }
      const maxX = vw - newWidth;
      const maxY = vh - newHeight;
      const constrainedX = Math.max(0, Math.min(newX, maxX));
      const constrainedY = Math.max(0, Math.min(newY, maxY));
      setPreviewPosition({ x: constrainedX, y: constrainedY });
      setPreviewSize({
        width: Math.max(MIN_WIDTH, Math.min(newWidth, vw - constrainedX)),
        height: Math.max(MIN_HEIGHT, Math.min(newHeight, vh - constrainedY)),
      });
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    if (dragStateRef.current.startX !== 0) {
      setIsDragging(false);
      dragStateRef.current = { isActive: false, startX: 0, startY: 0, startPosX: 0, startPosY: 0, thresholdMet: false };
      document.body.style.cursor = '';
    }
    if (resizeStateRef.current.isActive) {
      setIsResizing(null);
      resizeStateRef.current = {
        isActive: false,
        handle: null,
        startX: 0,
        startY: 0,
        startWidth: 0,
        startHeight: 0,
        startPosX: 0,
        startPosY: 0,
      };
      document.body.style.cursor = '';
    }
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const getResizeCursor = useCallback((handle: string) => {
    if (handle.includes('corner')) {
      if (handle.includes('top-left') || handle.includes('bottom-right')) return 'nwse-resize';
      return 'nesw-resize';
    }
    if (handle.includes('top') || handle.includes('bottom')) return 'ns-resize';
    return 'ew-resize';
  }, []);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, handle: string) => {
      resizeStateRef.current = {
        isActive: true,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: previewSizeRef.current.width,
        startHeight: previewSizeRef.current.height,
        startPosX: previewPositionRef.current.x,
        startPosY: previewPositionRef.current.y,
      };
      setIsResizing(handle);
      document.body.style.cursor = getResizeCursor(handle);
      document.body.style.userSelect = 'none';
      e.preventDefault();
      e.stopPropagation();
    },
    [getResizeCursor],
  );

  return {
    previewPosition,
    previewSize,
    isDragging,
    isResizing,
    setPreviewPosition,
    setPreviewSize,
    handleDragStart,
    handleResizeStart,
    getResizeCursor,
  };
};
