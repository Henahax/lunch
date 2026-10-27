import { importKhanitthaMenu } from './khanittha';
import { importNoonMenu } from './noon';
import { importRiedersteinMenu } from './riederstein';
import {
	recordImportAttempt,
	recordImportFailure,
	recordImportSuccess,
	type ImportSource
} from './import-status';
import { khanitthaSource, noonSource, riedersteinSource } from './sources';

const timeZone = 'Europe/Berlin';
const runHour = 8;
let started = false;
let running = false;

function berlinDate(date: Date): string {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(date);
	const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
	return `${values.year}-${values.month}-${values.day}`;
}

function berlinDateTime(date: string, hour: number): Date {
	const [year, month, day] = date.split('-').map(Number);
	const localAsUtc = Date.UTC(year, month - 1, day, hour);
	let timestamp = localAsUtc;
	const formatter = new Intl.DateTimeFormat('en-CA', {
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
	let nextDate = berlinDate(now);
	let nextRun = berlinDateTime(nextDate, runHour);
	if (nextRun.getTime() <= now.getTime()) {
		const nextDay = new Date(`${nextDate}T00:00:00Z`);
		nextDay.setUTCDate(nextDay.getUTCDate() + 1);
		nextDate = nextDay.toISOString().slice(0, 10);
		nextRun = berlinDateTime(nextDate, runHour);
	}
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
	console.info('Starting menu imports on startup and daily at 08:00 Europe/Berlin.');
	void runImports();
	scheduleNextRun();
}
