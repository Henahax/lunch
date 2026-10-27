import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { menuItems, menus, restaurants } from '../db/schema';

export type ImportedMenuItem = {
	code?: string;
	category?: string | null;
	name: string;
	description: string;
};

export type ImportedMenuPlan = {
	menuType: 'daily' | 'weekly';
	validFrom: string;
	validUntil: string;
	items: ImportedMenuItem[];
};

type RestaurantIdentity = {
	slug: string;
	name: string;
};

export function storeRestaurantMenus(
	restaurant: RestaurantIdentity,
	sourceUrl: string,
	plans: ImportedMenuPlan[],
	fetchedAt: number,
	restaurantUrl = sourceUrl
) {
	if (plans.length === 0) throw new Error('Der Import enthält keine Speisepläne.');

	return db.transaction((tx) => {
		tx.insert(restaurants)
			.values({ ...restaurant, sourceUrl: restaurantUrl })
			.onConflictDoNothing({ target: restaurants.slug })
			.run();

		const savedRestaurant = tx
			.select({ id: restaurants.id })
			.from(restaurants)
			.where(eq(restaurants.slug, restaurant.slug))
			.get();
		if (!savedRestaurant) throw new Error('Restaurant konnte nicht gespeichert werden.');

		let itemCount = 0;
		for (const plan of plans) {
			tx.insert(menus)
				.values({
					restaurantId: savedRestaurant.id,
					menuType: plan.menuType,
					validFrom: plan.validFrom,
					validUntil: plan.validUntil,
					sourceUrl,
					fetchedAt
				})
				.onConflictDoUpdate({
					target: [menus.restaurantId, menus.menuType, menus.validFrom],
					set: { validUntil: plan.validUntil, sourceUrl, fetchedAt }
				})
				.run();

			const savedMenu = tx
				.select({ id: menus.id })
				.from(menus)
				.where(
					and(
						eq(menus.restaurantId, savedRestaurant.id),
						eq(menus.menuType, plan.menuType),
						eq(menus.validFrom, plan.validFrom)
					)
				)
				.get();
			if (!savedMenu) throw new Error('Speiseplan konnte nicht gespeichert werden.');

			tx.delete(menuItems).where(eq(menuItems.menuId, savedMenu.id)).run();
			if (plan.items.length > 0) {
				tx.insert(menuItems)
					.values(
						plan.items.map((item, position) => ({
							menuId: savedMenu.id,
							code: item.code ?? '',
							category: item.category ?? null,
							name: item.name,
							description: item.description,
							position
						}))
					)
					.run();
			}
			itemCount += plan.items.length;
		}

		return {
			restaurant: restaurant.name,
			menuCount: plans.length,
			itemCount,
			validFrom: plans.reduce(
				(earliest, plan) => (plan.validFrom < earliest ? plan.validFrom : earliest),
				plans[0].validFrom
			),
			validUntil: plans.reduce(
				(latest, plan) => (plan.validUntil > latest ? plan.validUntil : latest),
				plans[0].validUntil
			),
			fetchedAt
		};
	});
}
