import { ProjectsPage } from '../../_components/projects-page';
import { getExistingUser } from '../../_lib/get-existing-user';

interface PageProps {
  params: Promise<{ username: string }>;
}

export default async function UserProjectsPage({ params }: PageProps) {
  const { username } = await params;
  await getExistingUser(username);

  return <ProjectsPage username={username} isCustomUser />;
}
