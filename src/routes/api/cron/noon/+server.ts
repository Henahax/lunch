import { createCronImportHandler } from '../../../../lib/server/restaurants/cron-handler';
import { importNoonMenu } from '../../../../lib/server/restaurants/noon';
import { noonSource } from '../../../../lib/server/restaurants/sources';

export const POST = createCronImportHandler(
	noonSource,
	importNoonMenu,
	'Die Speisekarte konnte nicht importiert werden.'
);
