import { SearchPage } from '../../_components/search-page';
import { getExistingUser } from '../../_lib/get-existing-user';

interface PageProps {
  params: Promise<{ username: string }>;
}

export default async function UserSearchPage({ params }: PageProps) {
  const { username } = await params;
  await getExistingUser(username);

  return <SearchPage initialUsername={username} isCustomUser />;
}
