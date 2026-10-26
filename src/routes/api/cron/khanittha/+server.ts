import { CRON_SECRET } from '$app/env/private';
import type { RequestHandler } from './$types';
import { importKhanitthaMenu } from '../../../../lib/server/restaurants/khanittha';
import {
	recordImportAttempt,
	recordImportFailure,
	recordImportSuccess
} from '../../../../lib/server/restaurants/import-status';
import { khanitthaSource as source } from '../../../../lib/server/restaurants/sources';

export const POST: RequestHandler = async ({ request }) => {
	if (!CRON_SECRET) {
		return Response.json({ error: 'Der Import ist noch nicht konfiguriert.' }, { status: 503 });
	}
	if (request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
		return Response.json({ error: 'Nicht autorisiert.' }, { status: 401 });
	}

	try {
		recordImportAttempt(source);
		const result = await importKhanitthaMenu();
		recordImportSuccess(source, result);
		return Response.json({
			restaurant: result.restaurant,
			menuCount: result.menuCount,
			itemCount: result.itemCount,
			validFrom: result.validFrom,
			validUntil: result.validUntil,
			fetchedAt: result.fetchedAt
		});
	} catch (error) {
		try {
			recordImportFailure(source);
		} catch (statusError) {
			console.error('Could not record Khanittha import failure:', statusError);
		}
		console.error('Khanittha menu import failed:', error);
		return Response.json(
			{ error: 'Der Speiseplan konnte nicht importiert werden.' },
			{ status: 502 }
		);
	}
};
