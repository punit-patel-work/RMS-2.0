import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function POSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // @ts-expect-error NextAuth types don't include custom role field by default
  if (session?.user?.role === 'KITCHEN_STAFF') {
    redirect('/kds');
  }

  return (
    <>
      {children}
    </>
  );
}
