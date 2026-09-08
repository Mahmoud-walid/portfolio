import { Suspense } from 'react';
import data from '../../../data.json';
import { Navigation } from '../../components/nav';
import ProjectsComponent from '../../projects/projects';

interface ProjectsPageProps {
  username: string;
  isCustomUser?: boolean;
}

export function ProjectsPage({
  username,
  isCustomUser = false,
}: ProjectsPageProps) {
  return (
    <div className="relative pt-4 pb-16">
      <Navigation username={isCustomUser ? username : undefined} />
      <div className="mx-auto max-w-7xl space-y-8 px-6 pt-16 md:space-y-12 md:pt-24 lg:px-8 lg:pt-32">
        <div className="mx-auto max-w-2xl lg:mx-0">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
            Projects
          </h2>
          <p className="mt-4 text-zinc-400">
            {isCustomUser ? `${username}'s projects` : data.description}
          </p>
        </div>

        <Suspense
          fallback={<div className="text-lg text-zinc-500">Loading...</div>}
        >
          <ProjectsComponent username={username} />
        </Suspense>
      </div>
    </div>
  );
}
