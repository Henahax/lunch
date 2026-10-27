type PdfTextItem = { str: string; transform: number[]; width: number };

export function extractPdfLines(items: unknown[], rowTolerance = 0.75): string[] {
	const textItems = items.filter(
		(item): item is PdfTextItem =>
			typeof item === 'object' &&
			item !== null &&
			'str' in item &&
			'transform' in item &&
			typeof item.str === 'string' &&
			Array.isArray(item.transform) &&
			'width' in item &&
			typeof item.width === 'number'
	);
	const rows: { y: number; items: PdfTextItem[] }[] = [];

	for (const item of textItems) {
		if (!item.str.trim()) continue;
		const y = item.transform[5];
		let row = rows.find((candidate) => Math.abs(candidate.y - y) < rowTolerance);
		if (!row) {
			row = { y, items: [] };
			rows.push(row);
		}
		row.items.push(item);
	}

	return rows
		.sort((left, right) => right.y - left.y)
		.map((row) => {
			const sorted = row.items.sort((left, right) => left.transform[4] - right.transform[4]);
			let line = '';
			let previous: PdfTextItem | undefined;
			for (const item of sorted) {
				if (!item.str) continue;
				if (previous) {
					const gap = item.transform[4] - (previous.transform[4] + previous.width);
					if (gap > 0.8 && !line.endsWith(' ') && !item.str.startsWith(' ')) line += ' ';
				}
				line += item.str;
				previous = item;
			}
			return line.replace(/\s+/g, ' ').trim();
		})
		.filter(Boolean);
}
