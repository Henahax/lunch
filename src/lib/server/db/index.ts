import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { DATABASE_URL } from '$app/env/private';

if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = new Database(DATABASE_URL);
client.pragma('foreign_keys = ON');

client.exec(`
	CREATE TABLE IF NOT EXISTS restaurants (
		id TEXT PRIMARY KEY NOT NULL,
		slug TEXT NOT NULL UNIQUE,
		name TEXT NOT NULL,
		source_url TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS menus (
		id TEXT PRIMARY KEY NOT NULL,
		restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
		menu_type TEXT NOT NULL,
		valid_from TEXT NOT NULL,
		valid_until TEXT NOT NULL,
		source_url TEXT NOT NULL,
		fetched_at INTEGER NOT NULL
	);
	CREATE UNIQUE INDEX IF NOT EXISTS menus_restaurant_type_period
		ON menus (restaurant_id, menu_type, valid_from);
	CREATE TABLE IF NOT EXISTS menu_items (
		id TEXT PRIMARY KEY NOT NULL,
		menu_id TEXT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
		code TEXT NOT NULL,
		category TEXT,
		name TEXT NOT NULL,
		description TEXT NOT NULL,
		position INTEGER NOT NULL
	);
	CREATE UNIQUE INDEX IF NOT EXISTS menu_items_menu_position
		ON menu_items (menu_id, position);
	CREATE TABLE IF NOT EXISTS source_import_status (
		source_slug TEXT PRIMARY KEY NOT NULL,
		restaurant_name TEXT NOT NULL,
		source_url TEXT NOT NULL,
		last_attempt_at INTEGER NOT NULL,
		last_success_at INTEGER,
		last_error TEXT,
		menu_count INTEGER,
		item_count INTEGER
	)
`);

export const db = drizzle(client, { schema });
