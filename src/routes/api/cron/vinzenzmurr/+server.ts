import { CRON_SECRET } from '$app/env/private';
import type { RequestHandler } from './$types';
import { importVinzenzmurrMenu } from '../../../../lib/server/restaurants/vinzenzmurr';
import {
	recordImportAttempt,
	recordImportFailure,
	recordImportSuccess
} from '../../../../lib/server/restaurants/import-status';
import { vinzenzmurrSource as source } from '../../../../lib/server/restaurants/sources';

export const POST: RequestHandler = async ({ request }) => {
	if (!CRON_SECRET) {
		return Response.json({ error: 'Der Import ist noch nicht konfiguriert.' }, { status: 503 });
	}
	if (request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
		return Response.json({ error: 'Nicht autorisiert.' }, { status: 401 });
	}

	try {
		recordImportAttempt(source);
		const result = await importVinzenzmurrMenu();
		recordImportSuccess(source, result);
		return Response.json(result);
	} catch (error) {
		try {
			recordImportFailure(source);
		} catch (statusError) {
			console.error('Could not record Vinzenzmurr import failure:', statusError);
		}
		console.error('Vinzenzmurr import failed:', error);
		return Response.json(
			{ error: 'Die Vinzenzmurr-Speisekarte konnte nicht importiert werden.' },
			{ status: 502 }
		);
	}
};
