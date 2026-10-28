import { and, asc, eq, gte, lte } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '../lib/server/db';
import { menuItems, menus, restaurants, sourceImportStatus } from '../lib/server/db/schema';

// Set the restaurant display order here using their slugs. Unlisted restaurants follow alphabetically.
const restaurantDisplayOrder = [
	'khanittha',
	'zum-riederstein',
	'bindaas',
	'noon-food',
	'vinzenzmurr'

];

function currentWeekRange(): { monday: string; friday: string } {
	const berlinDate = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Europe/Berlin',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date());
	const today = new Date(`${berlinDate}T00:00:00Z`);
	const daysSinceMonday = (today.getUTCDay() + 6) % 7;
	today.setUTCDate(today.getUTCDate() - daysSinceMonday);
	const monday = today.toISOString().slice(0, 10);
	today.setUTCDate(today.getUTCDate() + 4);
	return { monday, friday: today.toISOString().slice(0, 10) };
}

export const load: PageServerLoad = async () => {
	const { monday, friday } = currentWeekRange();
	const importStatuses = await db
		.select()
		.from(sourceImportStatus)
		.orderBy(asc(sourceImportStatus.restaurantName));
	const rows = await db
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
		.where(and(lte(menus.validFrom, friday), gte(menus.validUntil, monday)))
		.orderBy(
			asc(restaurants.name),
			asc(menus.menuType),
			asc(menus.validFrom),
			asc(menuItems.position)
		);

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

	for (const row of rows) {
		let restaurant = groupedRestaurants.get(row.restaurantId);
		if (!restaurant) {
			restaurant = {
				id: row.restaurantId,
				slug: row.restaurantSlug,
				restaurantName: row.restaurantName,
				restaurantUrl: row.restaurantUrl,
				menus: []
			};
			groupedRestaurants.set(row.restaurantId, restaurant);
		}

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

	return {
		weekStart: monday,
		restaurants: [...groupedRestaurants.values()].sort((left, right) => {
			const leftIndex = restaurantDisplayOrder.indexOf(left.slug);
			const rightIndex = restaurantDisplayOrder.indexOf(right.slug);
			if (leftIndex === -1 && rightIndex === -1) {
				return left.restaurantName.localeCompare(right.restaurantName, 'de');
			}
			if (leftIndex === -1) return 1;
			if (rightIndex === -1) return -1;
			return leftIndex - rightIndex;
		}),
		importStatuses
	};
};
