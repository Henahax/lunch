<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteDate } from 'svelte/reactivity';
	import type { PageProps } from './$types';

	const favoritesStorageKey = 'lunch.favorite-dishes.v1';

	let { data }: PageProps = $props();
	let favoriteDialog = $state<HTMLDialogElement | null>(null);
	let favorites = $state(['']);
	let favoritesStorageWarning = $state('');
	const favoriteCount = $derived(favorites.filter((favorite) => favorite.trim()).length);
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
		return [...new Set(favorites.map((favorite) => favorite.trim()).filter(Boolean))].filter(
			(favorite) => {
				const normalizedFavorite = normalizeForSearch(favorite);
				return normalizedFavorite.length > 0 && normalizedValue.includes(normalizedFavorite);
			}
		);
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

	function updateFavorite(index: number, value: string) {
		favorites[index] = value;
		persistFavorites();
	}

	function addFavorite() {
		favorites.push('');
	}

	function removeFavorite(index: number) {
		favorites = favorites.filter((_, favoriteIndex) => favoriteIndex !== index);
		if (favorites.length === 0) favorites = [''];
		persistFavorites();
	}

	function closeDrawerOnBackdrop(event: MouseEvent) {
		if (event.target === favoriteDialog) favoriteDialog?.close();
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

	onMount(() => {
		try {
			const storedFavorites = localStorage.getItem(favoritesStorageKey);
			if (!storedFavorites) return;
			const parsed: unknown = JSON.parse(storedFavorites);
			if (Array.isArray(parsed)) {
				const savedFavorites = parsed.filter(
					(favorite): favorite is string => typeof favorite === 'string'
				);
				favorites = savedFavorites.length > 0 ? savedFavorites : [''];
			}
		} catch {
			favoritesStorageWarning = 'Favoriten konnten aus diesem Browser nicht geladen werden.';
		}
	});
</script>

<div class="mx-auto grid w-full max-w-screen-2xl min-w-0 gap-6 p-4">
	<section
		class="col-span-full grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex"
	>
		<h1 class="col-span-2 text-4xl sm:grow">Mittagessen Beta</h1>
		<button
			type="button"
			onclick={() => favoriteDialog?.showModal()}
			class="inline-flex items-center gap-2 rounded border px-3 py-2"
			aria-label="Lieblingsgerichte bearbeiten"
		>
			<i class="fa-solid fa-heart" aria-hidden="true"></i>
			<span class="hidden sm:inline">Lieblingsgerichte</span>
			{#if favoriteCount > 0}<span>({favoriteCount})</span>{/if}
		</button>
		<div class="grid grid-cols-[auto_auto] items-center gap-x-6 justify-self-end text-center">
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
	<dialog
		bind:this={favoriteDialog}
		onclick={closeDrawerOnBackdrop}
		aria-labelledby="favorites-title"
		class="drawer fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh w-full max-w-md border-0 p-0"
	>
		<div class="flex h-full flex-col border-r">
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
								placeholder="z. B. Ente"
								class="w-full rounded border px-2 py-3 leading-6 font-normal"
							/>
						</label>
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
					Umlaute werden beim Abgleich vereinheitlicht.
				</p>
				{#if favoritesStorageWarning}
					<p class="text-sm" role="status">{favoritesStorageWarning}</p>
				{/if}
			</div>
		</div>
	</dialog>
	<section class="grid min-w-0 gap-4">
		<h2 class="text-2xl">Restaurants</h2>
		{#if data.restaurants.length === 0}
			<p>Für diese Woche sind noch keine Menüs importiert.</p>
		{:else}
			{#each data.restaurants as restaurant (restaurant.id)}
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
														{@const title = withoutPrices(item.category ?? item.name)}
														{@const description = withoutPrices(item.description)}
														{@const matches = matchingFavorites(
															`${item.name} ${item.category ?? ''} ${item.description}`
														)}
														<div>
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
		{#if data.importStatuses.length > 0}
			<section class="grid gap-2" aria-label="Importstatus">
				{#each data.importStatuses as status (status.sourceSlug)}
					<p class="text-sm" aria-live="polite">
						<span class="font-medium">{status.restaurantName}:</span>
						{#if status.lastError}
							Import fehlgeschlagen. Letzter erfolgreicher Import:
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
				{/each}
			</section>
		{/if}
	</section>
</div>
