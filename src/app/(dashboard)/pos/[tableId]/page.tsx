import { getTableById } from '@/server/queries/table.queries';
import { getMenuByCategory } from '@/server/queries/menu.queries';
import { getActivePromotions } from '@/server/queries/promotion.queries';
import { OrderBuilder } from '@/components/pos/order-builder';
import { notFound } from 'next/navigation';
import { toPlain } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ tableId: string }>;
}

export default async function OrderPage({ params }: Props) {
  const { tableId } = await params;

  const [table, categories, promotions] = await Promise.all([
    getTableById(tableId),
    getMenuByCategory(),
    getActivePromotions(),
  ]);

  if (!table) {
    notFound();
  }

  return (
    <OrderBuilder
      table={toPlain(table)}
      categories={toPlain(categories)}
      promotions={toPlain(promotions)}
    />
  );
}
