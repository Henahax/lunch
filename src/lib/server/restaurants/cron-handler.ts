import { CRON_SECRET } from '$app/env/private';
import type { RequestHandler } from '@sveltejs/kit';
import {
	recordImportAttempt,
	recordImportFailure,
	recordImportSuccess,
	type ImportSource
} from './import-status';
import type { ImportedMenuResult } from './store-menu';

export function createCronImportHandler(
	source: ImportSource,
	importMenu: () => Promise<ImportedMenuResult>,
	failureMessage: string,
	successResponse: (result: ImportedMenuResult) => unknown = (result) => result
): RequestHandler {
	return async ({ request }) => {
		if (!CRON_SECRET) {
			return Response.json({ error: 'Der Import ist noch nicht konfiguriert.' }, { status: 503 });
		}
		if (request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
			return Response.json({ error: 'Nicht autorisiert.' }, { status: 401 });
		}

		try {
			recordImportAttempt(source);
			const result = await importMenu();
			recordImportSuccess(source, result);
			return Response.json(successResponse(result));
		} catch (error) {
			try {
				recordImportFailure(source);
			} catch (statusError) {
				console.error(`Could not record ${source.name} import failure:`, statusError);
			}
			console.error(`${source.name} menu import failed:`, error);
			return Response.json({ error: failureMessage }, { status: 502 });
		}
	};
}
