<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { SvelteDate, SvelteSet } from 'svelte/reactivity';
	import FavoritesDrawer from '#lib/components/FavoritesDrawer.svelte';
	import InfoDrawer from '#lib/components/InfoDrawer.svelte';
	import OtherRestaurants from '#lib/components/OtherRestaurants.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import RestaurantCard from '#lib/components/RestaurantCard.svelte';
	import RestaurantSettingsDrawer from '#lib/components/RestaurantSettingsDrawer.svelte';
	import favoriteSuggestions from '#lib/favorite-suggestions.json';
	import otherRestaurants from '#lib/other-restaurants.json';
	import type { PageProps } from './$types';

	const favoritesStorageKey = 'lunch.favorite-dishes.v1';
	const favoriteRemindersStorageKey = 'lunch.favorite-reminders.v1';
	const deliveredRemindersStorageKey = 'lunch.favorite-reminders-delivered.v1';
	const lastReminderScanStorageKey = 'lunch.favorite-reminders-last-scan.v1';
	const restaurantCookieName = 'lunch-hidden-restaurants';
	const restaurantOrderCookieName = 'lunch-restaurant-order';
	const restaurantCollapsedCookieName = 'lunch-collapsed-restaurants';

	let { data }: PageProps = $props();
	let favoriteDialog = $state<HTMLDialogElement | null>(null);
	let restaurantDialog = $state<HTMLDialogElement | null>(null);
	let infoDialog = $state<HTMLDialogElement | null>(null);
	let restaurantOrder = $state<string[]>([]);
	// svelte-ignore state_referenced_locally
	let collapsedRestaurantSlugs = $state<string[]>(data.collapsedSlugs ?? []);
	let favorites = $state(['']);
	let favoriteReminderEnabled = $state([false]);
	let shuffledFavoriteSuggestions = $state<string[]>([]);
	let hiddenRestaurantIds = $state<string[]>([]);
	let favoritesStorageWarning = $state('');
	let checkingFavoriteReminders = false;
	const favoriteCount = $derived(favorites.filter((favorite) => favorite.trim()).length);
	const orderedRestaurants = $derived(
		[...data.restaurants].sort((left, right) => {
			const leftIndex = restaurantOrder.indexOf(left.slug);
			const rightIndex = restaurantOrder.indexOf(right.slug);
			return (
				(leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
				(rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex)
			);
		})
	);
	const visibleRestaurants = $derived(
		orderedRestaurants.filter((restaurant) => !hiddenRestaurantIds.includes(restaurant.id))
	);
	const days = $derived.by(() => {
		const monday = new SvelteDate(`${data.weekStart}T00:00:00Z`);
		return Array.from({ length: 5 }, (_, offset) => {
			const date = new SvelteDate(monday);
			date.setUTCDate(date.getUTCDate() + offset);
			return {
				date: date.toISOString().slice(0, 10),
				name: date.toLocaleDateString('de-DE', { weekday: 'long', timeZone: 'UTC' }),
				label: date.toLocaleDateString('de-DE', {
					day: 'numeric',
					month: 'numeric',
					timeZone: 'UTC'
				})
			};
		});
	});

	const currentYear = new Date().getFullYear();

	function getCalendarWeek(date: Date): number {
		const d = new SvelteDate(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

		d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));

		const yearStart = new SvelteDate(Date.UTC(d.getUTCFullYear(), 0, 1));

		return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
	}

	const today = new SvelteDate();
	const todayDate = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Europe/Berlin',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(today);

	function formatDate(date: string): string {
		return new SvelteDate(`${date}T00:00:00`).toLocaleDateString('de-DE', {
			day: 'numeric',
			month: 'long'
		});
	}

	function normalizeForSearch(value: string): string {
		return value
			.toLocaleLowerCase('de-DE')
			.replace(/ß/g, 'ss')
			.normalize('NFD')
			.replace(/\p{M}/gu, '')
			.replace(/[^\p{L}\p{N}]+/gu, ' ')
			.trim();
	}

	function matchingFavorites(value: string): string[] {
		const normalizedValue = normalizeForSearch(withoutPrices(value));
		return [...new SvelteSet(favorites.map((favorite) => favorite.trim()).filter(Boolean))].filter(
			(favorite) => {
				const normalizedFavorite = normalizeForSearch(favorite);
				return normalizedFavorite.length > 0 && normalizedValue.includes(normalizedFavorite);
			}
		);
	}

	function getFavoritePlaceholder(index: number): string {
		const suggestion = shuffledFavoriteSuggestions[index % shuffledFavoriteSuggestions.length];
		return suggestion ? `z. B. ${suggestion}` : 'Lieblingsgericht';
	}

	function persistFavorites() {
		try {
			localStorage.setItem(
				favoritesStorageKey,
				JSON.stringify(favorites.map((favorite) => favorite.trim()).filter(Boolean))
			);
			favoritesStorageWarning = '';
		} catch {
			favoritesStorageWarning = 'Favoriten konnten in diesem Browser nicht gespeichert werden.';
		}
	}

	function persistFavoriteReminders() {
		try {
			localStorage.setItem(
				favoriteRemindersStorageKey,
				JSON.stringify(
					favoriteReminderEnabled.filter((_, index) => Boolean(favorites[index]?.trim()))
				)
			);
			favoritesStorageWarning = '';
		} catch {
			favoritesStorageWarning = 'Erinnerungseinstellungen konnten nicht gespeichert werden.';
		}
	}

	async function toggleFavoriteReminder(index: number) {
		if (favoriteReminderEnabled[index]) {
			favoriteReminderEnabled[index] = false;
			persistFavoriteReminders();
			return;
		}

		if (!window.isSecureContext || !('Notification' in window)) {
			favoritesStorageWarning = 'Browser-Erinnerungen werden hier nicht unterstützt.';
			return;
		}

		let permission = Notification.permission;
		if (permission === 'default') permission = await Notification.requestPermission();
		if (permission !== 'granted') {
			favoritesStorageWarning = 'Erlaube Benachrichtigungen in den Browser-Einstellungen.';
			return;
		}

		favoriteReminderEnabled[index] = true;
		persistFavoriteReminders();
		void checkFavoriteReminders(true);
	}

	function updateFavorite(index: number, value: string) {
		favorites[index] = value;
		persistFavorites();
		persistFavoriteReminders();
	}

	function addFavorite() {
		favorites.push('');
		favoriteReminderEnabled.push(false);
	}

	function removeFavorite(index: number) {
		favorites = favorites.filter((_, favoriteIndex) => favoriteIndex !== index);
		favoriteReminderEnabled = favoriteReminderEnabled.filter(
			(_, favoriteIndex) => favoriteIndex !== index
		);
		if (favorites.length === 0) {
			favorites = [''];
			favoriteReminderEnabled = [false];
		}
		persistFavorites();
		persistFavoriteReminders();
	}

	function persistHiddenRestaurants() {
		document.cookie = `${restaurantCookieName}=${encodeURIComponent(JSON.stringify(hiddenRestaurantIds))}; path=/; max-age=31536000; samesite=lax`;
	}

	function persistCollapsedRestaurants() {
		document.cookie = `${restaurantCollapsedCookieName}=${encodeURIComponent(JSON.stringify(collapsedRestaurantSlugs))}; path=/; max-age=31536000; samesite=lax`;
	}

	function toggleRestaurantDetails(slug: string, open: boolean) {
		if (open) {
			if (collapsedRestaurantSlugs.includes(slug)) {
				collapsedRestaurantSlugs = collapsedRestaurantSlugs.filter(
					(collapsedSlug) => collapsedSlug !== slug
				);
				persistCollapsedRestaurants();
			}
		} else {
			if (!collapsedRestaurantSlugs.includes(slug)) {
				collapsedRestaurantSlugs = [...collapsedRestaurantSlugs, slug];
				persistCollapsedRestaurants();
			}
		}
	}

	function toggleRestaurant(id: string, visible: boolean) {
		hiddenRestaurantIds = visible
			? hiddenRestaurantIds.filter((hiddenId) => hiddenId !== id)
			: [...hiddenRestaurantIds, id];
		persistHiddenRestaurants();
	}

	function saveRestaurantOrder(order: string[]) {
		const knownSlugs = new SvelteSet(data.restaurants.map((restaurant) => restaurant.slug));
		restaurantOrder = [...order.filter((slug) => knownSlugs.has(slug))];
		for (const restaurant of data.restaurants) {
			if (!restaurantOrder.includes(restaurant.slug)) restaurantOrder.push(restaurant.slug);
		}
		document.cookie = `${restaurantOrderCookieName}=${encodeURIComponent(JSON.stringify(restaurantOrder))}; path=/; max-age=31536000; samesite=lax`;
	}

	function moveRestaurant(sourceSlug: string, targetSlug: string) {
		if (sourceSlug === targetSlug) return;
		const order = [...restaurantOrder];
		const sourceIndex = order.indexOf(sourceSlug);
		const targetIndex = order.indexOf(targetSlug);
		if (sourceIndex === -1 || targetIndex === -1) return;
		order.splice(sourceIndex, 1);
		order.splice(sourceIndex < targetIndex ? targetIndex - 1 : targetIndex, 0, sourceSlug);
		saveRestaurantOrder(order);
	}

	function moveRestaurantBy(slug: string, offset: number) {
		const order = [...restaurantOrder];
		const index = order.indexOf(slug);
		const targetIndex = index + offset;
		if (index === -1 || targetIndex < 0 || targetIndex >= order.length) return;
		[order[index], order[targetIndex]] = [order[targetIndex], order[index]];
		saveRestaurantOrder(order);
	}

	function formatDateTime(timestamp: number): string {
		return new SvelteDate(timestamp).toLocaleString('de-DE', {
			day: 'numeric',
			month: 'long',
			hour: '2-digit',
			minute: '2-digit',
			timeZone: 'Europe/Berlin'
		});
	}

	function withoutPrices(value: string): string {
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

	function isStale(timestamp: number): boolean {
		return Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000;
	}

	function berlinDateParts(date = new Date()) {
		return Object.fromEntries(
			new Intl.DateTimeFormat('en-GB', {
				timeZone: 'Europe/Berlin',
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit',
				hourCycle: 'h23'
			})
				.formatToParts(date)
				.filter((part) => part.type !== 'literal')
				.map(({ type, value }) => [type, value])
		) as Record<string, string>;
	}

	async function checkFavoriteReminders(force = false) {
		if (
			checkingFavoriteReminders ||
			!favoriteReminderEnabled.some(Boolean) ||
			typeof Notification === 'undefined' ||
			Notification.permission !== 'granted'
		)
			return;

		const parts = berlinDateParts();
		const todayKey = `${parts.year}-${parts.month}-${parts.day}`;
		if (Number(parts.hour) < 11 || Number(parts.hour) >= 20) return;
		if (!force && localStorage.getItem(lastReminderScanStorageKey) === todayKey) return;

		checkingFavoriteReminders = true;
		try {
			await invalidateAll();
			const refreshedParts = berlinDateParts();
			if (
				`${refreshedParts.year}-${refreshedParts.month}-${refreshedParts.day}` !== todayKey ||
				Number(refreshedParts.hour) >= 20
			)
				return;
			const date = new SvelteDate(`${todayKey}T00:00:00Z`);
			date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
			const weekKey = date.toISOString().slice(0, 10);
			const deliveredValue: unknown = JSON.parse(
				localStorage.getItem(deliveredRemindersStorageKey) ?? '[]'
			);
			const delivered = new SvelteSet(
				Array.isArray(deliveredValue)
					? deliveredValue.filter((key): key is string => typeof key === 'string')
					: []
			);
			const newMatches: { key: string; text: string }[] = [];
			const queued = new SvelteSet<string>();

			for (const restaurant of visibleRestaurants) {
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
							if (!favoriteReminderEnabled[index] || !favorite || !menuText.includes(favorite))
								continue;
							const key = `${menu.menuType}:${menu.menuType === 'daily' ? todayKey : weekKey}:${favorite}:${restaurant.id}:${item.id}`;
							if (delivered.has(key) || queued.has(key)) continue;
							queued.add(key);
							newMatches.push({
								key,
								text: `${menu.menuType === 'daily' ? 'Tagesgericht' : 'Wochenangebot'}: ${restaurant.restaurantName} – ${withoutPrices(item.name)}`
							});
						}
					}
				}
			}

			localStorage.setItem(lastReminderScanStorageKey, todayKey);
			if (newMatches.length > 0) {
				const recentDelivered = [...delivered].filter(
					(key) => key.includes(`:${weekKey}:`) || key.includes(`:${todayKey}:`)
				);
				localStorage.setItem(
					deliveredRemindersStorageKey,
					JSON.stringify([
						...new SvelteSet([...recentDelivered, ...newMatches.map(({ key }) => key)])
					])
				);
				new Notification('Lieblingsgerichte heute', {
					body: newMatches.map(({ text }) => text).join('\n')
				});
			}
		} catch (error) {
			console.error('Lieblingsgericht-Erinnerungen konnten nicht geprüft werden:', error);
		} finally {
			checkingFavoriteReminders = false;
		}
	}

	onMount(() => {
		restaurantOrder = data.restaurants.map((restaurant) => restaurant.slug);
		shuffledFavoriteSuggestions = [...favoriteSuggestions];
		for (let index = shuffledFavoriteSuggestions.length - 1; index > 0; index--) {
			const randomIndex = Math.floor(Math.random() * (index + 1));
			[shuffledFavoriteSuggestions[index], shuffledFavoriteSuggestions[randomIndex]] = [
				shuffledFavoriteSuggestions[randomIndex],
				shuffledFavoriteSuggestions[index]
			];
		}

		try {
			const cookie = document.cookie
				.split('; ')
				.find((entry) => entry.startsWith(`${restaurantCookieName}=`));
			if (cookie) {
				const parsed: unknown = JSON.parse(
					decodeURIComponent(cookie.slice(restaurantCookieName.length + 1))
				);
				if (Array.isArray(parsed)) {
					hiddenRestaurantIds = parsed.filter(
						(id): id is string =>
							typeof id === 'string' && data.restaurants.some((restaurant) => restaurant.id === id)
					);
				}
			}
		} catch {
			hiddenRestaurantIds = [];
		}

		try {
			const cookie = document.cookie
				.split('; ')
				.find((entry) => entry.startsWith(`${restaurantCollapsedCookieName}=`));
			if (cookie) {
				const parsed: unknown = JSON.parse(
					decodeURIComponent(cookie.slice(restaurantCollapsedCookieName.length + 1))
				);
				if (Array.isArray(parsed)) {
					collapsedRestaurantSlugs = parsed.filter(
						(slug): slug is string => typeof slug === 'string'
					);
				}
			}
		} catch {
			collapsedRestaurantSlugs = [];
		}

		try {
			const storedFavorites = localStorage.getItem(favoritesStorageKey);
			const parsed: unknown = storedFavorites ? JSON.parse(storedFavorites) : null;
			if (Array.isArray(parsed)) {
				const savedFavorites = parsed.filter(
					(favorite): favorite is string => typeof favorite === 'string'
				);
				favorites = savedFavorites.length > 0 ? savedFavorites : [''];
			}
			const storedReminders = localStorage.getItem(favoriteRemindersStorageKey);
			const parsedReminders: unknown = storedReminders ? JSON.parse(storedReminders) : null;
			if (Array.isArray(parsedReminders)) {
				favoriteReminderEnabled = favorites.map((_, index) => parsedReminders[index] === true);
			}
		} catch {
			favoritesStorageWarning = 'Favoriten konnten aus diesem Browser nicht geladen werden.';
		}

		const check = () => void checkFavoriteReminders();
		const interval = window.setInterval(check, 30_000);
		document.addEventListener('visibilitychange', check);
		check();
		return () => {
			window.clearInterval(interval);
			document.removeEventListener('visibilitychange', check);
		};
	});
</script>

<div class="mx-auto grid w-full max-w-screen-2xl min-w-0 gap-2">
	<PageHeader
		{favoriteCount}
		visibleRestaurantCount={visibleRestaurants.length}
		totalRestaurantCount={data.restaurants.length}
		weekNumber={getCalendarWeek(today)}
		dateLabel={today.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}
		onOpenFavorites={() => favoriteDialog?.showModal()}
		onOpenRestaurants={() => restaurantDialog?.showModal()}
		onOpenInfo={() => infoDialog?.showModal()}
	/>

	<main class="grid min-w-0 gap-4 p-2">
		<FavoritesDrawer
			bind:dialog={favoriteDialog}
			{favorites}
			{favoriteReminderEnabled}
			{favoritesStorageWarning}
			{getFavoritePlaceholder}
			onUpdateFavorite={updateFavorite}
			onToggleFavoriteReminder={toggleFavoriteReminder}
			onRemoveFavorite={removeFavorite}
			onAddFavorite={addFavorite}
		/>
		<RestaurantSettingsDrawer
			bind:dialog={restaurantDialog}
			{orderedRestaurants}
			{hiddenRestaurantIds}
			onToggleRestaurant={toggleRestaurant}
			onMoveRestaurant={moveRestaurant}
			onMoveRestaurantBy={moveRestaurantBy}
		/>
		<InfoDrawer
			bind:dialog={infoDialog}
			statuses={data.importStatuses}
			{formatDateTime}
			{isStale}
		/>

		<section class="grid min-w-0 gap-2">
			<h2 class="px-2 text-2xl">Restaurants</h2>
			{#if visibleRestaurants.length === 0}
				<p>Aktuell werden keine Restaurants angezeigt.</p>
			{:else}
				{#each visibleRestaurants as restaurant (restaurant.id)}
					<RestaurantCard
						{restaurant}
						{days}
						{todayDate}
						{formatDate}
						{withoutPrices}
						{matchingFavorites}
						isOpen={!collapsedRestaurantSlugs.includes(restaurant.slug)}
						onToggle={toggleRestaurantDetails}
					/>
				{/each}
			{/if}
		</section>

		<OtherRestaurants restaurants={otherRestaurants} />
	</main>
	<footer class="mx-auto p-4 text-xs">© {currentYear} henahax.net</footer>
</div>
