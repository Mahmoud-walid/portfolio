import { GoArrowLeft } from 'react-icons/go';
import Link from 'next/link';
import LoadingIndicator from './loading-indicator';
import { createUserPath } from '../user/_lib/username';

interface NavigationProps {
  username?: string;
}

export const Navigation = ({ username }: NavigationProps) => {
  const userPath = username ? createUserPath(username) : null;
  const homeHref = userPath || '/';
  const projectsHref = userPath ? `${userPath}/projects` : '/projects';
  const contactHref = userPath ? `${userPath}/contact` : '/contact';

  return (
    <header>
      <div className="fixed inset-x-0 top-0 z-50 border-b border-zinc-800/60 bg-zinc-900/80 backdrop-blur duration-200">
        <div className="container mx-auto flex flex-row-reverse items-center justify-between p-6">
          <div className="flex justify-between gap-8 text-base">
            <Link
              href={projectsHref}
              prefetch={false}
              className="relative block text-zinc-400 duration-200 hover:text-zinc-100"
            >
              <span className="inline-flex items-center">
                Projects <LoadingIndicator />
              </span>
            </Link>
            <Link
              href={contactHref}
              className="relative block text-zinc-400 duration-200 hover:text-zinc-100"
            >
              <span className="inline-flex items-center">
                Contact <LoadingIndicator />
              </span>
            </Link>
          </div>

          <Link
            href={homeHref}
            className="text-zinc-300 duration-200 hover:text-zinc-100"
            aria-label={
              username ? `Back to ${username}'s profile` : 'Back to home'
            }
          >
            <GoArrowLeft className="h-6 w-6" />
          </Link>
        </div>
      </div>
    </header>
  );
};
