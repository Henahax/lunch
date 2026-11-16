import { createCronImportHandler } from '../../../../lib/server/restaurants/cron-handler';
import { importBindaasMenu } from '../../../../lib/server/restaurants/bindaas';
import { bindaasSource } from '../../../../lib/server/restaurants/sources';

export const POST = createCronImportHandler(
	bindaasSource,
	importBindaasMenu,
	'Das Bindaas-Mittagsmenü konnte nicht importiert werden.'
);
