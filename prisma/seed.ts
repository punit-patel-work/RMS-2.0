import { PrismaClient, Role, PromotionType, PromotionScope } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Seeding database...');

    // ─── Users ──────────────────────────────────────────────────
    const hashedPins = {
        owner: await bcrypt.hash('1234', 10),
        supervisor: await bcrypt.hash('2345', 10),
        floor: await bcrypt.hash('3456', 10),
        kitchen: await bcrypt.hash('4567', 10),
    };

    const owner = await prisma.user.upsert({
        where: { pinCode: hashedPins.owner },
        update: {},
        create: {
            name: 'Alex (Owner)',
            role: Role.OWNER,
            pinCode: hashedPins.owner,
        },
    });

    const supervisor = await prisma.user.upsert({
        where: { pinCode: hashedPins.supervisor },
        update: {},
        create: {
            name: 'Jordan (Supervisor)',
            role: Role.SUPERVISOR,
            pinCode: hashedPins.supervisor,
        },
    });

    const floorStaff = await prisma.user.upsert({
        where: { pinCode: hashedPins.floor },
        update: {},
        create: {
            name: 'Sam (Floor)',
            role: Role.FLOOR_STAFF,
            pinCode: hashedPins.floor,
        },
    });

    const kitchenStaff = await prisma.user.upsert({
        where: { pinCode: hashedPins.kitchen },
        update: {},
        create: {
            name: 'Casey (Kitchen)',
            role: Role.KITCHEN_STAFF,
            pinCode: hashedPins.kitchen,
        },
    });

    console.log('✅ Users seeded:', { owner: owner.name, supervisor: supervisor.name, floorStaff: floorStaff.name, kitchenStaff: kitchenStaff.name });

    // ─── Tables ─────────────────────────────────────────────────
    const tables = [];
    for (let i = 1; i <= 10; i++) {
        const table = await prisma.table.upsert({
            where: { name: `T${i}` },
            update: {},
            create: {
                name: `T${i}`,
                seats: i <= 4 ? 2 : i <= 8 ? 4 : 6,
            },
        });
        tables.push(table);
    }
    console.log(`✅ ${tables.length} tables seeded`);

    // ─── Categories ─────────────────────────────────────────────
    const appetizers = await prisma.category.upsert({
        where: { name: 'Appetizers' },
        update: {},
        create: { name: 'Appetizers', sortOrder: 1 },
    });

    const mains = await prisma.category.upsert({
        where: { name: 'Mains' },
        update: {},
        create: { name: 'Mains', sortOrder: 2 },
    });

    const sides = await prisma.category.upsert({
        where: { name: 'Sides' },
        update: {},
        create: { name: 'Sides', sortOrder: 3 },
    });

    const beverages = await prisma.category.upsert({
        where: { name: 'Beverages' },
        update: {},
        create: { name: 'Beverages', sortOrder: 4 },
    });

    // New Categories
    const iceCream = await prisma.category.upsert({
        where: { name: 'Ice Cream' },
        update: {},
        create: { name: 'Ice Cream', sortOrder: 5 },
    });

    const yogurt = await prisma.category.upsert({
        where: { name: 'Frozen Yogurt' },
        update: {},
        create: { name: 'Frozen Yogurt', sortOrder: 6 },
    });

    console.log('✅ Categories seeded');

    // ─── Menu Items ─────────────────────────────────────────────
    const menuItemsData = [
        // Appetizers
        { name: 'Bruschetta', basePrice: 9.99, categoryId: appetizers.id, description: 'Toasted bread with tomato & basil' },
        { name: 'Calamari', basePrice: 12.99, categoryId: appetizers.id, description: 'Crispy fried squid rings' },
        { name: 'Garlic Bread', basePrice: 6.99, categoryId: appetizers.id, description: 'Toasted with garlic butter' },
        { name: 'Caesar Salad', basePrice: 10.99, categoryId: appetizers.id, description: 'Romaine, croutons, parmesan' },
        { name: 'Soup of the Day', basePrice: 7.99, categoryId: appetizers.id, description: 'Ask your server' },
        // Mains
        { name: 'Ribeye Steak', basePrice: 34.99, categoryId: mains.id, description: '12oz USDA Choice, grilled' },
        { name: 'Grilled Salmon', basePrice: 28.99, categoryId: mains.id, description: 'Atlantic salmon, lemon herb' },
        { name: 'Chicken Parmesan', basePrice: 22.99, categoryId: mains.id, description: 'Breaded chicken, marinara, mozzarella' },
        { name: 'Pasta Carbonara', basePrice: 18.99, categoryId: mains.id, description: 'Spaghetti, pancetta, egg, pecorino' },
        { name: 'Veggie Burger', basePrice: 16.99, categoryId: mains.id, description: 'House-made black bean patty' },
        { name: 'Fish & Chips', basePrice: 19.99, categoryId: mains.id, description: 'Beer-battered cod, tartar sauce' },
        // Sides
        { name: 'French Fries', basePrice: 5.99, categoryId: sides.id, description: 'Crispy golden fries' },
        { name: 'Mashed Potatoes', basePrice: 5.99, categoryId: sides.id, description: 'Creamy garlic mashed' },
        { name: 'Steamed Vegetables', basePrice: 6.99, categoryId: sides.id, description: 'Seasonal mix' },
        { name: 'Onion Rings', basePrice: 7.99, categoryId: sides.id, description: 'Beer-battered, thick-cut' },
        { name: 'Coleslaw', basePrice: 4.99, categoryId: sides.id, description: 'Creamy house slaw' },
        // Beverages
        { name: 'Coca-Cola', basePrice: 3.49, categoryId: beverages.id, description: 'Classic' },
        { name: 'Iced Tea', basePrice: 3.49, categoryId: beverages.id, description: 'Fresh brewed' },
        { name: 'Craft Lager', basePrice: 7.99, categoryId: beverages.id, description: 'Local draft' },
        { name: 'House Red Wine', basePrice: 9.99, categoryId: beverages.id, description: 'Glass of Cabernet' },
        { name: 'Sparkling Water', basePrice: 2.99, categoryId: beverages.id, description: '500ml' },
        // Ice Cream
        { name: 'Vanilla Bean', basePrice: 4.99, categoryId: iceCream.id, description: 'Classic vanilla bean' },
        { name: 'Chocolate Fudge', basePrice: 5.49, categoryId: iceCream.id, description: 'Rich chocolate with fudge swirls' },
        { name: 'Strawberry Swirl', basePrice: 5.49, categoryId: iceCream.id, description: 'Fresh strawberry pieces' },
        { name: 'Mint Chip', basePrice: 5.49, categoryId: iceCream.id, description: 'Mint ice cream with dark chocolate chips' },
        { name: 'Cookie Dough', basePrice: 5.99, categoryId: iceCream.id, description: 'Generous chunks of cookie dough' },
        // Frozen Yogurt
        { name: 'Original Tart', basePrice: 5.99, categoryId: yogurt.id, description: 'Classic tart frozen yogurt' },
        { name: 'Mango Tango', basePrice: 6.49, categoryId: yogurt.id, description: 'Sweet mango flavor' },
        { name: 'Berry Blast', basePrice: 6.49, categoryId: yogurt.id, description: 'Mixed berry blend' },
        { name: 'Tropical Twist', basePrice: 6.49, categoryId: yogurt.id, description: 'Pineapple and coconut' },
    ];

    for (const item of menuItemsData) {
        await prisma.menuItem.upsert({
            where: { id: item.name.toLowerCase().replace(/\s+/g, '-') },
            update: {
                categoryId: item.categoryId
            },
            create: {
                id: item.name.toLowerCase().replace(/\s+/g, '-'),
                ...item
            },
        });
    }
    console.log(`✅ ${menuItemsData.length} menu items seeded`);

    // ─── Promotions ─────────────────────────────────────────────
    // Sample: $2 off Garlic Bread (ITEM/FIXED)
    const garlicBread = await prisma.menuItem.findFirst({
        where: { name: 'Garlic Bread' },
    });

    if (garlicBread) {
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
    }

    // Sample: 15% off all Beverages (CATEGORY/PERCENT)
    await prisma.promotion.upsert({
        where: { id: 'promo-happy-hour' },
        update: {},
        create: {
            id: 'promo-happy-hour',
            name: 'Happy Hour Drinks 15%',
            type: PromotionType.PERCENT,
            value: 15,
            scope: PromotionScope.CATEGORY,
            categoryId: beverages.id,
            active: true,
        },
    });

    // ─── COMBO: 2 Ice Creams for $8 ───
    await prisma.promotion.upsert({
        where: { id: 'promo-ice-cream-duo' },
        update: {},
        create: {
            id: 'promo-ice-cream-duo',
            name: 'Ice Cream Duo (2 for $8)',
            type: PromotionType.COMBO,
            value: 8.00,
            scope: PromotionScope.CATEGORY, // Scope serves as a hint, but rules define trigger
            active: true,
            rules: {
                create: [
                    {
                        categoryId: iceCream.id,
                        requiredQuantity: 2,
                    }
                ]
            }
        },
    });

    // ─── COMBO: Burger + Fries + Drink for $15 ───
    const fries = await prisma.menuItem.findFirst({ where: { name: 'French Fries' } });
    const coke = await prisma.menuItem.findFirst({ where: { name: 'Coca-Cola' } });
    const burger = await prisma.menuItem.findFirst({ where: { name: 'Veggie Burger' } }); // Using Veggie Burger as example

    if (fries && coke && burger) {
        await prisma.promotion.upsert({
            where: { id: 'promo-lunch-special' },
            update: {},
            create: {
                id: 'promo-lunch-special',
                name: 'Lunch Special $15',
                type: PromotionType.COMBO,
                value: 15.00,
                scope: PromotionScope.ITEM,
                active: true,
                rules: {
                    create: [
                        { menuItemId: burger.id, requiredQuantity: 1 },
                        { menuItemId: fries.id, requiredQuantity: 1 },
                        { menuItemId: coke.id, requiredQuantity: 1 },
                    ]
                }
            },
        });
    }


    console.log('✅ Promotions seeded');
    console.log('🎉 Seeding complete!');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
