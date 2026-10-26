import { eq } from 'drizzle-orm';
import { db } from '../db';
import { sourceImportStatus } from '../db/schema';

export type ImportSource = {
	slug: string;
	name: string;
	url: string;
};

export function recordImportAttempt(source: ImportSource, attemptedAt = Date.now()) {
	db.insert(sourceImportStatus)
		.values({
			sourceSlug: source.slug,
			restaurantName: source.name,
			sourceUrl: source.url,
			lastAttemptAt: attemptedAt,
			lastSuccessAt: null,
			lastError: null,
			menuCount: null,
			itemCount: null
		})
		.onConflictDoUpdate({
			target: sourceImportStatus.sourceSlug,
			set: {
				restaurantName: source.name,
				sourceUrl: source.url,
				lastAttemptAt: attemptedAt,
				lastError: null
			}
		})
		.run();
}

export function recordImportSuccess(
	source: ImportSource,
	counts: { menuCount: number; itemCount: number },
	succeededAt = Date.now()
) {
	db.insert(sourceImportStatus)
		.values({
			sourceSlug: source.slug,
			restaurantName: source.name,
			sourceUrl: source.url,
			lastAttemptAt: succeededAt,
			lastSuccessAt: succeededAt,
			lastError: null,
			...counts
		})
		.onConflictDoUpdate({
			target: sourceImportStatus.sourceSlug,
			set: {
				restaurantName: source.name,
				sourceUrl: source.url,
				lastSuccessAt: succeededAt,
				lastError: null,
				...counts
			}
		})
		.run();
}

export function recordImportFailure(source: ImportSource, failedAt = Date.now()) {
	db.update(sourceImportStatus)
		.set({ lastAttemptAt: failedAt, lastError: 'Der Import ist fehlgeschlagen.' })
		.where(eq(sourceImportStatus.sourceSlug, source.slug))
		.run();
}
