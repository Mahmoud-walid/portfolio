'use client';

import { useLinkStatus } from 'next/link.js';

export default function LoadingIndicator() {
  const { pending } = useLinkStatus();
  return pending ? (
    <div className="absolute bottom-0 left-0 h-0.5 w-full animate-pulse bg-zinc-400"></div>
  ) : null;
}
