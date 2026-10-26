import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const restaurants = sqliteTable('restaurants', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	slug: text('slug').notNull().unique(),
	name: text('name').notNull(),
	sourceUrl: text('source_url').notNull()
});

export const sourceImportStatus = sqliteTable('source_import_status', {
	sourceSlug: text('source_slug').primaryKey(),
	restaurantName: text('restaurant_name').notNull(),
	sourceUrl: text('source_url').notNull(),
	lastAttemptAt: integer('last_attempt_at').notNull(),
	lastSuccessAt: integer('last_success_at'),
	lastError: text('last_error'),
	menuCount: integer('menu_count'),
	itemCount: integer('item_count')
});

export const menus = sqliteTable(
	'menus',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		restaurantId: text('restaurant_id')
			.notNull()
			.references(() => restaurants.id, { onDelete: 'cascade' }),
		menuType: text('menu_type', { enum: ['daily', 'weekly'] }).notNull(),
		validFrom: text('valid_from').notNull(),
		validUntil: text('valid_until').notNull(),
		sourceUrl: text('source_url').notNull(),
		fetchedAt: integer('fetched_at').notNull()
	},
	(table) => [
		uniqueIndex('menus_restaurant_type_period').on(
			table.restaurantId,
			table.menuType,
			table.validFrom
		)
	]
);

export const menuItems = sqliteTable(
	'menu_items',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		menuId: text('menu_id')
			.notNull()
			.references(() => menus.id, { onDelete: 'cascade' }),
		code: text('code').notNull(),
		category: text('category'),
		name: text('name').notNull(),
		description: text('description').notNull(),
		position: integer('position').notNull()
	},
	(table) => [uniqueIndex('menu_items_menu_position').on(table.menuId, table.position)]
);
