import { load } from 'cheerio';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractPdfLines } from './pdf-text';
import { storeRestaurantMenus, type ImportedMenuItem, type ImportedMenuPlan } from './store-menu';

const websiteUrl = 'https://www.zumriederstein.de/';
const restaurant = { slug: 'zum-riederstein', name: 'Zum Riederstein' };
const maxPdfSize = 20_000_000;
const pdfHosts = new Set(['www.zumriederstein.de', 'zumriederstein.de', 'filesusr.com']);

function cleanText(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}

function cleanDishName(value: string): string {
	return cleanText(value)
		.replace(/(?:\s*\.\s*){4,}\s*$/u, '')
		.replace(/[·…]{2,}\s*$/u, '')
		.trim();
}

function cleanDishDetail(value: string): string {
	return cleanText(value.replace(/(?:\s*\.\s*){4,}.*$/u, '').replace(/(?:\s*[·…]\s*){2,}.*$/u, ''));
}

export function findRiedersteinMenuUrl(html: string): string {
	const $ = load(html);
	const link = $('a')
		.toArray()
		.find((anchor) => /mittagskarte/i.test(cleanText($(anchor).text())));
	if (!link)
		throw new Error('Der Link „Mittagskarte“ wurde auf der Restaurantseite nicht gefunden.');

	const href = $(link).attr('href');
	if (!href) throw new Error('Der Link zur Mittagskarte enthält keine URL.');

	const url = new URL(href, websiteUrl);
	const hostname = url.hostname.toLowerCase();
	const trustedHost =
		pdfHosts.has(hostname) ||
		hostname.endsWith('.filesusr.com') ||
		hostname.endsWith('.wixstatic.com');
	if (url.protocol !== 'https:' || !trustedHost || !url.pathname.toLowerCase().endsWith('.pdf')) {
		throw new Error('Der Mittagskarten-Link führt nicht zu einer erwarteten HTTPS-PDF-Datei.');
	}
	return url.toString();
}

function berlinDate(date: Date): string {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Europe/Berlin',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(date);
	const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
	return `${values.year}-${values.month}-${values.day}`;
}

function mondayOf(date: string): string {
	const monday = new Date(`${date}T00:00:00Z`);
	monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
	return monday.toISOString().slice(0, 10);
}

function parseValidityPeriod(text: string, now: Date): { validFrom: string; validUntil: string } {
	const match = text.match(
		/(\d{1,2})\.\s*(\d{1,2})\.?\s*(?:-|–|bis)\s*(\d{1,2})\.\s*(\d{1,2})\.?(?:\s*(\d{4}))?/i
	);
	if (!match) throw new Error('Gültigkeitszeitraum wurde in der Riederstein-PDF nicht gefunden.');
	return buildCurrentWeekPeriod(match, now);
}

function buildCurrentWeekPeriod(
	match: RegExpMatchArray,
	now: Date
): { validFrom: string; validUntil: string } {
	const [, fromDay, fromMonth, untilDay, untilMonth, explicitYear] = match;
	const currentDate = berlinDate(now);
	const currentMonday = mondayOf(currentDate);
	const currentYear = Number(currentDate.slice(0, 4));
	const endYears = explicitYear
		? [Number(explicitYear)]
		: [currentYear - 1, currentYear, currentYear + 1];

	for (const endYear of endYears) {
		const startYear = Number(fromMonth) > Number(untilMonth) ? endYear - 1 : endYear;
		const validFrom = `${startYear}-${fromMonth.padStart(2, '0')}-${fromDay.padStart(2, '0')}`;
		const validUntil = `${endYear}-${untilMonth.padStart(2, '0')}-${untilDay.padStart(2, '0')}`;
		if (
			!Number.isNaN(Date.parse(`${validFrom}T00:00:00Z`)) &&
			!Number.isNaN(Date.parse(`${validUntil}T00:00:00Z`)) &&
			validFrom <= validUntil &&
			mondayOf(validFrom) === currentMonday &&
			mondayOf(validUntil) === currentMonday
		) {
			return { validFrom, validUntil };
		}
	}
	throw new Error('Die Riederstein-PDF enthält keinen Zeitraum für die aktuelle Kalenderwoche.');
}

function isIntroductoryText(line: string): boolean {
	return /^(?:zu jedem|täglich|mittags(?:karte|tisch)|hauptgerichte? servieren|alle preise|guten appetit|wünscht|bitte fragen|inklusive gesetzlich)/i.test(
		line
	);
}

function parsePricedItems(lines: string[]): ImportedMenuItem[] {
	const items: ImportedMenuItem[] = [];
	let mayAttachDescription = false;
	const priceAtLineEnd = /\(?\s*(?:\d+(?:[.,]\d{2})\s*(?:€|EUR)|€\s*\d+(?:[.,]\d{2}))\s*\)?\s*$/i;

	for (const line of lines) {
		const priceMatch = line.match(priceAtLineEnd);
		if (!priceMatch || priceMatch.index === undefined) {
			const previousItem = items.at(-1);
			const detail = cleanDishDetail(line);
			if (mayAttachDescription && previousItem && detail && !isIntroductoryText(detail)) {
				previousItem.description = cleanText(`${previousItem.description} ${detail}`);
			}
			mayAttachDescription = false;
			continue;
		}

		const itemText = cleanText(line.slice(0, priceMatch.index));
		if (itemText && !isIntroductoryText(itemText)) {
			const parts = itemText.split(/\s*[|•]\s*/).filter(Boolean);
			const name = cleanDishName(parts.shift() ?? itemText);
			const detail = cleanDishDetail(parts.join(' | '));
			if (name) {
				items.push({ code: '', name, description: detail });
				mayAttachDescription = true;
			}
		}
	}

	return items;
}

export function parseRiedersteinMenu(lines: string[], now = new Date()): ImportedMenuPlan {
	const text = lines.join(' ');
	const period = parseValidityPeriod(text, now);
	const items = parsePricedItems(lines);
	if (items.length === 0)
		throw new Error('In der Riederstein-PDF wurden keine Gerichte mit Preis erkannt.');
	return { menuType: 'weekly', ...period, items };
}

export async function importRiedersteinMenu(now = new Date()) {
	const pageResponse = await fetch(websiteUrl, {
		headers: { 'user-agent': 'LunchMenuBot/1.0 (weekly public menu import)' },
		signal: AbortSignal.timeout(15_000)
	});
	if (!pageResponse.ok)
		throw new Error(`Restaurantseite antwortete mit HTTP ${pageResponse.status}.`);
	const pdfUrl = findRiedersteinMenuUrl(await pageResponse.text());

	const pdfResponse = await fetch(pdfUrl, {
		headers: { 'user-agent': 'LunchMenuBot/1.0 (weekly public menu import)' },
		signal: AbortSignal.timeout(20_000)
	});
	if (!pdfResponse.ok)
		throw new Error(`Mittagskarten-PDF antwortete mit HTTP ${pdfResponse.status}.`);
	const data = new Uint8Array(await pdfResponse.arrayBuffer());
	if (data.length < 5 || data.length > maxPdfSize) throw new Error('PDF-Dateigröße ist ungültig.');
	if (new TextDecoder().decode(data.subarray(0, 5)) !== '%PDF-') {
		throw new Error('Der Mittagskarten-Link hat keine PDF-Datei geliefert.');
	}

	const loadingTask = getDocument({ data });
	let lines: string[];
	let rawText: string[];
	try {
		const document = await loadingTask.promise;
		lines = [];
		rawText = [];
		for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
			const page = await document.getPage(pageNumber);
			const content = await page.getTextContent();
			rawText.push(
				...content.items.flatMap((item) =>
					typeof item === 'object' && item !== null && 'str' in item && typeof item.str === 'string'
						? [item.str]
						: []
				)
			);
			lines.push(...extractPdfLines(content.items, 5.5));
			page.cleanup();
		}
	} finally {
		await loadingTask.destroy();
	}

	const plan = parseRiedersteinMenu(lines, now);
	const expectedItemCount =
		rawText.join(' ').match(/(?:\d+[.,]\d{2}\s*€|€\s*\d+[.,]\d{2})/g)?.length ?? 0;
	if (expectedItemCount > plan.items.length) {
		throw new Error(
			`Nur ${plan.items.length} von ${expectedItemCount} Gerichten mit Preis wurden erkannt.`
		);
	}
	return storeRestaurantMenus(restaurant, pdfUrl, [plan], now.getTime(), websiteUrl);
}
