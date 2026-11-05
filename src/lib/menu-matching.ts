import type { Restaurant } from './types.js';

export type FavoriteReminderMatch = {
    key: string;
    text: string;
};

export function normalizeForSearch(value: string): string {
    return value
        .toLocaleLowerCase('de-DE')
        .replace(/ß/g, 'ss')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}

export function withoutPrices(value: string): string {
    return value
        .replace(/(?:\s*\.\s*){4,}.*$/u, '')
        .replace(/(?:\s*[·…]\s*){2,}.*$/u, '')
        .replace(
            /\s*\(?\s*(?:\d+(?:[.,]\d{2})\s*€|€\s*\d+(?:[.,]\d{2})|\d+(?:[.,]\d{2})\s*EUR)\s*\)?/gi,
            ''
        )
        .replace(/\b(?:Preis|Kosten)\s*:\s*/gi, '')
        .replace(/\s*[|•]\s*$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export function findFavoriteReminderMatches({
    restaurants,
    favorites,
    reminderEnabled,
    todayKey,
    weekKey,
    delivered
}: {
    restaurants: Restaurant[];
    favorites: string[];
    reminderEnabled: boolean[];
    todayKey: string;
    weekKey: string;
    delivered: ReadonlySet<string>;
}): FavoriteReminderMatch[] {
    const matches: FavoriteReminderMatch[] = [];
    const queued = new Set<string>();

    for (const restaurant of restaurants) {
        for (const menu of restaurant.menus) {
            if (menu.validFrom > todayKey || menu.validUntil < todayKey) continue;
            if (
                menu.menuType === 'weekly' &&
                todayKey !== (menu.validFrom > weekKey ? menu.validFrom : weekKey)
            )
                continue;

            for (const item of menu.items) {
                const menuText = normalizeForSearch(
                    withoutPrices(`${item.name} ${item.category ?? ''} ${item.description}`)
                );

                for (let index = 0; index < favorites.length; index++) {
                    const favorite = normalizeForSearch(favorites[index]);
                    if (!reminderEnabled[index] || !favorite || !menuText.includes(favorite)) continue;

                    const key = `${menu.menuType}:${menu.menuType === 'daily' ? todayKey : weekKey}:${favorite}:${restaurant.id}:${item.id}`;
                    if (delivered.has(key) || queued.has(key)) continue;
                    queued.add(key);
                    matches.push({
                        key,
                        text: `${menu.menuType === 'daily' ? 'Tagesgericht' : 'Wochenangebot'}: ${restaurant.restaurantName} – ${withoutPrices(item.name)}`
                    });
                }
            }
        }
    }

    return matches;
}
