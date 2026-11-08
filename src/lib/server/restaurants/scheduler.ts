import { importKhanitthaMenu } from './khanittha';
import { importNoonMenu } from './noon';
import { importRiedersteinMenu } from './riederstein';
import { importVinzenzmurrMenu } from './vinzenzmurr';
import { importBindaasMenu } from './bindaas';
import {
	recordImportAttempt,
	recordImportFailure,
	recordImportSuccess,
	type ImportSource
} from './import-status';
import {
	bindaasSource,
	khanitthaSource,
	noonSource,
	riedersteinSource,
	vinzenzmurrSource
} from './sources';

const timeZone = 'Europe/Berlin';
const importSchedule = [
	// Wochentage verwenden die JavaScript-Zählung: 0 = Sonntag, 1 = Montag, ..., 6 = Samstag.
	{ weekdays: [0, 1, 2, 3, 4, 5, 6], hour: 8, minute: 0 },
	{ weekdays: [0, 1, 2, 3, 4, 5], hour: 11, minute: 30 }
];
let started = false;
let running = false;

function berlinDate(date: Date): string {
	const parts = new Intl.DateTimeFormat('de-DE', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(date);
	const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
	return `${values.year}-${values.month}-${values.day}`;
}

function berlinDateTime(date: string, hour: number, minute: number): Date {
	const [year, month, day] = date.split('-').map(Number);
	const localAsUtc = Date.UTC(year, month - 1, day, hour, minute);
	let timestamp = localAsUtc;
	const formatter = new Intl.DateTimeFormat('de-DE', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23'
	});

	for (let attempt = 0; attempt < 2; attempt += 1) {
		const parts = Object.fromEntries(
			formatter.formatToParts(new Date(timestamp)).map(({ type, value }) => [type, value])
		);
		const localAtTimestamp = Date.UTC(
			Number(parts.year),
			Number(parts.month) - 1,
			Number(parts.day),
			Number(parts.hour),
			Number(parts.minute),
			Number(parts.second)
		);
		timestamp = localAsUtc - (localAtTimestamp - timestamp);
	}

	return new Date(timestamp);
}

function millisecondsUntilNextRun(now = new Date()): number {
	const today = new Date(`${berlinDate(now)}T00:00:00Z`);
	let nextRun: Date | undefined;

	for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
		const date = new Date(today);
		date.setUTCDate(date.getUTCDate() + dayOffset);
		const weekday = date.getUTCDay();
		const dateString = date.toISOString().slice(0, 10);

		for (const schedule of importSchedule) {
			if (!schedule.weekdays.includes(weekday)) continue;

			const candidate = berlinDateTime(dateString, schedule.hour, schedule.minute);
			if (candidate.getTime() <= now.getTime()) continue;
			if (!nextRun || candidate.getTime() < nextRun.getTime()) nextRun = candidate;
		}
	}

	if (!nextRun) throw new Error('No upcoming menu import is configured.');
	return nextRun.getTime() - now.getTime();
}

async function runSource(
	source: ImportSource,
	importMenu: () => Promise<{ menuCount: number; itemCount: number }>
) {
	try {
		recordImportAttempt(source);
		const result = await importMenu();
		recordImportSuccess(source, result);
		console.info(
			`${source.name} import completed: ${result.menuCount} menus, ${result.itemCount} items`
		);
	} catch (error) {
		try {
			recordImportFailure(source);
		} catch (statusError) {
			console.error(`Could not record ${source.name} import failure:`, statusError);
		}
		console.error(`${source.name} import failed:`, error);
	}
}

async function runImports() {
	if (running) {
		console.warn('Scheduled menu import skipped because a previous run is still active.');
		return;
	}

	running = true;
	try {
		await runSource(khanitthaSource, importKhanitthaMenu);
		await runSource(noonSource, importNoonMenu);
		await runSource(riedersteinSource, importRiedersteinMenu);
		await runSource(vinzenzmurrSource, importVinzenzmurrMenu);
		await runSource(bindaasSource, importBindaasMenu);
	} finally {
		running = false;
	}
}

function scheduleNextRun() {
	const delay = millisecondsUntilNextRun();
	const timer = setTimeout(async () => {
		await runImports();
		scheduleNextRun();
	}, delay);
	timer.unref();
}

export function startImportScheduler() {
	if (started) return;
	started = true;
	console.info(
		'Starting menu imports on startup and according to the configured Europe/Berlin schedule.'
	);
	void runImports();
	scheduleNextRun();
}
