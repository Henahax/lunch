import { CRON_SECRET } from '$app/env/private';
import type { RequestHandler } from './$types';
import { importRiedersteinMenu } from '../../../../lib/server/restaurants/riederstein';
import {
	recordImportAttempt,
	recordImportFailure,
	recordImportSuccess
} from '../../../../lib/server/restaurants/import-status';
import { riedersteinSource as source } from '../../../../lib/server/restaurants/sources';

export const POST: RequestHandler = async ({ request }) => {
	if (!CRON_SECRET) {
		return Response.json({ error: 'Der Import ist noch nicht konfiguriert.' }, { status: 503 });
	}
	if (request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
		return Response.json({ error: 'Nicht autorisiert.' }, { status: 401 });
	}

	try {
		recordImportAttempt(source);
		const result = await importRiedersteinMenu();
		recordImportSuccess(source, result);
		return Response.json(result);
	} catch (error) {
		try {
			recordImportFailure(source);
		} catch (statusError) {
			console.error('Could not record Riederstein import failure:', statusError);
		}
		console.error('Riederstein import failed:', error);
		return Response.json(
			{ error: 'Die Speisekarte konnte nicht importiert werden.' },
			{ status: 502 }
		);
	}
};
