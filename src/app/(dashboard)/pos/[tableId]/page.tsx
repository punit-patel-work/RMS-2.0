import { getTableById } from '@/server/queries/table.queries';
import { getMenuByCategory } from '@/server/queries/menu.queries';
import { getActivePromotions } from '@/server/queries/promotion.queries';
import { OrderBuilder } from '@/components/pos/order-builder';
import { notFound } from 'next/navigation';

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
      table={JSON.parse(JSON.stringify(table))}
      categories={JSON.parse(JSON.stringify(categories))}
      promotions={JSON.parse(JSON.stringify(promotions))}
    />
  );
}
