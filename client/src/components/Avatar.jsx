import React, { useState, useEffect } from 'react';

// Round profile picture, or the person's first initial when they have none.
// Size / text size come from className (e.g. "h-8 w-8 text-xs").
export default function Avatar({ src, name = '', className = 'h-10 w-10 text-sm' }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);

  if (src && !broken) {
    return <img src={src} alt={name} onError={() => setBroken(true)} className={`${className} flex-shrink-0 rounded-full object-cover`} />;
  }
  return (
    <div className={`${className} grid flex-shrink-0 place-items-center rounded-full bg-brand-100 font-bold text-brand-700`}>
      {name?.replace(/^dr\.?\s*/i, '').slice(0, 1)?.toUpperCase() || '?'}
    </div>
  );
}