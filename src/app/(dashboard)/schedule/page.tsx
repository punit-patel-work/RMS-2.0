import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ScheduleView } from './schedule-view';

export const metadata = {
  title: 'Staff Schedule | RMS',
};

export default async function SchedulePage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const { role, id } = session.user;

  return <ScheduleView userRole={role} currentUserId={id} />;
}
