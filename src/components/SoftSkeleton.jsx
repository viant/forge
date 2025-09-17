import React from 'react';
import './soft-loading.css';

export default function SoftSkeleton({ lines = 3, height = 12, className = '', style = {} }) {
  const rows = Array.from({ length: Math.max(1, lines) });
  return (
    <div className={`soft-skeleton ${className}`} style={style}>
      {rows.map((_, i) => (
        <div
          key={i}
          className="soft-skeleton-line"
          style={{ height, opacity: 0.9 - i * 0.08 }}
        />
      ))}
    </div>
  );
}

export function SoftBlock({ height = 120, className = '', style = {} }) {
  return <div className={`soft-skeleton-block ${className}`} style={{ height, ...style }} />;
}

