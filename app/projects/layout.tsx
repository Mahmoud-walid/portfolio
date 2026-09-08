import { ReactNode } from 'react';

export default function ProjectsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-linear-to-tl from-zinc-900 via-zinc-400/10 to-zinc-900">
      {children}
    </div>
  );
}
