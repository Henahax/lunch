<script lang="ts">
	import type { Restaurant } from '#lib/types.js';

	interface Props {
		dialog?: HTMLDialogElement | null;
		orderedRestaurants: Restaurant[];
		hiddenRestaurantIds: string[];
		onToggleRestaurant: (id: string, visible: boolean) => void;
		onMoveRestaurant: (sourceSlug: string, targetSlug: string) => void;
		onMoveRestaurantBy: (slug: string, offset: number) => void;
	}

	let {
		dialog = $bindable(null),
		orderedRestaurants,
		hiddenRestaurantIds,
		onToggleRestaurant,
		onMoveRestaurant,
		onMoveRestaurantBy
	}: Props = $props();
	let draggingRestaurantSlug = $state<string | null>(null);

	function closeOnBackdrop(event: MouseEvent) {
		if (event.target === event.currentTarget) dialog?.close();
	}

	function startRestaurantDrag(event: DragEvent, slug: string) {
		draggingRestaurantSlug = slug;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', slug);
		}
	}

	function dropRestaurant(event: DragEvent, targetSlug: string) {
		event.preventDefault();
		const sourceSlug = event.dataTransfer?.getData('text/plain') || draggingRestaurantSlug;
		if (sourceSlug) onMoveRestaurant(sourceSlug, targetSlug);
		draggingRestaurantSlug = null;
	}
</script>

<dialog
	bind:this={dialog}
	onclick={closeOnBackdrop}
	aria-labelledby="restaurants-title"
	class="drawer fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh w-full max-w-md border-0 p-0"
>
	<div class="drawer-panel flex h-full flex-col border-0 sm:border-r">
		<header class="drawer-header flex items-start justify-between gap-4 border-b p-5">
			<div>
				<h2 id="restaurants-title" class="text-2xl font-semibold">Angezeigte Restaurants</h2>
				<p class="mt-2 text-sm">
					Ziehe Restaurants zum Sortieren oder nutze die Pfeile. Mit dem Häkchen blendest du sie auf
					der Hauptseite ein oder aus.
				</p>
			</div>
			<button
				type="button"
				onclick={() => dialog?.close()}
				aria-label="Drawer schließen"
				class="ui-button rounded border px-3 py-2"
			>
				<i class="fa-solid fa-xmark" aria-hidden="true"></i>
			</button>
		</header>
		<div class="grid content-start gap-3 overflow-y-auto p-5">
			<ol class="grid gap-2" aria-label="Restaurantreihenfolge">
				{#each orderedRestaurants as restaurant, index (restaurant.id)}
					<li
						draggable="true"
						ondragstart={(event) => startRestaurantDrag(event, restaurant.slug)}
						ondragover={(event) => event.preventDefault()}
						ondrop={(event) => dropRestaurant(event, restaurant.slug)}
						ondragend={() => (draggingRestaurantSlug = null)}
						class="restaurant-sort-row flex items-center gap-2 rounded border p-2"
					>
						<i class="fa-solid fa-grip-vertical cursor-grab px-1" aria-hidden="true"></i>
						<label class="flex min-w-0 grow items-center gap-3">
							<input
								type="checkbox"
								checked={!hiddenRestaurantIds.includes(restaurant.id)}
								onchange={(event) => onToggleRestaurant(restaurant.id, event.currentTarget.checked)}
							/>
							<span class="truncate">{restaurant.restaurantName}</span>
						</label>
						<button
							type="button"
							onclick={() => onMoveRestaurantBy(restaurant.slug, -1)}
							aria-label="{restaurant.restaurantName} nach oben verschieben"
							disabled={index === 0}
							class="ui-button rounded border px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
						>
							<i class="fa-solid fa-chevron-up" aria-hidden="true"></i>
						</button>
						<button
							type="button"
							onclick={() => onMoveRestaurantBy(restaurant.slug, 1)}
							aria-label="{restaurant.restaurantName} nach unten verschieben"
							disabled={index === orderedRestaurants.length - 1}
							class="ui-button rounded border px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
						>
							<i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
						</button>
					</li>
				{/each}
			</ol>
			<p class="text-sm">
				Reihenfolge und Sichtbarkeit werden ein Jahr lang in Cookies dieses Browsers gespeichert.
			</p>
		</div>
	</div>
</dialog>
