/**
 * RMS2 — Comprehensive Seed
 *
 * Idempotent: re-running the script will upsert rather than duplicate. The
 * historical orders / attendance / schedules use stable IDs derived from a
 * counter so a second run is a no-op rather than doubling the dataset.
 *
 * What gets seeded:
 *   • 8 staff users (1 owner, 2 supervisors, 3 floor, 2 kitchen)
 *   • 20 tables in a 5x4 floor grid
 *   • 6 categories across 2 stations, 60 menu items
 *   • 4 modifier groups (Cooking, Add-ons, Size, Sauce) with 18 modifiers
 *   • 5 promotions (FIXED, PERCENT, 2 COMBOs)
 *   • 30 customers with varied loyalty point balances
 *   • ~200 past orders across the last 60 days (PAID / VOID / REFUNDED mix)
 *   • Attendance: 4 weeks of clock-in/out per active employee
 *   • Schedule: 2 upcoming weeks of shifts
 *   • Default site settings
 */

import {
    PrismaClient,
    Role,
    PromotionType,
    PromotionScope,
    OrderStatus,
    OrderType,
    OrderItemStatus,
    PaymentMethod,
    TableStatus,
} from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Deterministic pseudo-random so re-runs are identical.
function mulberry32(seed: number) {
    return function () {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const rng = mulberry32(42);
const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const between = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const round2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
    console.log('🌱 Seeding database...');

    // ─── Users ──────────────────────────────────────────────────
    const userSpec: { employeeId: string; name: string; role: Role; pin: string }[] = [
        { employeeId: '101', name: 'Alex Morgan',     role: Role.OWNER,         pin: '1234' },
        { employeeId: '102', name: 'Jordan Reyes',    role: Role.SUPERVISOR,    pin: '2345' },
        { employeeId: '103', name: 'Priya Patel',     role: Role.SUPERVISOR,    pin: '2346' },
        { employeeId: '104', name: 'Sam Chen',        role: Role.FLOOR_STAFF,   pin: '3456' },
        { employeeId: '105', name: 'Maya Johnson',    role: Role.FLOOR_STAFF,   pin: '3457' },
        { employeeId: '106', name: 'Diego Alvarez',   role: Role.FLOOR_STAFF,   pin: '3458' },
        { employeeId: '107', name: 'Casey O\'Brien',  role: Role.KITCHEN_STAFF, pin: '4567' },
        { employeeId: '108', name: 'Yuki Tanaka',     role: Role.KITCHEN_STAFF, pin: '4568' },
    ];
    const users = await Promise.all(userSpec.map(async (u) => {
        const hashed = await bcrypt.hash(u.pin, 10);
        return prisma.user.upsert({
            where: { employeeId: u.employeeId },
            update: { name: u.name, role: u.role },
            create: { employeeId: u.employeeId, name: u.name, role: u.role, pinCode: hashed },
        });
    }));
    const owner = users[0];
    const floorAndSupers = users.filter(u => u.role !== Role.KITCHEN_STAFF);
    console.log(`✅ ${users.length} users seeded`);

    // ─── Tables (5x4 grid) ──────────────────────────────────────
    const tables = [];
    for (let i = 1; i <= 20; i++) {
        const col = (i - 1) % 5;
        const row = Math.floor((i - 1) / 5);
        tables.push(await prisma.table.upsert({
            where: { name: `T${i}` },
            update: {},
            create: {
                name: `T${i}`,
                seats: i % 4 === 0 ? 6 : i % 2 === 0 ? 4 : 2,
                positionX: 80 + col * 140,
                positionY: 80 + row * 140,
                width: 100,
                height: 100,
                shape: i % 3 === 0 ? 'ROUND' : 'SQUARE',
                status: TableStatus.VACANT,
            },
        }));
    }
    console.log(`✅ ${tables.length} tables seeded`);

    // ─── Stations + Categories ──────────────────────────────────
    const kitchen = await prisma.station.upsert({ where: { name: 'Kitchen' }, update: {}, create: { name: 'Kitchen' } });
    const bar     = await prisma.station.upsert({ where: { name: 'Bar' },     update: {}, create: { name: 'Bar' } });

    const cat = async (name: string, sortOrder: number, stationId: string) =>
        prisma.category.upsert({
            where: { name },
            update: { sortOrder, stationId },
            create: { name, sortOrder, stationId },
        });
    const appetizers = await cat('Appetizers',     1, kitchen.id);
    const mains      = await cat('Mains',          2, kitchen.id);
    const sides      = await cat('Sides',          3, kitchen.id);
    const desserts   = await cat('Desserts',       4, kitchen.id);
    const beverages  = await cat('Beverages',      5, bar.id);
    const cocktails  = await cat('Cocktails',      6, bar.id);
    console.log('✅ 6 categories seeded');

    // ─── Modifier Groups + Modifiers ────────────────────────────
    const cookingGroup = await prisma.modifierGroup.upsert({
        where: { id: 'mg-cooking' },
        update: {},
        create: { id: 'mg-cooking', name: 'Cooking Temperature', isRequired: true, maxChoices: 1 },
    });
    const addonsGroup = await prisma.modifierGroup.upsert({
        where: { id: 'mg-addons' },
        update: {},
        create: { id: 'mg-addons', name: 'Add-ons', isRequired: false, maxChoices: 5 },
    });
    const sizeGroup = await prisma.modifierGroup.upsert({
        where: { id: 'mg-size' },
        update: {},
        create: { id: 'mg-size', name: 'Size', isRequired: true, maxChoices: 1 },
    });
    const sauceGroup = await prisma.modifierGroup.upsert({
        where: { id: 'mg-sauce' },
        update: {},
        create: { id: 'mg-sauce', name: 'Sauce', isRequired: false, maxChoices: 2 },
    });

    const modifierSpec: { id: string; name: string; price: number; groupId: string }[] = [
        { id: 'mod-rare',        name: 'Rare',                price: 0,    groupId: cookingGroup.id },
        { id: 'mod-medium-rare', name: 'Medium Rare',         price: 0,    groupId: cookingGroup.id },
        { id: 'mod-medium',      name: 'Medium',              price: 0,    groupId: cookingGroup.id },
        { id: 'mod-medium-well', name: 'Medium Well',         price: 0,    groupId: cookingGroup.id },
        { id: 'mod-well-done',   name: 'Well Done',           price: 0,    groupId: cookingGroup.id },
        { id: 'mod-cheese',      name: 'Extra Cheese',        price: 1.50, groupId: addonsGroup.id  },
        { id: 'mod-bacon',       name: 'Bacon',               price: 2.50, groupId: addonsGroup.id  },
        { id: 'mod-avocado',     name: 'Avocado',             price: 2.00, groupId: addonsGroup.id  },
        { id: 'mod-mushrooms',   name: 'Sautéed Mushrooms',   price: 1.50, groupId: addonsGroup.id  },
        { id: 'mod-egg',         name: 'Fried Egg',           price: 1.50, groupId: addonsGroup.id  },
        { id: 'mod-size-sm',     name: 'Small',               price: 0,    groupId: sizeGroup.id    },
        { id: 'mod-size-md',     name: 'Medium',              price: 1.50, groupId: sizeGroup.id    },
        { id: 'mod-size-lg',     name: 'Large',               price: 3.00, groupId: sizeGroup.id    },
        { id: 'mod-ketchup',     name: 'Ketchup',             price: 0,    groupId: sauceGroup.id   },
        { id: 'mod-mayo',        name: 'Mayo',                price: 0,    groupId: sauceGroup.id   },
        { id: 'mod-bbq',         name: 'BBQ Sauce',           price: 0.50, groupId: sauceGroup.id   },
        { id: 'mod-aioli',       name: 'Garlic Aioli',        price: 0.75, groupId: sauceGroup.id   },
        { id: 'mod-hot',         name: 'Hot Sauce',           price: 0,    groupId: sauceGroup.id   },
    ];
    for (const m of modifierSpec) {
        await prisma.modifier.upsert({
            where: { id: m.id },
            update: { name: m.name, priceAdjustment: m.price },
            create: { id: m.id, name: m.name, priceAdjustment: m.price, modifierGroupId: m.groupId },
        });
    }
    console.log(`✅ 4 modifier groups + ${modifierSpec.length} modifiers seeded`);

    // ─── Menu Items (60) ────────────────────────────────────────
    type MI = {
        name: string; basePrice: number; categoryId: string; description: string;
        trackStock?: boolean; stockQuantity?: number; modifierGroups?: string[];
    };
    const menuItemsData: MI[] = [
        // Appetizers (10)
        { name: 'Bruschetta',          basePrice: 9.99,  categoryId: appetizers.id, description: 'Toasted bread with tomato & basil',     trackStock: true, stockQuantity: 50 },
        { name: 'Calamari',            basePrice: 12.99, categoryId: appetizers.id, description: 'Crispy fried squid rings',              trackStock: true, stockQuantity: 50 },
        { name: 'Garlic Bread',        basePrice: 6.99,  categoryId: appetizers.id, description: 'Toasted with garlic butter',            trackStock: true, stockQuantity: 60 },
        { name: 'Caesar Salad',        basePrice: 10.99, categoryId: appetizers.id, description: 'Romaine, croutons, parmesan',           trackStock: true, stockQuantity: 40 },
        { name: 'Soup of the Day',     basePrice: 7.99,  categoryId: appetizers.id, description: 'Ask your server',                       trackStock: true, stockQuantity: 30 },
        { name: 'Buffalo Wings',       basePrice: 13.99, categoryId: appetizers.id, description: '10 wings, blue cheese',                 trackStock: true, stockQuantity: 50, modifierGroups: [sauceGroup.id] },
        { name: 'Mozzarella Sticks',   basePrice: 8.99,  categoryId: appetizers.id, description: '6 sticks, marinara',                    trackStock: true, stockQuantity: 50 },
        { name: 'Spinach Dip',         basePrice: 11.49, categoryId: appetizers.id, description: 'Creamy dip with tortilla chips',        trackStock: true, stockQuantity: 30 },
        { name: 'Shrimp Cocktail',     basePrice: 15.99, categoryId: appetizers.id, description: '6 jumbo shrimp, cocktail sauce',        trackStock: true, stockQuantity: 30 },
        { name: 'Loaded Nachos',       basePrice: 12.49, categoryId: appetizers.id, description: 'Cheese, jalapeño, sour cream',          trackStock: true, stockQuantity: 40 },

        // Mains (15)
        { name: 'Ribeye Steak',        basePrice: 34.99, categoryId: mains.id, description: '12oz USDA Choice, grilled',                  trackStock: true, stockQuantity: 20, modifierGroups: [cookingGroup.id, addonsGroup.id] },
        { name: 'NY Strip',            basePrice: 32.99, categoryId: mains.id, description: '10oz New York strip',                        trackStock: true, stockQuantity: 20, modifierGroups: [cookingGroup.id, addonsGroup.id] },
        { name: 'Filet Mignon',        basePrice: 39.99, categoryId: mains.id, description: '8oz tenderloin, demi-glace',                 trackStock: true, stockQuantity: 15, modifierGroups: [cookingGroup.id] },
        { name: 'Grilled Salmon',      basePrice: 28.99, categoryId: mains.id, description: 'Atlantic salmon, lemon herb',                trackStock: true, stockQuantity: 25 },
        { name: 'Pan-Seared Halibut',  basePrice: 31.99, categoryId: mains.id, description: 'With caper butter sauce',                    trackStock: true, stockQuantity: 15 },
        { name: 'Chicken Parmesan',    basePrice: 22.99, categoryId: mains.id, description: 'Breaded chicken, marinara, mozzarella',     trackStock: true, stockQuantity: 25 },
        { name: 'Roast Chicken',       basePrice: 21.99, categoryId: mains.id, description: 'Half chicken, herb butter',                  trackStock: true, stockQuantity: 25 },
        { name: 'Pasta Carbonara',     basePrice: 18.99, categoryId: mains.id, description: 'Spaghetti, pancetta, egg, pecorino',         trackStock: true, stockQuantity: 30 },
        { name: 'Fettuccine Alfredo',  basePrice: 17.99, categoryId: mains.id, description: 'Cream sauce, parmesan',                      trackStock: true, stockQuantity: 30 },
        { name: 'Mushroom Risotto',    basePrice: 19.99, categoryId: mains.id, description: 'Wild mushrooms, truffle oil',                trackStock: true, stockQuantity: 20 },
        { name: 'Veggie Burger',       basePrice: 16.99, categoryId: mains.id, description: 'House-made black bean patty',                trackStock: true, stockQuantity: 25, modifierGroups: [addonsGroup.id, sauceGroup.id] },
        { name: 'Classic Cheeseburger',basePrice: 15.99, categoryId: mains.id, description: '8oz angus, cheddar, brioche',                trackStock: true, stockQuantity: 30, modifierGroups: [cookingGroup.id, addonsGroup.id, sauceGroup.id] },
        { name: 'BBQ Bacon Burger',    basePrice: 17.99, categoryId: mains.id, description: 'Bacon, BBQ, onion ring on top',              trackStock: true, stockQuantity: 30, modifierGroups: [cookingGroup.id, sauceGroup.id] },
        { name: 'Fish & Chips',        basePrice: 19.99, categoryId: mains.id, description: 'Beer-battered cod, tartar sauce',            trackStock: true, stockQuantity: 25 },
        { name: 'Pork Tenderloin',     basePrice: 24.99, categoryId: mains.id, description: 'Apple chutney, mash',                        trackStock: true, stockQuantity: 20 },

        // Sides (8)
        { name: 'French Fries',        basePrice: 5.99, categoryId: sides.id, description: 'Crispy golden fries' },
        { name: 'Sweet Potato Fries',  basePrice: 6.99, categoryId: sides.id, description: 'With chipotle aioli' },
        { name: 'Mashed Potatoes',     basePrice: 5.99, categoryId: sides.id, description: 'Creamy garlic mashed' },
        { name: 'Steamed Vegetables',  basePrice: 6.99, categoryId: sides.id, description: 'Seasonal mix' },
        { name: 'Onion Rings',         basePrice: 7.99, categoryId: sides.id, description: 'Beer-battered, thick-cut' },
        { name: 'Coleslaw',            basePrice: 4.99, categoryId: sides.id, description: 'Creamy house slaw' },
        { name: 'Side Salad',          basePrice: 5.99, categoryId: sides.id, description: 'Mixed greens, vinaigrette' },
        { name: 'Mac & Cheese',        basePrice: 7.99, categoryId: sides.id, description: 'Three-cheese baked' },

        // Desserts (8)
        { name: 'Chocolate Lava Cake', basePrice: 8.99, categoryId: desserts.id, description: 'Warm with vanilla ice cream',              trackStock: true, stockQuantity: 30 },
        { name: 'Cheesecake',          basePrice: 8.49, categoryId: desserts.id, description: 'New York style, berry compote',            trackStock: true, stockQuantity: 30 },
        { name: 'Tiramisu',            basePrice: 8.99, categoryId: desserts.id, description: 'Espresso-soaked ladyfingers',              trackStock: true, stockQuantity: 25 },
        { name: 'Crème Brûlée',        basePrice: 9.49, categoryId: desserts.id, description: 'Caramelized sugar crust',                  trackStock: true, stockQuantity: 25 },
        { name: 'Apple Pie',           basePrice: 7.49, categoryId: desserts.id, description: 'À la mode',                                trackStock: true, stockQuantity: 30 },
        { name: 'Vanilla Ice Cream',   basePrice: 4.99, categoryId: desserts.id, description: 'Two scoops',                               trackStock: true, stockQuantity: 60, modifierGroups: [sizeGroup.id] },
        { name: 'Chocolate Ice Cream', basePrice: 4.99, categoryId: desserts.id, description: 'Two scoops',                               trackStock: true, stockQuantity: 60, modifierGroups: [sizeGroup.id] },
        { name: 'Sorbet Trio',         basePrice: 6.99, categoryId: desserts.id, description: 'Mango, raspberry, lemon' },

        // Beverages (10)
        { name: 'Coca-Cola',           basePrice: 3.49, categoryId: beverages.id, description: 'Classic',                                  trackStock: true, stockQuantity: 100 },
        { name: 'Diet Coke',           basePrice: 3.49, categoryId: beverages.id, description: 'Zero sugar',                               trackStock: true, stockQuantity: 100 },
        { name: 'Sprite',              basePrice: 3.49, categoryId: beverages.id, description: 'Lemon-lime',                               trackStock: true, stockQuantity: 100 },
        { name: 'Iced Tea',            basePrice: 3.49, categoryId: beverages.id, description: 'Fresh brewed',                             trackStock: true, stockQuantity: 100 },
        { name: 'Hot Coffee',          basePrice: 3.99, categoryId: beverages.id, description: 'Locally roasted',                          trackStock: false },
        { name: 'Cappuccino',          basePrice: 4.99, categoryId: beverages.id, description: 'Single shot' },
        { name: 'Espresso',            basePrice: 3.49, categoryId: beverages.id, description: 'Double shot' },
        { name: 'Sparkling Water',     basePrice: 2.99, categoryId: beverages.id, description: '500ml',                                    trackStock: true, stockQuantity: 100 },
        { name: 'Orange Juice',        basePrice: 4.49, categoryId: beverages.id, description: 'Freshly squeezed',                         trackStock: true, stockQuantity: 50 },
        { name: 'Lemonade',            basePrice: 3.99, categoryId: beverages.id, description: 'House-made',                               trackStock: true, stockQuantity: 50 },

        // Cocktails (9)
        { name: 'Craft Lager',         basePrice: 7.99,  categoryId: cocktails.id, description: 'Local draft',                            trackStock: true, stockQuantity: 80 },
        { name: 'IPA',                 basePrice: 8.99,  categoryId: cocktails.id, description: 'Hoppy, citrus notes',                    trackStock: true, stockQuantity: 60 },
        { name: 'House Red Wine',      basePrice: 9.99,  categoryId: cocktails.id, description: 'Glass of Cabernet',                      trackStock: true, stockQuantity: 50 },
        { name: 'House White Wine',    basePrice: 9.99,  categoryId: cocktails.id, description: 'Glass of Sauvignon Blanc',               trackStock: true, stockQuantity: 50 },
        { name: 'Old Fashioned',       basePrice: 13.99, categoryId: cocktails.id, description: 'Bourbon, bitters, orange' },
        { name: 'Margarita',           basePrice: 11.99, categoryId: cocktails.id, description: 'Classic on the rocks' },
        { name: 'Mojito',              basePrice: 11.99, categoryId: cocktails.id, description: 'White rum, mint, lime' },
        { name: 'Aperol Spritz',       basePrice: 12.99, categoryId: cocktails.id, description: 'Aperol, prosecco, soda' },
        { name: 'Negroni',             basePrice: 12.99, categoryId: cocktails.id, description: 'Gin, Campari, sweet vermouth' },
    ];

    const slug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const menuItems = [];
    for (const item of menuItemsData) {
        const id = `mi-${slug(item.name)}`;
        const { modifierGroups, ...rest } = item;
        const mi = await prisma.menuItem.upsert({
            where: { id },
            update: { ...rest },
            create: { id, ...rest },
        });
        if (modifierGroups?.length) {
            await prisma.menuItem.update({
                where: { id },
                data: { modifierGroups: { set: modifierGroups.map((gid) => ({ id: gid })) } },
            });
        }
        menuItems.push(mi);
    }
    console.log(`✅ ${menuItems.length} menu items seeded`);

    // ─── Promotions (5) ─────────────────────────────────────────
    const garlicBread = menuItems.find((m) => m.name === 'Garlic Bread')!;
    const fries       = menuItems.find((m) => m.name === 'French Fries')!;
    const coke        = menuItems.find((m) => m.name === 'Coca-Cola')!;
    const cheeseburger= menuItems.find((m) => m.name === 'Classic Cheeseburger')!;

    await prisma.promotion.upsert({
        where: { id: 'promo-garlic-bread' },
        update: {},
        create: {
            id: 'promo-garlic-bread',
            name: '$2 Off Garlic Bread',
            type: PromotionType.FIXED,
            value: 2.0,
            scope: PromotionScope.ITEM,
            menuItemId: garlicBread.id,
            active: true,
        },
    });
    await prisma.promotion.upsert({
        where: { id: 'promo-happy-hour' },
        update: {},
        create: {
            id: 'promo-happy-hour',
            name: 'Happy Hour Drinks 15%',
            type: PromotionType.PERCENT,
            value: 15,
            scope: PromotionScope.CATEGORY,
            categoryId: cocktails.id,
            active: true,
        },
    });
    await prisma.promotion.upsert({
        where: { id: 'promo-dessert-deal' },
        update: {},
        create: {
            id: 'promo-dessert-deal',
            name: '20% Off All Desserts',
            type: PromotionType.PERCENT,
            value: 20,
            scope: PromotionScope.CATEGORY,
            categoryId: desserts.id,
            active: true,
        },
    });
    await prisma.promotion.upsert({
        where: { id: 'promo-burger-combo' },
        update: {},
        create: {
            id: 'promo-burger-combo',
            name: 'Burger + Fries + Coke for $20',
            type: PromotionType.COMBO,
            value: 20.0,
            scope: PromotionScope.ITEM,
            active: true,
            rules: {
                create: [
                    { menuItemId: cheeseburger.id, requiredQuantity: 1 },
                    { menuItemId: fries.id,        requiredQuantity: 1 },
                    { menuItemId: coke.id,         requiredQuantity: 1 },
                ],
            },
        },
    });
    await prisma.promotion.upsert({
        where: { id: 'promo-appetizer-combo' },
        update: {},
        create: {
            id: 'promo-appetizer-combo',
            name: 'Two Appetizers for $18',
            type: PromotionType.COMBO,
            value: 18.0,
            scope: PromotionScope.CATEGORY,
            active: true,
            rules: {
                create: [
                    { categoryId: appetizers.id, requiredQuantity: 2 },
                ],
            },
        },
    });
    console.log('✅ 5 promotions seeded');

    // ─── Customers (30) ─────────────────────────────────────────
    const firstNames = ['Olivia','Liam','Noah','Emma','Ava','William','Sophia','James','Isabella','Lucas','Mia','Henry','Charlotte','Ethan','Amelia','Mason','Harper','Logan','Evelyn','Owen','Abigail','Sebastian','Emily','Carter','Elizabeth','Aiden','Avery','Jack','Sofia','Daniel'];
    const lastNames = ['Smith','Johnson','Lee','Brown','Garcia','Davis','Miller','Wilson','Moore','Anderson','Taylor','Thomas','Hernandez','Martin','White','Walker','Young','Allen','King','Wright','Scott','Green','Baker','Adams','Hall','Nelson','Hill','Mitchell','Carter','Roberts'];
    for (let i = 0; i < 30; i++) {
        const phone = `555-${String(1000 + i).padStart(4, '0')}`;
        await prisma.customer.upsert({
            where: { phone },
            update: {},
            create: {
                phone,
                name: `${firstNames[i]} ${lastNames[i]}`,
                pointsBalance: between(0, 500),
            },
        });
    }
    console.log('✅ 30 customers seeded');

    // ─── Site Settings ─────────────────────────────────────────
    const settings: { key: string; value: string }[] = [
        { key: 'TAX_RATE',             value: '0.07' },
        { key: 'LOYALTY_POINTS_RATE',  value: '0.10' },
        { key: 'KDS_PREP_BUFFER_MINUTES', value: '15' },
        { key: 'RESTAURANT_NAME',      value: 'The Compass Kitchen' },
        { key: 'RESTAURANT_PHONE',     value: '555-COMPASS' },
        { key: 'RESTAURANT_ADDRESS',   value: '42 Pier Street' },
    ];
    for (const s of settings) {
        await prisma.siteSettings.upsert({
            where: { key: s.key },
            update: { value: s.value },
            create: { key: s.key, value: s.value },
        });
    }
    console.log('✅ site settings seeded');

    // ─── Historical Orders (200) ────────────────────────────────
    // Skip if already seeded — we use a sentinel ID prefix so re-runs are idempotent.
    const existingHistorical = await prisma.order.count({
        where: { id: { startsWith: 'seed-order-' } },
    });
    if (existingHistorical >= 200) {
        console.log(`✅ ${existingHistorical} historical orders already present, skipping`);
    } else {
        const customers = await prisma.customer.findMany();
        const TARGET_ORDERS = 200;
        const startCount = existingHistorical;
        const orderTypes: OrderType[] = [OrderType.DINE_IN, OrderType.DINE_IN, OrderType.DINE_IN, OrderType.TAKEOUT, OrderType.QUICK_SALE];
        const paymentMethods: PaymentMethod[] = [PaymentMethod.CASH, PaymentMethod.CARD_EXTERNAL, PaymentMethod.CARD_EXTERNAL];

        let firedCount = 0;
        for (let i = startCount; i < TARGET_ORDERS; i++) {
            const orderId   = `seed-order-${String(i).padStart(4, '0')}`;
            const orderType = pick(orderTypes);
            const createdBy = pick(floorAndSupers);
            // Spread orders over the last 60 days, weighted toward recent.
            const daysAgo   = Math.floor(rng() * rng() * 60);
            const hour      = between(11, 22);
            const minute    = between(0, 59);
            const createdAt = new Date();
            createdAt.setDate(createdAt.getDate() - daysAgo);
            createdAt.setHours(hour, minute, 0, 0);

            // Decide final status: ~85% PAID, ~8% VOID, ~5% REFUNDED, ~2% OPEN
            const r = rng();
            const finalStatus =
                r < 0.85 ? OrderStatus.PAID :
                r < 0.93 ? OrderStatus.VOID :
                r < 0.98 ? OrderStatus.REFUNDED :
                OrderStatus.OPEN;

            const lineCount = between(1, 6);
            const lines: { mi: typeof menuItems[number]; qty: number }[] = [];
            for (let l = 0; l < lineCount; l++) {
                lines.push({ mi: pick(menuItems), qty: between(1, 3) });
            }

            const subtotal = round2(lines.reduce((s, x) => s + x.mi.basePrice * x.qty, 0));
            const tax      = round2(subtotal * 0.07);
            const total    = round2(subtotal + tax);

            const isPaidOrRefunded = finalStatus === OrderStatus.PAID || finalStatus === OrderStatus.REFUNDED;
            // Bug fix: previously a PAID takeout order could end up with
            // paymentMethod=LATER_PAY, which then leaked into the serve board's
            // "Collect Payment" button forever. PAID orders must record the
            // actual collection method (CASH/CARD); only OPEN takeouts are
            // legitimately LATER_PAY.
            const paymentMethod = isPaidOrRefunded
                ? pick(paymentMethods)
                : (orderType === OrderType.TAKEOUT && rng() < 0.3
                    ? PaymentMethod.LATER_PAY
                    : pick(paymentMethods));

            const tableId = orderType === OrderType.DINE_IN ? pick(tables).id : null;
            const customer = rng() < 0.4 ? pick(customers) : null;

            await prisma.order.create({
                data: {
                    id: orderId,
                    status: finalStatus,
                    orderType,
                    paymentMethod: isPaidOrRefunded || orderType === OrderType.QUICK_SALE ? paymentMethod : null,
                    tableId,
                    createdById: createdBy.id,
                    customerName: orderType === OrderType.TAKEOUT ? `${pick(firstNames)} ${pick(lastNames)}` : null,
                    customerPhone: orderType === OrderType.TAKEOUT ? `555-${between(2000, 9999)}` : null,
                    customerId: customer?.id,
                    subtotal,
                    discount: 0,
                    tax,
                    total,
                    amountPaid: isPaidOrRefunded ? total : 0,
                    refundAmount: finalStatus === OrderStatus.REFUNDED ? total : null,
                    refundReason:  finalStatus === OrderStatus.REFUNDED ? 'Customer request' : null,
                    refundedById:  finalStatus === OrderStatus.REFUNDED ? owner.id : null,
                    refundedAt:    finalStatus === OrderStatus.REFUNDED ? createdAt : null,
                    createdAt,
                    items: {
                        create: lines.map((x) => ({
                            menuItemId: x.mi.id,
                            quantity: x.qty,
                            frozenPrice: x.mi.basePrice,
                            status: finalStatus === OrderStatus.VOID
                                ? OrderItemStatus.VOIDED
                                : OrderItemStatus.SERVED,
                            refunded: finalStatus === OrderStatus.REFUNDED,
                        })),
                    },
                    payments: isPaidOrRefunded ? {
                        create: [{ amount: total, method: paymentMethod, createdAt }],
                    } : undefined,
                },
            });
            firedCount++;
            if (firedCount % 50 === 0) console.log(`   ↳ ${firedCount} orders inserted...`);
        }
        console.log(`✅ ${firedCount} historical orders seeded`);
    }

    // ─── Attendance (4 weeks per active employee) ───────────────
    const attendExisting = await prisma.attendanceRecord.count({
        where: { id: { startsWith: 'seed-att-' } },
    });
    if (attendExisting > 0) {
        console.log(`✅ ${attendExisting} attendance records already present, skipping`);
    } else {
        const activeStaff = users.filter((u) => u.role !== Role.OWNER);
        let attCount = 0;
        for (const user of activeStaff) {
            for (let day = 28; day >= 1; day--) {
                // Skip ~2/7 days as days off.
                if (rng() < 0.28) continue;
                const date = new Date();
                date.setDate(date.getDate() - day);
                const startHour = between(9, 14);
                const shiftLenH = between(6, 9);
                const clockIn = new Date(date);
                clockIn.setHours(startHour, between(0, 30), 0, 0);
                const clockOut = new Date(clockIn);
                clockOut.setHours(clockIn.getHours() + shiftLenH, between(0, 45));
                await prisma.attendanceRecord.create({
                    data: {
                        id: `seed-att-${user.employeeId}-${day}`,
                        userId: user.id,
                        clockIn,
                        clockOut,
                    },
                });
                attCount++;
            }
        }
        console.log(`✅ ${attCount} attendance records seeded`);
    }

    // ─── Schedules (next 2 weeks) ───────────────────────────────
    const schedExisting = await prisma.schedule.count({
        where: { id: { startsWith: 'seed-sched-' } },
    });
    if (schedExisting > 0) {
        console.log(`✅ ${schedExisting} schedule records already present, skipping`);
    } else {
        const activeStaff = users.filter((u) => u.role !== Role.OWNER);
        let schedCount = 0;
        for (const user of activeStaff) {
            for (let day = 0; day < 14; day++) {
                if (rng() < 0.3) continue; // off-days
                const date = new Date();
                date.setDate(date.getDate() + day);
                const startHour = between(9, 14);
                const lenH = between(6, 9);
                const start = new Date(date);
                start.setHours(startHour, 0, 0, 0);
                const end = new Date(start);
                end.setHours(start.getHours() + lenH);
                await prisma.schedule.create({
                    data: {
                        id: `seed-sched-${user.employeeId}-${day}`,
                        userId: user.id,
                        startTime: start,
                        endTime: end,
                        role: user.role,
                    },
                });
                schedCount++;
            }
        }
        console.log(`✅ ${schedCount} scheduled shifts seeded`);
    }

    console.log('🎉 Seeding complete!');
    console.log('');
    console.log('Login PINs:');
    for (const u of userSpec) {
        console.log(`   ${u.employeeId}  ${u.name.padEnd(20)} ${u.role.padEnd(15)} pin: ${u.pin}`);
    }
}

main()
    .then(async () => { await prisma.$disconnect(); })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
