import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { storeRestaurantMenus, type ImportedMenuItem, type ImportedMenuPlan } from './store-menu';
import { extractPdfLines } from './pdf-text';

const sourceUrl = 'https://noon-food.com/karte/wochenspeisekarte.pdf';
const restaurant = { slug: 'noon-food', name: 'noon food' };
const weekdays = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
const dayIndexes = new Map(weekdays.map((day, index) => [day.toLocaleUpperCase('de-DE'), index]));

type WeeklyItem = ImportedMenuItem & { category: string };

function cleanText(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}

function stripAllergenCodes(value: string): string {
	return cleanText(value)
		.replace(/\s*\(\s*[A-Z][A-Z0-9]*(?:\s*,\s*[A-Z][A-Z0-9]*)*\s*\)\s*/g, ' ')
		.replace(/\s+([,.;:!?])/g, '$1')
		.replace(/\s+/g, ' ')
		.trim();
}

function normalizeLabel(value: string): string {
	const compact = cleanText(value).replace(/\s/g, '').toLocaleUpperCase('de-DE');
	const labels: Record<string, string> = {
		MONTAG: 'Montag',
		DIENSTAG: 'Dienstag',
		MITTWOCH: 'Mittwoch',
		DONNERSTAG: 'Donnerstag',
		FREITAG: 'Freitag',
		MITFLEISCH: 'Mit Fleisch',
		VEGETARISCH: 'Vegetarisch',
		VEGAN: 'Vegan',
		'WEEKLY-BOWL': 'Weekly Bowl',
		WOCHENSALAT: 'Wochensalat',
		SALAT: 'Salat'
	};
	if (labels[compact]) return labels[compact];
	if (/^V\s*e\s*g\s*e\s*t\s*a\s*r\s*i\s*s\s*c\s*h\s*:/i.test(value)) {
		return value.replace(/^V\s*e\s*g\s*e\s*t\s*a\s*r\s*i\s*s\s*c\s*h\s*:/i, 'Vegetarisch:');
	}
	return cleanText(value);
}

function berlinDate(date: Date): string {
	const values = Object.fromEntries(
		new Intl.DateTimeFormat('en-CA', {
			timeZone: 'Europe/Berlin',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		})
			.formatToParts(date)
			.map(({ type, value }) => [type, value])
	);
	return `${values.year}-${values.month}-${values.day}`;
}

function isoWeek(date: Date): { year: number; week: number } {
	const day = new Date(`${berlinDate(date)}T00:00:00Z`);
	day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
	const year = day.getUTCFullYear();
	const yearStart = new Date(Date.UTC(year, 0, 1));
	const week = Math.ceil(((day.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
	return { year, week };
}

function parsePdfDate(value: unknown): Date | null {
	if (typeof value !== 'string') return null;
	const match = value.match(
		/^D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?(Z|[+-]\d{2}'?\d{2}'?)?/
	);
	if (!match) return null;
	const [, year, month, day, hour = '00', minute = '00', second = '00', zone = 'Z'] = match;
	const normalizedZone =
		zone === 'Z' ? 'Z' : zone.replace("'", '').replace(/([+-]\d{2})(\d{2})/, '$1:$2');
	const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${normalizedZone}`);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function weekRange(year: number, week: number): { monday: string; friday: string } {
	const januaryFourth = new Date(Date.UTC(year, 0, 4));
	const monday = new Date(
		Date.UTC(year, 0, 4 - ((januaryFourth.getUTCDay() + 6) % 7) + (week - 1) * 7)
	);
	const friday = new Date(monday);
	friday.setUTCDate(friday.getUTCDate() + 4);
	return { monday: monday.toISOString().slice(0, 10), friday: friday.toISOString().slice(0, 10) };
}

function isWeekday(line: string): number | undefined {
	return dayIndexes.get(line.replace(/\s/g, '').toLocaleUpperCase('de-DE'));
}

function weeklyTitle(line: string, section: 'bowl' | 'salad'): string | null {
	const quoted = line.match(/^[„“"]\s*(.+?)\s*[„“”"]$/);
	if (quoted) return quoted[1].trim();
	if (section === 'salad' && (line === 'Cheffe' || /^\d+(?:[.,]\d+)?$/.test(line))) return line;
	return null;
}

function parseMenuLines(lines: string[], week: { year: number; week: number }): ImportedMenuPlan[] {
	const weekNumber = lines.map((line) => line.match(/^KW\s*(\d{1,2})$/i)).find(Boolean)?.[1];
	if (!weekNumber || Number(weekNumber) !== week.week) {
		throw new Error(`PDF enthält nicht die aktuelle Kalenderwoche (PDF: KW ${weekNumber ?? '?'}).`);
	}

	const { monday, friday } = weekRange(week.year, week.week);
	const dayItems: ImportedMenuItem[][] = weekdays.map(() => []);
	const weeklyItems: WeeklyItem[] = [];
	let dayIndex: number | undefined;
	let dailyCategory: string | null = null;
	let weeklySection: 'bowl' | 'salad' | null = null;
	let pendingWeekly: WeeklyItem | null = null;
	let awaitingBowlVegetarianOption = false;

	const flushWeekly = () => {
		if (awaitingBowlVegetarianOption) {
			throw new Error('Vegetarische Weekly-Bowl-Option hat kein zugehöriges Bowl-Gericht.');
		}
		if (pendingWeekly?.description) weeklyItems.push(pendingWeekly);
		pendingWeekly = null;
	};

	for (const rawLine of lines) {
		const line = normalizeLabel(stripAllergenCodes(rawLine));
		if (!line) continue;
		const day = isWeekday(line);
		if (day !== undefined) {
			flushWeekly();
			dayIndex = day;
			dailyCategory = null;
			weeklySection = null;
			continue;
		}

		if (line === 'Weekly Bowl') {
			flushWeekly();
			dayIndex = undefined;
			dailyCategory = null;
			weeklySection = 'bowl';
			continue;
		}
		if (line === 'Wochensalat') {
			flushWeekly();
			dayIndex = undefined;
			dailyCategory = null;
			weeklySection = 'salad';
			continue;
		}
		if (/^KW\s*\d{1,2}$/i.test(line) || /^\(?\d+\)?$/.test(line) || /^www\./i.test(line)) {
			if (/^www\./i.test(line)) break;
			continue;
		}

		if (dayIndex !== undefined) {
			if (line === 'Mit Fleisch' || line === 'Vegan' || line === 'Vegetarisch') {
				dailyCategory = line;
				continue;
			}
			if (dailyCategory && !/^Tagesgerichte$/i.test(line)) {
				dayItems[dayIndex].push({
					code: '',
					category: dailyCategory,
					name: line,
					description: ''
				});
			}
			continue;
		}

		if (!weeklySection || /^Montag\s*–\s*Freitag$/i.test(line) || /^Dressing\s*:/i.test(line)) {
			continue;
		}
		if (weeklySection === 'salad' && line === 'Salat') continue;

		if (weeklySection === 'bowl') {
			const vegetarian = line.match(/^Vegetarisch:\s*(.+)$/i);
			if (vegetarian) {
				if (!pendingWeekly) {
					throw new Error('Vegetarische Weekly-Bowl-Option hat kein zugehöriges Bowl-Gericht.');
				}
				pendingWeekly.description = cleanText(
					`${pendingWeekly.description} Vegetarisch: ${vegetarian[1]}`
				);
				continue;
			}
			if (line === 'Vegetarisch') {
				if (!pendingWeekly) {
					throw new Error('Vegetarische Weekly-Bowl-Option hat kein zugehöriges Bowl-Gericht.');
				}
				awaitingBowlVegetarianOption = true;
				continue;
			}
			if (awaitingBowlVegetarianOption) {
				const bowl = pendingWeekly;
				if (!bowl) {
					throw new Error('Vegetarische Weekly-Bowl-Option hat kein zugehöriges Bowl-Gericht.');
				}
				bowl.description = cleanText(`${bowl.description} Vegetarisch: ${line}`);
				awaitingBowlVegetarianOption = false;
				continue;
			}
		}

		const title = weeklyTitle(line, weeklySection);
		if (title) {
			flushWeekly();
			pendingWeekly = {
				code: '',
				category: weeklySection === 'bowl' ? 'Weekly Bowl' : 'Wochensalat',
				name: weeklySection === 'salad' && /^\d/.test(title) ? `Salat ${title}` : title,
				description: ''
			};
		} else if (pendingWeekly) {
			pendingWeekly.description = cleanText(`${pendingWeekly.description} ${line}`);
		}
	}
	flushWeekly();

	if (dayItems.some((items) => items.length === 0) || weeklyItems.length === 0) {
		throw new Error(
			'Tages- oder Wochenmenüs konnten nicht vollständig aus der PDF gelesen werden.'
		);
	}

	const dailyPlans = dayItems.map((items, index) => {
		const date = new Date(`${monday}T00:00:00Z`);
		date.setUTCDate(date.getUTCDate() + index);
		const validFrom = date.toISOString().slice(0, 10);
		return { menuType: 'daily' as const, validFrom, validUntil: validFrom, items };
	});
	return [
		...dailyPlans,
		{ menuType: 'weekly' as const, validFrom: monday, validUntil: friday, items: weeklyItems }
	];
}

export async function importNoonMenu(now = new Date()) {
	const response = await fetch(sourceUrl, {
		headers: { 'user-agent': 'LunchMenuBot/1.0 (weekly public menu import)' },
		signal: AbortSignal.timeout(20_000)
	});
	if (!response.ok) throw new Error(`PDF-Quelle antwortete mit HTTP ${response.status}.`);
	const contentType = response.headers.get('content-type') ?? '';
	if (!contentType.includes('application/pdf'))
		throw new Error('Die Quelle hat keine PDF-Datei geliefert.');

	const data = new Uint8Array(await response.arrayBuffer());
	if (data.length === 0 || data.length > 20_000_000)
		throw new Error('PDF-Dateigröße ist ungültig.');
	const loadingTask = getDocument({ data });
	let plans: ImportedMenuPlan[];
	try {
		const document = await loadingTask.promise;
		const metadata = await document.getMetadata();
		const info = metadata.info as Record<string, unknown>;
		const sourceDate = response.headers.get('last-modified')
			? new Date(response.headers.get('last-modified')!)
			: (parsePdfDate(info.ModDate) ?? parsePdfDate(info.CreationDate));
		if (!sourceDate || Number.isNaN(sourceDate.getTime())) {
			throw new Error('Aktualisierungsdatum der PDF wurde nicht gefunden.');
		}

		const age = now.getTime() - sourceDate.getTime();
		if (age < -86_400_000 || age > 14 * 86_400_000) {
			throw new Error(
				'Die PDF ist älter als 14 Tage oder ihr Aktualisierungsdatum liegt in der Zukunft.'
			);
		}

		const currentWeek = isoWeek(now);

		const page = await document.getPage(1);
		const content = await page.getTextContent();
		plans = parseMenuLines(extractPdfLines(content.items).map(normalizeLabel), currentWeek);
		page.cleanup();
	} finally {
		await loadingTask.destroy();
	}

	return storeRestaurantMenus(restaurant, sourceUrl, plans, now.getTime());
}
