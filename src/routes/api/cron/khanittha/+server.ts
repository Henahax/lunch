import { createCronImportHandler } from '../../../../lib/server/restaurants/cron-handler';
import { importKhanitthaMenu } from '../../../../lib/server/restaurants/khanittha';
import { khanitthaSource } from '../../../../lib/server/restaurants/sources';

export const POST = createCronImportHandler(
	khanitthaSource,
	importKhanitthaMenu,
	'Der Speiseplan konnte nicht importiert werden.',
	(result) => ({
		restaurant: result.restaurant,
		menuCount: result.menuCount,
		itemCount: result.itemCount,
		validFrom: result.validFrom,
		validUntil: result.validUntil,
		fetchedAt: result.fetchedAt
	})
);
