<script lang="ts">
	import { resolve } from '$app/paths';

	interface Props {
		favoriteCount: number;
		visibleRestaurantCount: number;
		totalRestaurantCount: number;
		weekNumber: number;
		dateLabel: string;
		onOpenFavorites: () => void;
		onOpenRestaurants: () => void;
		onOpenInfo: () => void;
	}

	let {
		favoriteCount,
		visibleRestaurantCount,
		totalRestaurantCount,
		weekNumber,
		dateLabel,
		onOpenFavorites,
		onOpenRestaurants,
		onOpenInfo
	}: Props = $props();
</script>

<header
	class="page-header col-span-full grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 p-2 lg:flex"
>
	<h1 class="order-1 col-span-2 min-w-0 px-2 text-left text-2xl font-bold sm:text-3xl lg:grow">
		<a
			href={resolve('/')}
			data-sveltekit-reload
			class="text-inherit no-underline transition-colors hover:text-white"
			title="Zur Startseite (Aktualisieren)"
		>
			Mittagessen
		</a>
	</h1>

	<div
		class="order-2 col-span-1 grid w-full max-w-44 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-1 justify-self-end text-center sm:w-auto sm:max-w-none sm:grid-cols-[auto_auto] sm:gap-x-4 lg:mr-8 lg:justify-self-end lg:text-right"
	>
		<div class="text-xs">KW</div>
		<div class="text-xs">Datum</div>
		<div class="font-bold">{weekNumber}</div>
		<div class="min-w-0 leading-tight font-bold wrap-break-word">
			{dateLabel}
		</div>
	</div>

	<button
		type="button"
		onclick={onOpenFavorites}
		class="ui-button order-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded border px-3 py-2 lg:order-3 lg:w-auto"
		aria-label="Lieblingsgerichte bearbeiten"
	>
		<i class="fa-solid fa-heart" aria-hidden="true"></i>
		<span class="hidden sm:inline">Lieblingsgerichte</span>
		{#if favoriteCount > 0}<span>({favoriteCount})</span>{/if}
	</button>

	<button
		type="button"
		onclick={onOpenRestaurants}
		class="ui-button order-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded border px-3 py-2 lg:order-4 lg:w-auto"
		aria-label="Angezeigte Imbisse & Restaurants konfigurieren"
	>
		<i class="fa-solid fa-sliders" aria-hidden="true"></i>
		<span class="hidden sm:inline">Imbisse & Restaurants</span>
		<span>({visibleRestaurantCount}/{totalRestaurantCount})</span>
	</button>

	<button
		type="button"
		onclick={onOpenInfo}
		class="ui-button order-4 inline-flex size-10 items-center justify-center rounded border p-0 lg:order-5"
		aria-label="Informationen anzeigen"
	>
		<i class="fa-solid fa-circle-info" aria-hidden="true"></i>
	</button>
</header>
