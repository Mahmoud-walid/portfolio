import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import data from '../../../data.json';
import LoadingIndicator from '../../components/loading-indicator';
import { ProfileOrganizations } from '../../components/orgs';
import {
  CopilotActivity,
  RecentActivity,
} from '../../components/recent-activity';
import { getUser } from '../../data';
import { createUserPath } from '../_lib/username';

const navigation = [
  { name: 'Projects', suffix: '/projects' },
  { name: 'Contact', suffix: '/contact' },
];

interface UserIconProps {
  promise: Promise<any>;
  fallbackName: string;
  fallbackAvatar: string;
}

async function UserIcon({
  promise,
  fallbackName,
  fallbackAvatar,
}: UserIconProps) {
  const user = await promise;

  return (
    <Image
      alt={`${user.name || fallbackName}'s GitHub avatar`}
      width={100}
      height={100}
      src={user.avatar_url || fallbackAvatar}
      className="float-right mx-4 rounded-full"
    />
  );
}

interface UserTextProps {
  promise: Promise<any>;
  fallbackName: string;
}

async function UserText({ promise, fallbackName }: UserTextProps) {
  const user = await promise;

  return (
    <p>
      Hi, my name is {user.name || fallbackName}
      {'. '}
      {user.bio}
    </p>
  );
}

interface ProfileSwitcherProps {
  username: string;
  isCustomUser: boolean;
}

function ProfileSwitcher({ username, isCustomUser }: ProfileSwitcherProps) {
  return (
    <Link
      href={isCustomUser ? '/' : '/search'}
      className="rounded-sm border-2 border-dashed border-zinc-500 p-2 text-lg text-zinc-500 duration-500 hover:border-zinc-300 hover:text-zinc-300"
    >
      {isCustomUser
        ? `Showing: ${username}, click to cancel ❌`
        : 'Try yourself'}
    </Link>
  );
}

interface LandingPageProps {
  username: string;
  isCustomUser?: boolean;
  user?: any;
}

export function LandingPage({
  username,
  isCustomUser = false,
  user,
}: LandingPageProps) {
  const userPromise = user ? Promise.resolve(user) : getUser(username);
  const userPath = isCustomUser ? createUserPath(username) : null;
  const fallbackName = isCustomUser ? username : data.displayName;
  const fallbackAvatar = isCustomUser
    ? `https://github.com/${encodeURIComponent(username)}.png`
    : data.avatarUrl;

  return (
    <div className="flex min-h-screen w-screen flex-col items-center justify-center overflow-y-auto bg-linear-to-tl from-black via-zinc-600/20 to-black">
      <nav className="animate-fade-in my-16">
        <ul className="flex items-center justify-center gap-4">
          {navigation.map((item) => (
            <Link
              key={item.suffix}
              href={userPath ? `${userPath}${item.suffix}` : item.suffix}
              className="text-lg text-zinc-500 duration-500 hover:text-zinc-300"
            >
              <span className="inline-flex items-center">
                {item.name} <LoadingIndicator />
              </span>
            </Link>
          ))}
          <ProfileSwitcher username={username} isCustomUser={isCustomUser} />
        </ul>
      </nav>
      <div className="animate-glow animate-fade-left hidden h-px w-screen bg-linear-to-r from-zinc-300/0 via-zinc-300/50 to-zinc-300/0 md:block" />

      <h1 className="text-edge-outline animate-title font-display z-10 flex cursor-default items-center bg-white bg-clip-text p-5 text-4xl whitespace-nowrap text-transparent duration-1000 hover:scale-110 sm:text-6xl md:text-9xl">
        {username}
        <Suspense fallback={null}>
          <UserIcon
            promise={userPromise}
            fallbackName={fallbackName}
            fallbackAvatar={fallbackAvatar}
          />
        </Suspense>
      </h1>

      <div className="animate-glow animate-fade-right hidden h-px w-screen bg-linear-to-r from-zinc-300/0 via-zinc-300/50 to-zinc-300/0 md:block" />
      <div className="animate-fade-in my-16 text-center text-lg text-zinc-500">
        <div className="min-h-28 w-full">
          <Suspense fallback={<p>Loading profile...</p>}>
            <UserText promise={userPromise} fallbackName={fallbackName} />
          </Suspense>
          <Suspense fallback={null}>
            <ProfileOrganizations username={username} />
          </Suspense>
          <Suspense fallback={null}>
            <RecentActivity username={username} />
          </Suspense>
          <Suspense fallback={null}>
            <CopilotActivity username={username} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
