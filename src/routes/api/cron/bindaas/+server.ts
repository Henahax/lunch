import { CRON_SECRET } from '$app/env/private';
import type { RequestHandler } from './$types';
import { importBindaasMenu } from '../../../../lib/server/restaurants/bindaas';
import {
	recordImportAttempt,
	recordImportFailure,
	recordImportSuccess
} from '../../../../lib/server/restaurants/import-status';
import { bindaasSource as source } from '../../../../lib/server/restaurants/sources';

export const POST: RequestHandler = async ({ request }) => {
	if (!CRON_SECRET) {
		return Response.json({ error: 'Der Import ist noch nicht konfiguriert.' }, { status: 503 });
	}
	if (request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
		return Response.json({ error: 'Nicht autorisiert.' }, { status: 401 });
	}

	try {
		recordImportAttempt(source);
		const result = await importBindaasMenu();
		recordImportSuccess(source, result);
		return Response.json(result);
	} catch (error) {
		try {
			recordImportFailure(source);
		} catch (statusError) {
			console.error('Could not record Bindaas import failure:', statusError);
		}
		console.error('Bindaas import failed:', error);
		return Response.json(
			{ error: 'Das Bindaas-Mittagsmenü konnte nicht importiert werden.' },
			{ status: 502 }
		);
	}
};
