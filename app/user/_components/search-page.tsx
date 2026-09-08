import Link from 'next/link';
import { GoArrowLeft } from 'react-icons/go';
import UserSearch from '../../components/search-input';
import { createUserPath } from '../_lib/username';

interface SearchPageProps {
  initialUsername?: string;
  isCustomUser?: boolean;
}

export function SearchPage({
  initialUsername = '',
  isCustomUser = false,
}: SearchPageProps) {
  const backHref: string = isCustomUser
    ? createUserPath(initialUsername) || '/'
    : '/';

  return (
    <div className="flex h-screen w-screen flex-col items-center overflow-hidden bg-linear-to-tl from-black via-zinc-600/20 to-black">
      <div className="container mx-auto flex flex-row-reverse items-center justify-between p-6">
        <div className="flex justify-between gap-8 text-base" />

        <Link
          href={backHref}
          className="text-zinc-300 duration-200 hover:text-zinc-100"
          aria-label="Back"
        >
          <GoArrowLeft className="h-6 w-6" />
        </Link>
      </div>
      <nav className="animate-fade-in my-16" />
      <div className="animate-glow animate-fade-left hidden h-px w-screen bg-linear-to-r from-zinc-300/0 via-zinc-300/50 to-zinc-300/0 md:block" />

      <h1 className="sr-only">GitHub profile search</h1>
      <UserSearch user={initialUsername} />

      <div className="animate-glow animate-fade-right hidden h-px w-screen bg-linear-to-r from-zinc-300/0 via-zinc-300/50 to-zinc-300/0 md:block" />
    </div>
  );
}
