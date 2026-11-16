import { createCronImportHandler } from '../../../../lib/server/restaurants/cron-handler';
import { importVinzenzmurrMenu } from '../../../../lib/server/restaurants/vinzenzmurr';
import { vinzenzmurrSource } from '../../../../lib/server/restaurants/sources';

export const POST = createCronImportHandler(
	vinzenzmurrSource,
	importVinzenzmurrMenu,
	'Die Vinzenzmurr-Speisekarte konnte nicht importiert werden.'
);
