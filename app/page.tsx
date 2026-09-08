import data from '../data.json' with { type: 'json' };
import { LandingPage } from './user/_components/landing-page';

const username = process.env.GITHUB_USERNAME || data.githubUsername;

export default function Home() {
  return <LandingPage username={username} />;
}
