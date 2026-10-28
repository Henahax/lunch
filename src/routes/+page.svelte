<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { SvelteDate, SvelteSet } from 'svelte/reactivity';
	import favoriteSuggestions from '#lib/favorite-suggestions.json';
	import otherRestaurants from '#lib/other-restaurants.json';
	import type { PageProps } from './$types';

	const favoritesStorageKey = 'lunch.favorite-dishes.v1';
	const favoriteRemindersStorageKey = 'lunch.favorite-reminders.v1';
	const deliveredRemindersStorageKey = 'lunch.favorite-reminders-delivered.v1';
	const lastReminderScanStorageKey = 'lunch.favorite-reminders-last-scan.v1';
	const restaurantCookieName = 'lunch-hidden-restaurants';

	let { data }: PageProps = $props();
	let favoriteDialog = $state<HTMLDialogElement | null>(null);
	let restaurantDialog = $state<HTMLDialogElement | null>(null);
	let importStatusDialog = $state<HTMLDialogElement | null>(null);
	let favorites = $state(['']);
	let favoriteReminderEnabled = $state([false]);
	let shuffledFavoriteSuggestions = $state<string[]>([]);
	let hiddenRestaurantIds = $state<string[]>([]);
	let favoritesStorageWarning = $state('');
	let checkingFavoriteReminders = false;
	const favoriteCount = $derived(favorites.filter((favorite) => favorite.trim()).length);
	const visibleRestaurants = $derived(
		data.restaurants.filter((restaurant) => !hiddenRestaurantIds.includes(restaurant.id))
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

	function getCalendarWeek(date: Date): number {
		const d = new SvelteDate(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

		d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));

		const yearStart = new SvelteDate(Date.UTC(d.getUTCFullYear(), 0, 1));

		return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
	}

	const today = new SvelteDate();

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

	function closeDrawerOnBackdrop(event: MouseEvent) {
		if (event.target instanceof HTMLDialogElement) event.target.close();
	}

	function persistHiddenRestaurants() {
		document.cookie = `${restaurantCookieName}=${encodeURIComponent(JSON.stringify(hiddenRestaurantIds))}; path=/; max-age=31536000; samesite=lax`;
	}

	function toggleRestaurant(id: string, visible: boolean) {
		hiddenRestaurantIds = visible
			? hiddenRestaurantIds.filter((hiddenId) => hiddenId !== id)
			: [...hiddenRestaurantIds, id];
		persistHiddenRestaurants();
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

<div class="mx-auto grid w-full max-w-screen-2xl min-w-0 gap-6">
	<section
		class="page-header col-span-full grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 lg:flex"
	>
		<h1 class="order-1 col-span-3 text-3xl sm:grow">Mittagessen Beta</h1>
		<button
			type="button"
			onclick={() => favoriteDialog?.showModal()}
			class="order-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded border px-3 py-2 lg:w-auto"
			aria-label="Lieblingsgerichte bearbeiten"
		>
			<i class="fa-solid fa-heart" aria-hidden="true"></i>
			<span class="hidden lg:inline">Lieblingsgerichte</span>
			{#if favoriteCount > 0}<span>({favoriteCount})</span>{/if}
		</button>
		<button
			type="button"
			onclick={() => restaurantDialog?.showModal()}
			class="order-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded border px-3 py-2 lg:w-auto"
			aria-label="Angezeigte Restaurants konfigurieren"
		>
			<i class="fa-solid fa-sliders" aria-hidden="true"></i>
			<span class="hidden lg:inline">Restaurants</span>
			<span>({visibleRestaurants.length}/{data.restaurants.length})</span>
		</button>
		<button
			type="button"
			onclick={() => importStatusDialog?.showModal()}
			class="order-5 inline-flex size-10 items-center justify-center rounded border p-0"
			aria-label="Importstatus anzeigen"
		>
			<i class="fa-solid fa-circle-info" aria-hidden="true"></i>
		</button>
		<div
			class="order-2 col-span-3 grid grid-cols-[auto_auto] items-center gap-x-6 justify-self-center text-center lg:col-span-1 lg:justify-self-end lg:text-right"
		>
			<div class="text-xs">KW</div>
			<div class="text-xs">Datum</div>
			<div class="text-lg font-bold">{getCalendarWeek(today)}</div>
			<div class="text-lg font-bold">
				{today.toLocaleDateString('de-DE', {
					day: 'numeric',
					month: 'long'
				})}
			</div>
		</div>
	</section>
	<div class="grid min-w-0 gap-6 px-4 pb-4">
		<dialog
			bind:this={favoriteDialog}
			onclick={closeDrawerOnBackdrop}
			aria-labelledby="favorites-title"
			class="drawer fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh w-full max-w-md border-0 p-0"
		>
			<div class="flex h-full flex-col border-0 sm:border-r">
				<header class="flex items-start justify-between gap-4 border-b p-5">
					<div>
						<h2 id="favorites-title" class="text-2xl font-semibold">Lieblingsgerichte</h2>
						<p class="mt-2 text-sm">Treffer werden in den aktuellen Karten markiert.</p>
					</div>
					<button
						type="button"
						onclick={() => favoriteDialog?.close()}
						aria-label="Drawer schließen"
						class="rounded border px-3 py-2"
					>
						<i class="fa-solid fa-xmark" aria-hidden="true"></i>
					</button>
				</header>
				<div class="grid content-start gap-4 overflow-y-auto p-5">
					{#each favorites as favorite, index (index)}
						<div class="flex items-end gap-2">
							<label class="grid grow gap-1 text-sm font-medium">
								<span>Gericht {index + 1}</span>
								<input
									type="text"
									value={favorite}
									oninput={(event) => updateFavorite(index, event.currentTarget.value)}
									placeholder={getFavoritePlaceholder(index)}
									class="w-full rounded border px-2 py-3 leading-6 font-normal"
								/>
							</label>
							<button
								type="button"
								onclick={() => toggleFavoriteReminder(index)}
								aria-label={favoriteReminderEnabled[index]
									? `Erinnerung für Gericht ${index + 1} deaktivieren`
									: `Erinnerung für Gericht ${index + 1} aktivieren`}
								aria-pressed={favoriteReminderEnabled[index]}
								title={favoriteReminderEnabled[index]
									? 'Erinnerung aktiv'
									: 'Erinnerung aktivieren'}
								disabled={!favorite.trim()}
								class="rounded border px-3 py-3 leading-6 disabled:cursor-not-allowed disabled:opacity-50"
							>
								<i
									class={favoriteReminderEnabled[index] ? 'fa-solid fa-bell' : 'fa-regular fa-bell'}
									aria-hidden="true"
								></i>
							</button>
							<button
								type="button"
								onclick={() => removeFavorite(index)}
								aria-label="Gericht {index + 1} entfernen"
								class="rounded border px-3 py-3 leading-6"
							>
								<i class="fa-solid fa-trash" aria-hidden="true"></i>
							</button>
						</div>
					{/each}
					<button type="button" onclick={addFavorite} class="justify-self-start rounded border p-2">
						<i class="fa-solid fa-plus mr-2" aria-hidden="true"></i>
						Weiteres Gericht hinzufügen
					</button>
					<p class="text-sm">
						Die Favoriten werden nur in diesem Browser gespeichert. Schreibweisen mit oder ohne
						Umlaute werden beim Abgleich vereinheitlicht. Aktivierte Erinnerungen erscheinen ab 11
						Uhr bis 20 Uhr, wenn diese Seite geöffnet ist. Beim späteren Öffnen werden passende
						Hinweise noch am selben Tag nachgeholt.
					</p>
					{#if favoritesStorageWarning}
						<p class="text-sm" role="status">{favoritesStorageWarning}</p>
					{/if}
				</div>
			</div>
		</dialog>
		<dialog
			bind:this={restaurantDialog}
			onclick={closeDrawerOnBackdrop}
			aria-labelledby="restaurants-title"
			class="drawer fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh w-full max-w-md border-0 p-0"
		>
			<div class="flex h-full flex-col border-0 sm:border-r">
				<header class="flex items-start justify-between gap-4 border-b p-5">
					<div>
						<h2 id="restaurants-title" class="text-2xl font-semibold">Angezeigte Restaurants</h2>
						<p class="mt-2 text-sm">Wähle aus, welche Restaurants auf der Seite erscheinen.</p>
					</div>
					<button
						type="button"
						onclick={() => restaurantDialog?.close()}
						aria-label="Drawer schließen"
						class="rounded border px-3 py-2"
					>
						<i class="fa-solid fa-xmark" aria-hidden="true"></i>
					</button>
				</header>
				<div class="grid content-start gap-3 overflow-y-auto p-5">
					{#each data.restaurants as restaurant (restaurant.id)}
						<label class="flex items-center gap-3">
							<input
								type="checkbox"
								checked={!hiddenRestaurantIds.includes(restaurant.id)}
								onchange={(event) => toggleRestaurant(restaurant.id, event.currentTarget.checked)}
							/>
							<span>{restaurant.restaurantName}</span>
						</label>
					{/each}
					<p class="text-sm">
						Deine Auswahl wird ein Jahr lang in einem Cookie dieses Browsers gespeichert.
					</p>
				</div>
			</div>
		</dialog>
		<dialog
			bind:this={importStatusDialog}
			onclick={closeDrawerOnBackdrop}
			aria-labelledby="import-status-title"
			class="drawer fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh w-full max-w-md border-0 p-0"
		>
			<div class="flex h-full flex-col border-0 sm:border-r">
				<header class="flex items-start justify-between gap-4 border-b p-5">
					<div>
						<h2 id="import-status-title" class="text-2xl font-semibold">Importstatus</h2>
						<p class="mt-2 text-sm">
							Letzte erfolgreiche Importe und aktuelle Fehler je Restaurant.
						</p>
					</div>
					<button
						type="button"
						onclick={() => importStatusDialog?.close()}
						aria-label="Drawer schließen"
						class="rounded border px-3 py-2"
					>
						<i class="fa-solid fa-xmark" aria-hidden="true"></i>
					</button>
				</header>
				<div class="grid content-start gap-4 overflow-y-auto p-5">
					{#each data.importStatuses as status (status.sourceSlug)}
						<p class="text-sm" aria-live="polite">
							<span class="font-medium">{status.restaurantName}:</span>
							{#if status.lastError}
								Aktualisierung fehlgeschlagen. Die zuletzt erfolgreich importierten Gerichte werden
								weiterhin angezeigt; letzter erfolgreicher Import:
								{status.lastSuccessAt ? formatDateTime(status.lastSuccessAt) : 'noch keiner'}.
							{:else if status.lastSuccessAt}
								{#if isStale(status.lastSuccessAt)}
									Daten möglicherweise veraltet; letzter erfolgreicher Import:
								{:else}
									Zuletzt erfolgreich aktualisiert:
								{/if}
								{formatDateTime(status.lastSuccessAt)}.
							{:else}
								Import läuft oder wurde noch nicht erfolgreich abgeschlossen.
							{/if}
						</p>
					{:else}
						<p class="text-sm">Noch keine Importstatus vorhanden.</p>
					{/each}
				</div>
			</div>
		</dialog>
		<section class="grid min-w-0 gap-4">
			<h2 class="text-2xl">Restaurants</h2>
			{#if visibleRestaurants.length === 0}
				<p>Aktuell werden keine Restaurants angezeigt.</p>
			{:else}
				{#each visibleRestaurants as restaurant (restaurant.id)}
					{@const dailyMenus = restaurant.menus.filter((menu) => menu.menuType === 'daily')}
					{@const weeklyMenus = restaurant.menus.filter((menu) => menu.menuType === 'weekly')}
					<div class="flex min-w-0 items-start">
						<details open class="min-w-0 grow rounded-l-xl border">
							<summary class="cursor-pointer px-4 py-2 text-xl font-bold">
								{restaurant.restaurantName}
							</summary>
							<div class="grid gap-4 p-4 pt-0">
								{#if dailyMenus.length > 0}
									<section class="grid gap-4">
										<h4 class="text-lg font-semibold">Tagesgerichte</h4>
										<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
											{#each days as day (day.date)}
												<div class="flex flex-col gap-4 rounded-lg bg-gray-100/5 p-4">
													<h5 class="font-semibold capitalize">
														{day.name} <span class="font-normal">{day.label}</span>
													</h5>
													{#each dailyMenus.filter((menu) => menu.validFrom === day.date) as menu (menu.id)}
														{#each menu.items as item (item.id)}
															{@const title = withoutPrices(item.name)}
															{@const category = item.category
																? withoutPrices(item.category)
																: null}
															{@const description = withoutPrices(item.description)}
															{@const matches = matchingFavorites(
																`${item.name} ${item.category ?? ''} ${item.description}`
															)}
															<div>
																{#if category}
																	<p class="text-sm font-semibold">{category}</p>
																{/if}
																<div class="font-medium">{title}</div>
																{#if matches.length > 0}
																	<p
																		class="inline-flex items-center gap-1 rounded text-xs text-red-500"
																	>
																		<i class="fa-solid fa-heart" aria-hidden="true"></i>
																		Lieblingsgericht: {matches.join(', ')}
																	</p>
																{/if}
																{#if description}<p>{description}</p>{/if}
															</div>
														{/each}
													{:else}
														<p class="text-sm text-gray-500">Kein Tagesgericht angegeben</p>
													{/each}
												</div>
											{/each}
										</div>
									</section>
								{/if}

								{#each weeklyMenus as menu (menu.id)}
									<section class="grid gap-4">
										<div class="flex flex-wrap items-baseline justify-between gap-2">
											<h4 class="text-lg font-semibold">Wochenangebote</h4>
											<p class="inline-flex items-center gap-1 self-start text-xs">
												{formatDate(menu.validFrom)} – {formatDate(menu.validUntil)}
											</p>
										</div>
										<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
											{#each menu.items as item (item.id)}
												{@const title = withoutPrices(
													item.code ? `${item.code} – ${item.name}` : item.name
												)}
												{@const category = item.category ? withoutPrices(item.category) : null}
												{@const description = withoutPrices(item.description)}
												{@const matches = matchingFavorites(
													`${item.name} ${item.category ?? ''} ${item.description}`
												)}
												<div class="flex flex-col gap-1">
													{#if category}
														<p class="text-sm font-semibold">{category}</p>
													{/if}
													<h5 class="font-semibold">{title}</h5>
													{#if matches.length > 0}
														<p class="text-xs text-red-500">
															<i class="fa-solid fa-heart" aria-hidden="true"></i>
															Lieblingsgericht: {matches.join(', ')}
														</p>
													{/if}
													{#if description}<p>{description}</p>{/if}
												</div>
											{/each}
										</div>
									</section>
								{/each}
							</div>
						</details>
						<a
							href={restaurant.restaurantUrl}
							target="_blank"
							rel="external noreferrer"
							aria-label="Restaurantseite von {restaurant.restaurantName} öffnen"
							title="Restaurantseite von {restaurant.restaurantName} öffnen"
							class="flex h-full shrink-0 items-center rounded-r-xl border px-2 py-2"
						>
							<i class="fa-solid fa-up-right-from-square" aria-hidden="true"></i>
						</a>
					</div>
				{/each}
			{/if}
		</section>
		{#if otherRestaurants.length > 0}
			<section class="grid gap-4" aria-labelledby="other-restaurants-title">
				<h2 id="other-restaurants-title" class="text-2xl">Weitere Restaurants</h2>
				<div
					class="grid grid-cols-2 gap-0 overflow-hidden rounded-xl border sm:grid-cols-3 lg:grid-cols-4"
				>
					{#each otherRestaurants as restaurant, index (index)}
						<a
							href={restaurant.url}
							target="_blank"
							rel="external noreferrer"
							class="border-r border-b p-4"
						>
							<span>{restaurant.name}</span>
							<i class="fa-solid fa-up-right-from-square ml-2 text-sm" aria-hidden="true"></i>
						</a>
					{/each}
				</div>
			</section>
		{/if}
	</div>
</div>
