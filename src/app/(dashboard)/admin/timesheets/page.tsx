import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { TimesheetsView } from './timesheets-view';

export const metadata = {
  title: 'Timesheets & Attendance | RMS',
};

export default async function TimesheetsPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== 'OWNER' && session.user.role !== 'SUPERVISOR')) {
    redirect('/pos');
  }

  return <TimesheetsView />;
}
