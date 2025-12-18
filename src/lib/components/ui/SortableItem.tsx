import React, { createContext, useContext } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableItemContext = createContext<any>(null);

export function useSortableHandle() {
  const context = useContext(SortableItemContext);
  if (!context) {
    throw new Error('useSortableHandle must be used within a SortableItem');
  }
  return context;
}

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
}

export function SortableItem({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: (isDragging ? 'relative' : undefined) as any,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'z-50' : ''}>
      <SortableItemContext.Provider value={{ attributes, listeners, isDragging }}>
        {children}
      </SortableItemContext.Provider>
    </div>
  );
}

interface DragHandleProps {
  children: React.ReactNode;
  className?: string;
}

export function DragHandle({ children, className }: DragHandleProps) {
  const { attributes, listeners } = useSortableHandle();
  return (
    <div {...attributes} {...listeners} className={className}>
      {children}
    </div>
  );
}