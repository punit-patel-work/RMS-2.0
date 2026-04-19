import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function POSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (session?.user?.role === 'KITCHEN_STAFF') {
    redirect('/kds');
  }

  return (
    <>
      {children}
    </>
  );
}
