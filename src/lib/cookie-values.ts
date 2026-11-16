export function parseStringArrayCookie(value: string | undefined): string[] {
	try {
		const parsed: unknown = JSON.parse(value ?? '[]');
		return Array.isArray(parsed)
			? parsed.filter((entry): entry is string => typeof entry === 'string')
			: [];
	} catch {
		return [];
	}
}
