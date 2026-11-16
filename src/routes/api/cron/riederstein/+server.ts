import { createCronImportHandler } from '../../../../lib/server/restaurants/cron-handler';
import { importRiedersteinMenu } from '../../../../lib/server/restaurants/riederstein';
import { riedersteinSource } from '../../../../lib/server/restaurants/sources';

export const POST = createCronImportHandler(
	riedersteinSource,
	importRiedersteinMenu,
	'Die Speisekarte konnte nicht importiert werden.'
);
