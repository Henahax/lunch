import { load } from 'cheerio';
import type { AnyNode } from 'domhandler';
import { storeRestaurantMenus, type ImportedMenuItem } from './store-menu';

const sourceUrl = 'https://khanittha.de/';
const restaurant = {
	slug: 'khanittha',
	name: 'Khanittha im Werksviertel'
};

export type ImportedWeeklyMenu = {
	validFrom: string;
	validUntil: string;
	items: ImportedMenuItem[];
};

function cleanText(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}

function dateInBerlin(date: Date): string {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Europe/Berlin',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(date);
	const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
	return `${values.year}-${values.month}-${values.day}`;
}

function distanceToRange(date: string, from: string, until: string): number {
	const target = Date.parse(`${date}T00:00:00Z`);
	const start = Date.parse(`${from}T00:00:00Z`);
	const end = Date.parse(`${until}T00:00:00Z`);
	if (target >= start && target <= end) return 0;
	return Math.min(Math.abs(target - start), Math.abs(target - end));
}

function parseValidityPeriod(title: string, now: Date): { validFrom: string; validUntil: string } {
	const match = title.match(
		/(\d{1,2})\.(\d{1,2})\.?\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.?(?:\s*(\d{4}))?/
	);
	if (!match) throw new Error(`Gültigkeitszeitraum im Titel nicht erkannt: ${title}`);

	const [, fromDay, fromMonth, untilDay, untilMonth, explicitYear] = match;
	const today = dateInBerlin(now);
	const currentYear = Number(today.slice(0, 4));
	const candidates = (
		explicitYear ? [Number(explicitYear)] : [currentYear - 1, currentYear, currentYear + 1]
	).map((endYear) => {
		const startYear = Number(fromMonth) > Number(untilMonth) ? endYear - 1 : endYear;
		const validFrom = `${startYear}-${fromMonth.padStart(2, '0')}-${fromDay.padStart(2, '0')}`;
		const validUntil = `${endYear}-${untilMonth.padStart(2, '0')}-${untilDay.padStart(2, '0')}`;
		return { validFrom, validUntil };
	});

	return candidates.reduce((closest, candidate) =>
		distanceToRange(today, candidate.validFrom, candidate.validUntil) <
		distanceToRange(today, closest.validFrom, closest.validUntil)
			? candidate
			: closest
	);
}

export function parseKhanitthaMenu(html: string, now = new Date()): ImportedWeeklyMenu {
	const $ = load(html);
	const title = $('h1, h2, h3, h4')
		.toArray()
		.find((element) => /Mittagsmenü/i.test(cleanText($(element).text())));
	if (!title)
		throw new Error('Überschrift „Mittagsmenü“ wurde auf der Restaurantseite nicht gefunden.');

	const titleText = cleanText($(title).text());
	let section = $(title).parent();
	const mealHeadingSelector = 'h1, h2, h3, h4';
	const isMealHeading = (element: AnyNode) => /^M\d+\s*[-–]/i.test(cleanText($(element).text()));

	while (
		section.length > 0 &&
		section.find(mealHeadingSelector).toArray().filter(isMealHeading).length === 0
	) {
		section = section.parent();
	}
	if (!section.length) throw new Error('Der Menübereich mit den Gerichten wurde nicht gefunden.');

	const headings = section.find(mealHeadingSelector).toArray().filter(isMealHeading);
	const items = headings.map((heading) => {
		const headingText = cleanText($(heading).text());
		const match = headingText.match(/^(M\d+)\s*[-–]\s*(.+)$/i);
		if (!match) throw new Error(`Gerichtscode nicht erkannt: ${headingText}`);

		const card = $(heading).closest('li').length ? $(heading).closest('li') : $(heading).parent();
		const description = card
			.find('p')
			.toArray()
			.map((paragraph) => cleanText($(paragraph).text()))
			.filter(Boolean)
			.join(' ');
		if (!description) throw new Error(`Beschreibung für ${match[1]} wurde nicht gefunden.`);

		return { code: match[1].toUpperCase(), name: cleanText(match[2]), description };
	});

	if (items.length === 0) throw new Error('Im Mittagsmenü wurden keine Gerichte gefunden.');

	return {
		...parseValidityPeriod(titleText, now),
		items
	};
}

export async function importKhanitthaMenu(now = new Date()) {
	const response = await fetch(sourceUrl, {
		headers: { 'user-agent': 'LunchMenuBot/1.0 (weekly public menu import)' },
		signal: AbortSignal.timeout(15_000)
	});
	if (!response.ok) throw new Error(`Restaurantseite antwortete mit HTTP ${response.status}.`);

	const menu = parseKhanitthaMenu(await response.text(), now);
	return storeRestaurantMenus(
		restaurant,
		sourceUrl,
		[{ ...menu, menuType: 'weekly' }],
		now.getTime()
	);
}
