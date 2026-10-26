<script lang="ts">
	import { SvelteDate } from 'svelte/reactivity';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
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

	function formatDateTime(timestamp: number): string {
		return new SvelteDate(timestamp).toLocaleString('de-DE', {
			day: 'numeric',
			month: 'long',
			hour: '2-digit',
			minute: '2-digit',
			timeZone: 'Europe/Berlin'
		});
	}

	function isStale(timestamp: number): boolean {
		return Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000;
	}
</script>

<div class="mx-auto grid max-w-screen-2xl gap-6 p-4">
	<section class="col-span-full flex">
		<h1 class="grow text-4xl">Mittagessen Beta</h1>
		<div class="grid grid-cols-[auto_auto] items-center gap-x-6 text-center">
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
	<section class="grid gap-4">
		<h2 class="text-2xl">Restaurants</h2>
		{#if data.restaurants.length === 0}
			<p>Für diese Woche sind noch keine Menüs importiert.</p>
		{:else}
			{#each data.restaurants as restaurant (restaurant.id)}
				{@const dailyMenus = restaurant.menus.filter((menu) => menu.menuType === 'daily')}
				{@const weeklyMenus = restaurant.menus.filter((menu) => menu.menuType === 'weekly')}
				<article class="grid gap-4 rounded border p-4">
					<header class="flex items-center justify-between gap-4">
						<h3 class="text-xl font-bold">{restaurant.restaurantName}</h3>
						<a
							href={restaurant.restaurantUrl}
							target="_blank"
							rel="external noreferrer"
							aria-label="Restaurantseite öffnen"
							class="shrink-0"
						>
							<i class="fa-solid fa-up-right-from-square" aria-hidden="true"></i>
						</a>
					</header>

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
												<div>
													<div class="font-medium">{item.category ?? item.name}</div>
													<p>{item.description}</p>
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
								<p class="text-sm">{formatDate(menu.validFrom)} – {formatDate(menu.validUntil)}</p>
							</div>
							<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
								{#each menu.items as item (item.id)}
									<div class="flex flex-col gap-1">
										{#if item.category}
											<p class="text-sm font-semibold">{item.category}</p>
										{/if}
										<h5 class="font-semibold">{item.code ? `${item.code} – ` : ''}{item.name}</h5>
										<p>{item.description}</p>
									</div>
								{/each}
							</div>
						</section>
					{/each}
				</article>
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
