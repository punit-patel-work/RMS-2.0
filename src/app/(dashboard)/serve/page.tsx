import { ServeBoard } from '@/components/serve/serve-board';

export const dynamic = 'force-dynamic';

export default function ServePage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ready to Serve</h1>
        <p className="text-sm text-muted-foreground">
          Items marked ready by kitchen — tap to serve
        </p>
      </div>
      <ServeBoard />
    </div>
  );
}
