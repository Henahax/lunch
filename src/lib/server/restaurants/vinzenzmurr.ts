import { load } from 'cheerio';
import type { AnyNode } from 'domhandler';
import { storeRestaurantMenus, type ImportedMenuItem, type ImportedMenuPlan } from './store-menu';

const sourceUrl = 'https://vinzenzmurr.de/wochenkarte/';
const restaurantUrl = 'https://vinzenzmurr.de/';
const restaurant = { slug: 'vinzenzmurr', name: 'Vinzenzmurr' };

const weekdays = [
	['montag', 1],
	['dienstag', 2],
	['mittwoch', 3],
	['donnerstag', 4],
	['freitag', 5],
	['samstag', 6],
	['sonntag', 0]
] as const;

function cleanText(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}

function normalizeText(value: string): string {
	return cleanText(value).toLocaleLowerCase('de-DE').normalize('NFD').replace(/\p{M}/gu, '');
}

function dateString(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function parseDateRange(title: string, now: Date): { validFrom: string; validUntil: string } {
	const match = title.match(
		/(\d{1,2})\.(\d{1,2})\.?(?:\s*(\d{4}))?\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.?(?:\s*(\d{4}))?/
	);
	if (!match) throw new Error(`Gültigkeitszeitraum der Wochenkarte nicht erkannt: ${title}`);

	const [, fromDay, fromMonth, startYearText, untilDay, untilMonth, endYearText] = match;
	const currentYear = now.getUTCFullYear();
	const endYear = Number(
		endYearText ??
			(startYearText
				? Number(startYearText) + (Number(fromMonth) > Number(untilMonth) ? 1 : 0)
				: currentYear)
	);
	const startYear = Number(
		startYearText ?? (Number(fromMonth) > Number(untilMonth) ? endYear - 1 : endYear)
	);
	const validFrom = `${startYear}-${fromMonth.padStart(2, '0')}-${fromDay.padStart(2, '0')}`;
	const validUntil = `${endYear}-${untilMonth.padStart(2, '0')}-${untilDay.padStart(2, '0')}`;
	const start = new Date(`${validFrom}T00:00:00Z`);
	const end = new Date(`${validUntil}T00:00:00Z`);
	if (
		Number.isNaN(start.getTime()) ||
		Number.isNaN(end.getTime()) ||
		start.getUTCDate() !== Number(fromDay) ||
		start.getUTCMonth() + 1 !== Number(fromMonth) ||
		end.getUTCDate() !== Number(untilDay) ||
		end.getUTCMonth() + 1 !== Number(untilMonth) ||
		validFrom > validUntil
	) {
		throw new Error(`Ungültiger Gültigkeitszeitraum der Wochenkarte: ${title}`);
	}
	return { validFrom, validUntil };
}

function extractLines(node: AnyNode, lines: string[], current: string[]): void {
	if (node.type === 'text') {
		current.push(node.data);
		return;
	}
	if (!('children' in node)) return;

	const isElement = node.type === 'tag';
	const tagName = isElement ? node.name.toLowerCase() : '';
	const isBlock = /^(address|article|br|div|h[1-6]|li|p|section|tr)$/.test(tagName);
	const flush = () => {
		const line = cleanText(current.join(''));
		if (line) lines.push(line);
		current.length = 0;
	};
	if (isBlock) flush();
	for (const child of node.children) extractLines(child, lines, current);
	if (isBlock) flush();
}

function findWeekdays(text: string): number[] {
	const normalized = normalizeText(text);
	const found = weekdays
		.map(([name, day]) => ({ name, day, index: normalized.search(new RegExp(`\\b${name}s?\\b`)) }))
		.filter(({ index }) => index >= 0)
		.sort((left, right) => left.index - right.index);
	return [...new Set(found.map(({ day }) => day))];
}

function isDayGroupHeading(line: string): boolean {
	if (/\d[.,]\d{2}\s*(?:€|eur)\s*$/i.test(line)) return false;
	const normalized = normalizeText(line)
		.replace(/^(?:zusatzlich\s+)?(?:(?:am|an|den)\s+)*/u, '')
		.replace(/\b(?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)s?\b/g, '')
		.replace(/\b(?:und|bis)\b|[-–,.:]/g, '')
		.trim();
	return normalized === '' && findWeekdays(line).length > 0;
}

function weekdaySetForHeading(line: string): Set<number> {
	const days = findWeekdays(line);
	if (days.length < 2 || !/\b(?:bis)\b|[-–]/i.test(line)) return new Set(days);
	const range = new Set<number>();
	for (let day = days[0]; ; day = day === 6 ? 0 : day + 1) {
		range.add(day);
		if (day === days.at(-1)) break;
	}
	return range;
}

function isWeeklyHeading(line: string): boolean {
	const days = weekdaySetForHeading(line);
	return days.size === 5 && [1, 2, 3, 4, 5].every((day) => days.has(day));
}

function parseItems(lines: string[]): ImportedMenuItem[] {
	const items: ImportedMenuItem[] = [];
	let name = '';
	const description: string[] = [];
	const priceAtEnd = /\s*\d+(?:[.,]\d{2})\s*(?:€|eur)\s*$/i;
	const save = () => {
		if (!name) return;
		items.push({ name, description: cleanText(description.join(' ')) });
		name = '';
		description.length = 0;
	};

	for (const line of lines) {
		const value = cleanText(line);
		if (
			!value ||
			/^(?:die angegebenen preise|solange der vorrat|metzgerei vinzenzmurr)/i.test(value)
		)
			continue;
		const hasPrice = priceAtEnd.test(value);
		const textWithoutPrice = hasPrice ? cleanText(value.replace(priceAtEnd, '')) : value;

		if (!name) {
			if (hasPrice) {
				if (!textWithoutPrice) throw new Error(`Preis ohne Gerichtname gefunden: ${value}`);
				name = textWithoutPrice;
				save();
			} else {
				name = value;
			}
			continue;
		}

		if (hasPrice) {
			if (textWithoutPrice) description.push(textWithoutPrice);
			save();
		} else {
			description.push(value);
		}
	}

	if (name) throw new Error(`Gericht ohne Preisabschluss wurde nicht vollständig gelesen: ${name}`);
	return items;
}

function datesForWeekdays(
	period: { validFrom: string; validUntil: string },
	validWeekdays: Set<number>
): string[] {
	const dates: string[] = [];
	const end = new Date(`${period.validUntil}T00:00:00Z`);
	for (let current = new Date(`${period.validFrom}T00:00:00Z`); current <= end;) {
		const weekday = current.getUTCDay();
		if (validWeekdays.has(weekday)) dates.push(dateString(current));
		current.setUTCDate(current.getUTCDate() + 1);
	}
	return dates;
}

export function parseVinzenzmurrMenu(html: string, now = new Date()): ImportedMenuPlan[] {
	const $ = load(html);
	const title = $('h1, h2, h3, h4')
		.toArray()
		.find((element) => /wochenkarte/i.test(cleanText($(element).text())));
	if (!title) throw new Error('Überschrift der Vinzenzmurr-Wochenkarte wurde nicht gefunden.');
	const titleText = cleanText($(title).text());
	const period = parseDateRange(titleText, now);
	const $main = $(title).closest('main');
	const $article = $(title).closest('article');
	const root = $main.length ? $main : $article.length ? $article : $('body');
	const lines: string[] = [];
	extractLines(root.get(0)!, lines, []);
	const titleIndex = lines.findIndex(
		(line) => /wochenkarte/i.test(line) && /\d{1,2}\.\d{1,2}/.test(line)
	);
	if (titleIndex < 0)
		throw new Error('Titel mit Gültigkeitszeitraum wurde im Seiteninhalt nicht gefunden.');

	const groups: { heading: string; lines: string[] }[] = [];
	let group: (typeof groups)[number] | undefined;
	for (const line of lines.slice(titleIndex + 1)) {
		if (/^(?:die angegebenen preise|solange der vorrat|metzgerei vinzenzmurr)/i.test(line)) break;
		if (isDayGroupHeading(line)) {
			group = { heading: line, lines: [] };
			groups.push(group);
		} else if (group) {
			group.lines.push(line);
		}
	}
	if (groups.length === 0)
		throw new Error('Wochentagsgruppen wurden auf der Vinzenzmurr-Seite nicht gefunden.');

	const weeklyItems: ImportedMenuItem[] = [];
	const dailyItems = new Map<string, ImportedMenuItem[]>();
	for (const currentGroup of groups) {
		const items = parseItems(currentGroup.lines);
		if (items.length === 0)
			throw new Error(`Keine Gerichte in der Gruppe „${currentGroup.heading}“ erkannt.`);
		if (isWeeklyHeading(currentGroup.heading)) {
			weeklyItems.push(...items);
			continue;
		}

		const dates = datesForWeekdays(period, weekdaySetForHeading(currentGroup.heading));
		if (dates.length === 0) {
			throw new Error(
				`Die Wochentage der Gruppe „${currentGroup.heading}“ liegen außerhalb der Wochenkarte.`
			);
		}
		for (const date of dates) dailyItems.set(date, [...(dailyItems.get(date) ?? []), ...items]);
	}

	const plans: ImportedMenuPlan[] = [...dailyItems.entries()].map(([date, items]) => ({
		menuType: 'daily',
		validFrom: date,
		validUntil: date,
		items
	}));
	if (weeklyItems.length > 0) plans.push({ menuType: 'weekly', ...period, items: weeklyItems });
	if (plans.length === 0)
		throw new Error('Auf der Vinzenzmurr-Wochenkarte wurden keine Gerichte erkannt.');
	return plans;
}

export async function importVinzenzmurrMenu(now = new Date()) {
	const response = await fetch(sourceUrl, {
		headers: { 'user-agent': 'LunchMenuBot/1.0 (weekly public menu import)' },
		signal: AbortSignal.timeout(20_000)
	});
	if (!response.ok) throw new Error(`Vinzenzmurr-Seite antwortete mit HTTP ${response.status}.`);
	const plans = parseVinzenzmurrMenu(await response.text(), now);
	return storeRestaurantMenus(restaurant, sourceUrl, plans, now.getTime(), restaurantUrl);
}
