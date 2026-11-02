import { sql } from 'drizzle-orm';
import { db } from './lib/server/db';
import { restaurants } from './lib/server/db/schema';
import { startImportScheduler } from './lib/server/restaurants/scheduler';
import { restaurantCatalog } from './lib/server/restaurants/sources';

export function init() {
	db.insert(restaurants)
		.values(
			restaurantCatalog.map(({ slug, name, url }) => ({
				slug,
				name,
				sourceUrl: url
			}))
		)
		.onConflictDoUpdate({
			target: restaurants.slug,
			set: {
				name: sql`excluded.name`,
				sourceUrl: sql`excluded.source_url`
			}
		})
		.run();
	startImportScheduler();
}
