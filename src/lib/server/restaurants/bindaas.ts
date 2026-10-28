import { load } from 'cheerio';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { storeRestaurantMenus, type ImportedMenuItem } from './store-menu';

const websiteUrl = 'https://www.bindaas.de/de/werksviertel';
const restaurantUrl = 'https://www.bindaas.de/de/werksviertel';
const restaurant = { slug: 'bindaas', name: 'Bindaas Werksviertel' };
const maxPdfSize = 20_000_000;

type PdfTextItem = {
	str: string;
	transform: number[];
	width: number;
	hasEOL?: boolean;
};

function cleanText(value: string): string {
	return value
		.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function normalize(value: string): string {
	return cleanText(value).toLocaleLowerCase('de-DE').normalize('NFD').replace(/\p{M}/gu, '');
}

function stripBindaasAllergenMarkers(value: string): string {
	const marker = '[a-l](?:\\s*,\\s*[a-l0-9]+)*';
	return cleanText(value)
		.replace(new RegExp(`\\(\\s*${marker}\\s*\\)`, 'gi'), ' ')
		.replace(new RegExp(`(?:^|\\s)${marker}(?=\\s|$)`, 'gi'), ' ')
		.replace(/\s+([,.;:!?])/g, '$1')
		.replace(/\s+/g, ' ')
		.trim();
}

export function findBindaasMenuUrl(html: string): string {
	const $ = load(html);
	const link = $('a')
		.toArray()
		.find((anchor) => /mittagsmenü\s+anzeigen/i.test(cleanText($(anchor).text())));
	if (!link)
		throw new Error(
			'Der Button „Mittagsmenü Anzeigen“ wurde auf der Bindaas-Seite nicht gefunden.'
		);

	const href = $(link).attr('href');
	if (!href) throw new Error('Der Mittagsmenü-Link enthält keine PDF-URL.');
	const url = new URL(href, websiteUrl);
	if (
		url.protocol !== 'https:' ||
		!['bindaas.de', 'www.bindaas.de'].includes(url.hostname.toLowerCase()) ||
		!url.pathname.toLowerCase().endsWith('.pdf')
	) {
		throw new Error('Der Mittagsmenü-Link führt nicht zu einer erwarteten Bindaas-PDF-Datei.');
	}
	return url.toString();
}

function berlinDate(now: Date): string {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Europe/Berlin',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(now);
	const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
	return `${values.year}-${values.month}-${values.day}`;
}

function currentWeek(now: Date): { validFrom: string; validUntil: string } {
	const monday = new Date(`${berlinDate(now)}T00:00:00Z`);
	monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
	const friday = new Date(monday);
	friday.setUTCDate(friday.getUTCDate() + 4);
	return {
		validFrom: monday.toISOString().slice(0, 10),
		validUntil: friday.toISOString().slice(0, 10)
	};
}

function cleanDishLine(line: string): string {
	return stripBindaasAllergenMarkers(line)
		.replace(/\s+\d{1,2}[.,]\d{2}\s*€?\s*$/u, '')
		.trim();
}

function extractBindaasLines(items: unknown[]): string[] {
	const textItems = items.filter(
		(item): item is PdfTextItem =>
			typeof item === 'object' &&
			item !== null &&
			'str' in item &&
			typeof item.str === 'string' &&
			'transform' in item &&
			Array.isArray(item.transform) &&
			'width' in item &&
			typeof item.width === 'number'
	);
	const lines: string[] = [];
	let current = '';
	let previous: PdfTextItem | undefined;
	const flush = () => {
		const line = cleanText(current);
		if (line) lines.push(line);
		current = '';
		previous = undefined;
	};

	for (const item of textItems) {
		const y = item.transform[5];
		if (previous && Math.abs(y - previous.transform[5]) > 0.75) flush();
		if (previous) {
			const gap = item.transform[4] - (previous.transform[4] + previous.width);
			if (gap > 0.8 && !current.endsWith(' ') && !item.str.startsWith(' ')) current += ' ';
		}
		current += item.str;
		previous = item;
		if (item.hasEOL) flush();
	}
	flush();
	return lines;
}

function isDishTitle(line: string): boolean {
	if (/^\s*[-–—]/.test(line)) return false;
	const title = cleanDishLine(line);
	return (
		title.length > 2 &&
		/[A-ZÄÖÜ]/.test(title) &&
		title === title.toLocaleUpperCase('de-DE') &&
		/[A-ZÄÖÜ]/.test(title)
	);
}

export function parseBindaasMenuLines(lines: string[]): ImportedMenuItem[] {
	const normalized = lines.map(normalize);
	const findHeading = (marker: string) =>
		normalized.findIndex((line, index) =>
			`${line} ${normalized[index + 1] ?? ''}`.replace(/[^a-z]/g, '').includes(marker)
		);
	const thaliIndex = findHeading('thalis');
	const grillIndex = findHeading('tandoorigrill');
	const curriesIndex = findHeading('curries');
	const weeklyIndex = findHeading('weeklyspecials');
	const footerIndices = [findHeading('zusatzstoffe'), findHeading('allergene')].filter(
		(index) => index >= 0
	);
	const footerIndex = footerIndices.length > 0 ? Math.min(...footerIndices) : -1;
	if (thaliIndex < 0 || grillIndex < 0 || curriesIndex < 0 || weeklyIndex < 0 || footerIndex < 0) {
		throw new Error(
			`Die Kategorien oder das Ende der Bindaas-Mittagskarte wurden nicht vollständig erkannt (Thalis: ${thaliIndex}, Tandoori: ${grillIndex}, Curries: ${curriesIndex}, Weekly Specials: ${weeklyIndex}, Allergene: ${footerIndex}).`
		);
	}

	const items: ImportedMenuItem[] = [];
	let current: ImportedMenuItem | undefined;
	let currentCategory = '';
	const saveCurrent = () => {
		if (current) items.push(current);
		current = undefined;
	};
	for (const line of lines.slice(0, footerIndex)) {
		const cleanedLine = stripBindaasAllergenMarkers(line);
		if (!cleanedLine) continue;
		const title = cleanDishLine(cleanedLine);
		const normalizedTitle = normalize(title)
			.replace(/[^a-z ]/g, '')
			.replace(/\s+/g, ' ')
			.trim();
		const compactTitle = normalizedTitle.replace(/ /g, '');
		const isCategoryHeading =
			compactTitle.startsWith('thalis') ||
			compactTitle.startsWith('tandoorigrill') ||
			compactTitle.startsWith('curries') ||
			compactTitle.startsWith('weeklyspecials') ||
			compactTitle.startsWith('allinone');
		if (isCategoryHeading) {
			saveCurrent();
			if (compactTitle.startsWith('thalis')) currentCategory = 'Thalis';
			else if (compactTitle.startsWith('tandoorigrill')) currentCategory = 'Tandoori - Grill';
			else if (compactTitle.startsWith('curries')) currentCategory = 'Curries';
			else if (compactTitle.startsWith('weeklyspecials')) currentCategory = 'Weekly Specials';
			continue;
		}
		if (
			normalizedTitle.startsWith('mittags karte') ||
			normalizedTitle.startsWith('gultig') ||
			normalizedTitle.startsWith('ausser feiertage') ||
			!/[a-z]/i.test(title)
		) {
			continue;
		}

		if (isDishTitle(cleanedLine)) {
			saveCurrent();
			if (currentCategory) current = { name: title, category: currentCategory, description: '' };
		} else if (current && !/^\d{1,2}[.,]\d{2}$/.test(cleanedLine)) {
			current.description = [current.description, cleanedLine].filter(Boolean).join(' ');
		}
	}
	saveCurrent();
	if (items.length === 0)
		throw new Error('Auf der Bindaas-Mittagskarte wurden keine Gerichte erkannt.');
	return items;
}

export async function importBindaasMenu(now = new Date()) {
	const pageResponse = await fetch(websiteUrl, {
		headers: { 'user-agent': 'LunchMenuBot/1.0 (weekly public menu import)' },
		signal: AbortSignal.timeout(20_000)
	});
	if (!pageResponse.ok)
		throw new Error(`Bindaas-Seite antwortete mit HTTP ${pageResponse.status}.`);
	const pdfUrl = findBindaasMenuUrl(await pageResponse.text());

	const pdfResponse = await fetch(pdfUrl, {
		headers: { 'user-agent': 'LunchMenuBot/1.0 (weekly public menu import)' },
		signal: AbortSignal.timeout(20_000)
	});
	if (!pdfResponse.ok) throw new Error(`Bindaas-PDF antwortete mit HTTP ${pdfResponse.status}.`);
	const contentType = pdfResponse.headers.get('content-type') ?? '';
	const data = new Uint8Array(await pdfResponse.arrayBuffer());
	if (!contentType.includes('application/pdf') || data.length < 5 || data.length > maxPdfSize) {
		throw new Error('Die Bindaas-Quelle hat keine gültige PDF-Datei geliefert.');
	}
	if (new TextDecoder().decode(data.subarray(0, 5)) !== '%PDF-') {
		throw new Error('Der Mittagsmenü-Link hat keine PDF-Datei geliefert.');
	}

	const loadingTask = getDocument({ data });
	let items: ImportedMenuItem[];
	try {
		const document = await loadingTask.promise;
		const firstPage = await document.getPage(1);
		const content = await firstPage.getTextContent();
		items = parseBindaasMenuLines(extractBindaasLines(content.items));
		firstPage.cleanup();
	} finally {
		await loadingTask.destroy();
	}

	return storeRestaurantMenus(
		restaurant,
		pdfUrl,
		[{ menuType: 'weekly', ...currentWeek(now), items }],
		now.getTime(),
		restaurantUrl
	);
}
