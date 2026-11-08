import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '../lib/server/db';
import { menuItems, menus, restaurants, sourceImportStatus } from '../lib/server/db/schema';
import { restaurantCatalog } from '../lib/server/restaurants/sources';

// Set the restaurant display order here using their slugs. Unlisted restaurants follow alphabetically.
const restaurantOrderCookieName = 'lunch-restaurant-order';
const restaurantCollapsedCookieName = 'lunch-collapsed-restaurants';
const restaurantMobileOpenCookieName = 'lunch-mobile-open-restaurant';
const restaurantDisplayOrder = [
	'khanittha',
	'zum-riederstein',
	'bindaas',
	'noon-food',
	'vinzenzmurr'
];

function displayWeekRange(): { monday: string; friday: string } {
	const berlinDate = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Europe/Berlin',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date());
	const today = new Date(`${berlinDate}T00:00:00Z`);
	const daysSinceMonday = (today.getUTCDay() + 6) % 7;
	today.setUTCDate(today.getUTCDate() - daysSinceMonday);
	if (new Date(`${berlinDate}T00:00:00Z`).getUTCDay() === 0) {
		today.setUTCDate(today.getUTCDate() + 7);
	}
	const monday = today.toISOString().slice(0, 10);
	today.setUTCDate(today.getUTCDate() + 4);
	return { monday, friday: today.toISOString().slice(0, 10) };
}

function getMenuRows(monday: string, friday: string, restaurantSlug?: string) {
	return db
		.select({
			restaurantId: restaurants.id,
			restaurantSlug: restaurants.slug,
			restaurantName: restaurants.name,
			restaurantUrl: restaurants.sourceUrl,
			menuId: menus.id,
			menuType: menus.menuType,
			validFrom: menus.validFrom,
			validUntil: menus.validUntil,
			itemId: menuItems.id,
			code: menuItems.code,
			category: menuItems.category,
			name: menuItems.name,
			description: menuItems.description,
			position: menuItems.position
		})
		.from(restaurants)
		.innerJoin(menus, eq(menus.restaurantId, restaurants.id))
		.leftJoin(menuItems, eq(menuItems.menuId, menus.id))
		.where(
			and(
				lte(menus.validFrom, friday),
				gte(menus.validUntil, monday),
				restaurantSlug ? eq(restaurants.slug, restaurantSlug) : undefined
			)
		)
		.orderBy(
			asc(restaurants.name),
			asc(menus.menuType),
			asc(menus.validFrom),
			asc(menuItems.position)
		);
}

export const load: PageServerLoad = async ({ cookies }) => {
	const { monday, friday } = displayWeekRange();
	const previousMondayDate = new Date(`${monday}T00:00:00Z`);
	previousMondayDate.setUTCDate(previousMondayDate.getUTCDate() - 7);
	const previousMonday = previousMondayDate.toISOString().slice(0, 10);
	const previousFridayDate = new Date(`${previousMonday}T00:00:00Z`);
	previousFridayDate.setUTCDate(previousFridayDate.getUTCDate() + 4);
	const previousFriday = previousFridayDate.toISOString().slice(0, 10);
	const importStatuses = await db
		.select()
		.from(sourceImportStatus)
		.orderBy(asc(sourceImportStatus.restaurantName));
	const currentRows = await getMenuRows(monday, friday);
	const currentMenuRestaurantIds = new Set(currentRows.map((row) => row.restaurantId));
	let bindaasFallbackRows: Awaited<ReturnType<typeof getMenuRows>> = [];
	if (!currentRows.some((row) => row.restaurantSlug === 'bindaas')) {
		const [latestBindaasMenu] = await db
			.select({ validFrom: menus.validFrom, validUntil: menus.validUntil })
			.from(menus)
			.innerJoin(restaurants, eq(menus.restaurantId, restaurants.id))
			.where(
				and(
					eq(restaurants.slug, 'bindaas'),
					eq(menus.menuType, 'weekly'),
					lte(menus.validFrom, monday)
				)
			)
			.orderBy(desc(menus.validFrom))
			.limit(1);
		if (latestBindaasMenu) {
			bindaasFallbackRows = (await getMenuRows(
				latestBindaasMenu.validFrom,
				latestBindaasMenu.validUntil,
				'bindaas'
			)).map((row) => ({ ...row, validFrom: monday, validUntil: friday }));
		}
	}
	const activeMenuRestaurantIds = new Set(currentMenuRestaurantIds);
	if (bindaasFallbackRows[0]) activeMenuRestaurantIds.add(bindaasFallbackRows[0].restaurantId);
	const previousRows = await getMenuRows(previousMonday, previousFriday);
	const staleMenuRestaurantIds = new Set(
		previousRows
			.filter(
				(row) =>
					!currentMenuRestaurantIds.has(row.restaurantId) && row.restaurantSlug !== 'bindaas'
			)
			.map((row) => row.restaurantId)
	);
	const rows = [
		...currentRows,
		...previousRows.filter((row) => staleMenuRestaurantIds.has(row.restaurantId)),
		...bindaasFallbackRows
	];

	const groupedRestaurants = new Map<
		string,
		{
			id: string;
			slug: string;
			restaurantName: string;
			restaurantUrl: string;
			menus: {
				id: string;
				menuType: 'daily' | 'weekly';
				validFrom: string;
				validUntil: string;
				items: {
					id: string;
					code: string;
					category: string | null;
					name: string;
					description: string;
				}[];
			}[];
		}
	>();
	const configuredRestaurantSlugs = new Set(restaurantCatalog.map(({ slug }) => slug));
	const restaurantRows = await db.select().from(restaurants);
	for (const restaurant of restaurantRows) {
		if (!configuredRestaurantSlugs.has(restaurant.slug)) continue;
		groupedRestaurants.set(restaurant.id, {
			id: restaurant.id,
			slug: restaurant.slug,
			restaurantName: restaurant.name,
			restaurantUrl: restaurant.sourceUrl,
			menus: []
		});
	}

	for (const row of rows) {
		const restaurant = groupedRestaurants.get(row.restaurantId);
		if (!restaurant) continue;

		let menu = restaurant.menus.find((candidate) => candidate.id === row.menuId);
		if (!menu) {
			menu = {
				id: row.menuId,
				menuType: row.menuType,
				validFrom: row.validFrom,
				validUntil: row.validUntil,
				items: []
			};
			restaurant.menus.push(menu);
		}

		if (row.itemId && row.name) {
			menu.items.push({
				id: row.itemId,
				code: row.code ?? '',
				category: row.category,
				name: row.name,
				description: row.description ?? ''
			});
		}
	}

	const defaultRestaurants = [...groupedRestaurants.values()].sort((left, right) => {
		const leftIndex = restaurantDisplayOrder.indexOf(left.slug);
		const rightIndex = restaurantDisplayOrder.indexOf(right.slug);
		if (leftIndex === -1 && rightIndex === -1) {
			return left.restaurantName.localeCompare(right.restaurantName, 'de');
		}
		if (leftIndex === -1) return 1;
		if (rightIndex === -1) return -1;
		return leftIndex - rightIndex;
	});
	let savedOrder: unknown;
	try {
		savedOrder = JSON.parse(cookies.get(restaurantOrderCookieName) ?? '[]');
	} catch {
		savedOrder = [];
	}
	const availableSlugs = new Set(defaultRestaurants.map((restaurant) => restaurant.slug));
	const validSavedOrder = Array.isArray(savedOrder)
		? [...new Set(savedOrder.filter((slug): slug is string => typeof slug === 'string'))].filter(
			(slug) => availableSlugs.has(slug)
		)
		: [];
	const completeOrder = [
		...validSavedOrder,
		...defaultRestaurants
			.map((restaurant) => restaurant.slug)
			.filter((slug) => !validSavedOrder.includes(slug))
	];
	const orderIndex = new Map(completeOrder.map((slug, index) => [slug, index]));

	let savedCollapsedSlugs: unknown;
	try {
		savedCollapsedSlugs = JSON.parse(cookies.get(restaurantCollapsedCookieName) ?? '[]');
	} catch {
		savedCollapsedSlugs = [];
	}
	const collapsedSlugs = Array.isArray(savedCollapsedSlugs)
		? savedCollapsedSlugs.filter((slug): slug is string => typeof slug === 'string')
		: [];
	const savedMobileOpenSlug = cookies.get(restaurantMobileOpenCookieName);
	const mobileOpenSlug = savedMobileOpenSlug && availableSlugs.has(savedMobileOpenSlug)
		? savedMobileOpenSlug
		: null;
	const hasMobileAccordionPreference = savedMobileOpenSlug === '' || mobileOpenSlug !== null;

	return {
		weekStart: monday,
		weekEnd: friday,
		previousWeekStart: previousMonday,
		currentMenuSlugs: defaultRestaurants
			.filter((restaurant) => activeMenuRestaurantIds.has(restaurant.id))
			.map((restaurant) => restaurant.slug),
		staleMenuSlugs: defaultRestaurants
			.filter((restaurant) => staleMenuRestaurantIds.has(restaurant.id))
			.map((restaurant) => restaurant.slug),
		restaurants: defaultRestaurants.sort(
			(left, right) => orderIndex.get(left.slug)! - orderIndex.get(right.slug)!
		),
		collapsedSlugs,
		mobileOpenSlug,
		hasMobileAccordionPreference,
		importStatuses
	};
};
