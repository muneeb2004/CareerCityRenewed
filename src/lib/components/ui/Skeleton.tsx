import React from 'react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-200/80 ${className}`}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="glass p-5 rounded-xl border border-white/60 h-full">
      <div className="flex flex-col items-center space-y-4">
        <Skeleton className="h-32 w-32 rounded-lg" />
        <div className="space-y-2 w-full">
          <Skeleton className="h-6 w-3/4 mx-auto" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
        </div>
      </div>
    </div>
  );
}

export function ListRowSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 glass rounded-xl border border-white/60">
      <div className="space-y-3 w-full">
        <Skeleton className="h-5 w-1/3" />
        <div className="flex gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <div className="flex items-center space-x-4 py-4">
      <div className="space-y-2 w-full">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
