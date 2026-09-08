import Link from 'next/link';
import { FaGithub, FaLinkedin } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { GoMail, GoPerson } from 'react-icons/go';
import data from '../../../data.json';
import { Card } from '../../components/card';
import { Navigation } from '../../components/nav';
import { getSocialAccounts, getUser } from '../../data';

interface ContactPageProps {
  username: string;
  isCustomUser?: boolean;
  user?: any;
}

export async function ContactPage({
  username,
  isCustomUser = false,
  user: providedUser,
}: ContactPageProps) {
  const [user, githubSocials] = await Promise.all([
    providedUser || getUser(username),
    getSocialAccounts(username),
  ]);
  const email = user.email || (!isCustomUser ? data.email : null);
  const contacts: any[] = [];

  if (email) {
    contacts.push({
      icon: <GoMail size={20} />,
      href: `mailto:${email}`,
      label: 'Email',
      handle: email,
    });
  }

  contacts.push({
    icon: <FaGithub size={20} />,
    href: `https://github.com/${encodeURIComponent(username)}`,
    label: 'Github',
    handle: username,
  });

  githubSocials.forEach((social: any) => {
    switch (social.provider) {
      case 'linkedin':
        contacts.push({
          icon: <FaLinkedin size={20} />,
          href: social.url,
          label: social.provider,
          handle: social.url.split('/').filter(Boolean).pop(),
        });
        break;
      case 'twitter':
        contacts.push({
          icon: <FaXTwitter size={20} />,
          href: social.url,
          label: social.provider,
          handle: social.url.split('/').filter(Boolean).pop(),
        });
        break;
      default:
        contacts.push({
          icon: <GoPerson size={20} />,
          href: social.url,
          label: social.url.split('/')[2] || social.provider,
        });
    }
  });

  return (
    <div className="bg-linear-to-tl from-zinc-900/0 via-zinc-900 to-zinc-900/0">
      <Navigation username={isCustomUser ? username : undefined} />
      <div className="container mx-auto flex min-h-screen items-center justify-center px-4">
        <div className="mx-auto mt-32 grid w-full grid-cols-1 gap-8 sm:mt-0 sm:grid-cols-3 lg:gap-16">
          {contacts.map((contact) => {
            const emailTransform =
              contact.label === 'Email'
                ? 'sm:rotate-45 md:rotate-0 lg:rotate-45 xl:rotate-0'
                : '';

            return (
              <Card key={`${contact.label}-${contact.href}`}>
                <Link
                  href={contact.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative flex flex-col items-center gap-4 p-4 duration-700 sm:p-8 md:gap-8 md:p-16 md:py-24 lg:pb-48"
                >
                  <span
                    className="absolute h-2/3 w-px bg-linear-to-b from-zinc-500 via-zinc-500/50 to-transparent"
                    aria-hidden="true"
                  />
                  <span className="drop-shadow-orange relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-500 bg-zinc-900 text-sm text-zinc-200 duration-1000 group-hover:border-zinc-200 group-hover:bg-zinc-900 group-hover:text-white">
                    {contact.icon}
                  </span>
                  <div className="z-10 flex flex-col items-center">
                    <span
                      className={`font-display text-xl font-medium whitespace-nowrap text-zinc-200 duration-150 group-hover:text-white lg:text-3xl ${emailTransform}`}
                    >
                      {contact.handle}
                    </span>
                    <span className="mt-4 text-center text-sm text-zinc-400 duration-1000 group-hover:text-zinc-200">
                      {contact.label}
                    </span>
                  </div>
                </Link>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
