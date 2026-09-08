import { ContactPage } from '../../_components/contact-page';
import { getExistingUser } from '../../_lib/get-existing-user';

interface PageProps {
  params: Promise<{ username: string }>;
}

export default async function UserContactPage({ params }: PageProps) {
  const { username } = await params;
  const user = await getExistingUser(username);

  return <ContactPage username={username} isCustomUser user={user} />;
}
