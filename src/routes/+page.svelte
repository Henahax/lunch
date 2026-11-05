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
	import {
		findFavoriteReminderMatches,
		normalizeForSearch,
		withoutPrices
	} from '#lib/menu-matching.js';
	import otherRestaurants from '#lib/other-restaurants.json';
	import type { PageProps } from './$types';

	const favoritesStorageKey = 'lunch.favorite-dishes.v1';
	const favoriteRemindersStorageKey = 'lunch.favorite-reminders.v1';
	const deliveredRemindersStorageKey = 'lunch.favorite-reminders-delivered.v1';
	const lastReminderScanStorageKey = 'lunch.favorite-reminders-last-scan.v1';
	const restaurantCookieName = 'lunch-hidden-restaurants';
	const restaurantOrderCookieName = 'lunch-restaurant-order';
	const restaurantCollapsedCookieName = 'lunch-collapsed-restaurants';
	const restaurantMobileOpenCookieName = 'lunch-mobile-open-restaurant';
	const otherRestaurantsOpenCookieName = 'lunch-other-restaurants-open';

	let { data }: PageProps = $props();
	let favoriteDialog = $state<HTMLDialogElement | null>(null);
	let restaurantDialog = $state<HTMLDialogElement | null>(null);
	let infoDialog = $state<HTMLDialogElement | null>(null);
	let restaurantOrder = $state<string[]>([]);
	// svelte-ignore state_referenced_locally
	let collapsedRestaurantSlugs = $state<string[]>(data.collapsedSlugs ?? []);
	let isMobileViewport = $state(false);
	let otherRestaurantsOpen = $state(true);
	let otherRestaurantsOpenPreference = $state<boolean | null>(null);
	// svelte-ignore state_referenced_locally
	let mobileOpenSlug = $state<string | null>(data.mobileOpenSlug);
	// svelte-ignore state_referenced_locally
	let hasMobileAccordionPreference = $state(data.hasMobileAccordionPreference);
	let favorites = $state(['']);
	let favoriteReminderEnabled = $state([false]);
	let shuffledFavoriteSuggestions = $state<string[]>([]);
	let hiddenRestaurantIds = $state<string[]>([]);
	let favoritesStorageWarning = $state('');
	let checkingFavoriteReminders = false;
	let refreshPromise: Promise<void> | null = null;
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
	const selectedRestaurants = $derived(
		orderedRestaurants.filter((restaurant) => !hiddenRestaurantIds.includes(restaurant.id))
	);
	const visibleRestaurants = $derived(
		selectedRestaurants.filter((restaurant) => restaurant.menus.length > 0)
	);
	const mobileAccordionOpenSlug = $derived(
		hasMobileAccordionPreference ? mobileOpenSlug : (visibleRestaurants[0]?.slug ?? null)
	);
	const unavailableRestaurants = $derived(
		selectedRestaurants
			.filter((restaurant) => restaurant.menus.length === 0)
			.map((restaurant) => ({
				name: restaurant.restaurantName,
				importFailed: data.importStatuses.find((status) => status.sourceSlug === restaurant.slug)
					?.lastError
			}))
	);
	const failedMenuRestaurants = $derived(
		unavailableRestaurants.filter((restaurant) => restaurant.importFailed).map(({ name }) => name)
	);
	const pendingMenuRestaurants = $derived(
		unavailableRestaurants.filter((restaurant) => !restaurant.importFailed).map(({ name }) => name)
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
		return new SvelteDate(`${date}T00:00:00`)
			.toLocaleDateString('de-DE', {
				day: 'numeric',
				month: 'long'
			})
			.replace(' ', '\u00a0');
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

	function persistMobileOpenRestaurant() {
		document.cookie = `${restaurantMobileOpenCookieName}=${encodeURIComponent(mobileOpenSlug ?? '')}; path=/; max-age=31536000; samesite=lax`;
	}

	function persistOtherRestaurantsOpen(open: boolean) {
		otherRestaurantsOpen = open;
		otherRestaurantsOpenPreference = open;
		document.cookie = `${otherRestaurantsOpenCookieName}=${open}; path=/; max-age=31536000; samesite=lax`;
	}

	function toggleOtherRestaurants(open: boolean, userInitiated: boolean) {
		if (isMobileViewport && open && userInitiated) {
			mobileOpenSlug = null;
			hasMobileAccordionPreference = true;
			persistMobileOpenRestaurant();
		}
		if (userInitiated) {
			persistOtherRestaurantsOpen(open);
		} else {
			otherRestaurantsOpen = open;
		}
	}

	function toggleRestaurantDetails(slug: string, open: boolean) {
		if (isMobileViewport) {
			if (open) {
				mobileOpenSlug = slug;
				persistOtherRestaurantsOpen(false);
			} else if (mobileOpenSlug === slug) {
				mobileOpenSlug = null;
			}
			hasMobileAccordionPreference = true;
			persistMobileOpenRestaurant();
			return;
		}

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

	function refreshPageData(): Promise<void> {
		if (refreshPromise) return refreshPromise;
		refreshPromise = invalidateAll().finally(() => (refreshPromise = null));
		return refreshPromise;
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
		const weekday = new SvelteDate(`${todayKey}T00:00:00Z`).getUTCDay();
		if (weekday === 0 || weekday === 6) return;
		if (Number(parts.hour) < 11 || Number(parts.hour) >= 20) return;
		if (!force && localStorage.getItem(lastReminderScanStorageKey) === todayKey) return;

		checkingFavoriteReminders = true;
		try {
			await refreshPageData();
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
			const newMatches = findFavoriteReminderMatches({
				restaurants: visibleRestaurants,
				favorites,
				reminderEnabled: favoriteReminderEnabled,
				todayKey,
				weekKey,
				delivered
			});

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
		const mobileViewport = window.matchMedia('(max-width: 639px)');
		const syncMobileViewport = () => {
			isMobileViewport = mobileViewport.matches;
			otherRestaurantsOpen = otherRestaurantsOpenPreference ?? !isMobileViewport;
		};

		try {
			const cookie = document.cookie
				.split('; ')
				.find((entry) => entry.startsWith(`${otherRestaurantsOpenCookieName}=`));
			if (cookie) {
				const value = decodeURIComponent(cookie.slice(otherRestaurantsOpenCookieName.length + 1));
				if (value === 'true' || value === 'false') {
					otherRestaurantsOpenPreference = value === 'true';
				}
			}
		} catch {
			otherRestaurantsOpenPreference = null;
		}

		syncMobileViewport();
		mobileViewport.addEventListener('change', syncMobileViewport);

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

		const refreshWhenOnline = () => {
			if (!navigator.onLine) return;
			void refreshPageData().catch((error) => {
				console.warn('Aktuelle Menüdaten konnten nicht nachgeladen werden:', error);
			});
		};
		if ('serviceWorker' in navigator && navigator.serviceWorker.controller) refreshWhenOnline();
		window.addEventListener('online', refreshWhenOnline);

		const check = () => void checkFavoriteReminders();
		const interval = window.setInterval(check, 30_000);
		document.addEventListener('visibilitychange', check);
		check();
		return () => {
			mobileViewport.removeEventListener('change', syncMobileViewport);
			window.clearInterval(interval);
			window.removeEventListener('online', refreshWhenOnline);
			document.removeEventListener('visibilitychange', check);
		};
	});
</script>

<div class="mx-auto flex min-h-dvh w-full max-w-screen-2xl min-w-0 flex-col gap-2">
	<PageHeader
		{favoriteCount}
		visibleRestaurantCount={selectedRestaurants.length}
		totalRestaurantCount={data.restaurants.length}
		weekNumber={getCalendarWeek(new SvelteDate(`${todayDate}T00:00:00Z`))}
		dateLabel={formatDate(todayDate)}
		onOpenFavorites={() => favoriteDialog?.showModal()}
		onOpenRestaurants={() => restaurantDialog?.showModal()}
		onOpenInfo={() => infoDialog?.showModal()}
	/>

	<main class="flex min-w-0 flex-1 flex-col gap-2 p-2">
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
			currentMenuSlugs={data.currentMenuSlugs}
			{formatDateTime}
			{isStale}
		/>

		<section class="grid min-w-0 grow content-start gap-1.5">
			<h2 class="px-2 text-2xl">Imbisse & Restaurants</h2>
			{#if selectedRestaurants.length === 0}
				<p>Aktuell werden keine Imbisse & Restaurants angezeigt.</p>
			{:else if visibleRestaurants.length === 0}
				<p>Für die ausgewählten Imbisse & Restaurants liegen derzeit keine Menüs vor.</p>
			{:else}
				{#each visibleRestaurants as restaurant (restaurant.id)}
					<RestaurantCard
						{restaurant}
						{days}
						{todayDate}
						isLastWeek={data.isLastWeek}
						{formatDate}
						{withoutPrices}
						{matchingFavorites}
						isOpen={isMobileViewport
							? !otherRestaurantsOpen && mobileAccordionOpenSlug === restaurant.slug
							: !collapsedRestaurantSlugs.includes(restaurant.slug)}
						onToggle={toggleRestaurantDetails}
					/>
				{/each}
			{/if}
			{#if failedMenuRestaurants.length > 0}
				<p class="px-2 text-sm text-gray-500" aria-live="polite">
					Der Import für {failedMenuRestaurants.join(', ')} ist fehlgeschlagen; aktuelle Menüdaten fehlen.
				</p>
			{/if}
			{#if pendingMenuRestaurants.length > 0}
				<p class="px-2 text-sm text-gray-500" aria-live="polite">
					Das aktuelle Menü von {pendingMenuRestaurants.join(', ')} liegt noch nicht vor.
				</p>
			{/if}
		</section>

		<OtherRestaurants
			restaurants={otherRestaurants}
			isOpen={otherRestaurantsOpen}
			onToggle={toggleOtherRestaurants}
		/>
	</main>
	<footer class="flex p-4 text-xs">
		<span class="grow text-center">© {currentYear} henahax.net</span>
		<a
			class="flex items-center gap-1"
			href="https://github.com/Henahax/lunch"
			target="_blank"
			rel="noopener noreferrer"
		>
			<i class="fa-brands fa-github"></i>
			<span>Source</span>
		</a>
	</footer>
</div>
