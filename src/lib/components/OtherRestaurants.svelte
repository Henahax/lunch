<script lang="ts">
	import type { OtherRestaurant } from '#lib/types.js';

	interface Props {
		restaurants: OtherRestaurant[];
	}

	let { restaurants }: Props = $props();
</script>

{#if restaurants.length > 0}
	<section class="grid gap-2" aria-labelledby="other-restaurants-title">
		<h2 id="other-restaurants-title" class="px-1 text-xl">Weitere Restaurants</h2>
		<nav class="grid grid-cols-2 gap-2 overflow-hidden rounded sm:grid-cols-3 lg:grid-cols-5">
			{#each restaurants as restaurant (restaurant.url)}
				<a
					href={restaurant.url}
					target="_blank"
					rel="external noreferrer"
					class="ui-button grid grid-cols-[1fr_auto] items-center justify-center gap-x-2 rounded border px-3 py-2"
				>
					<span class="self-end text-sm">{restaurant.name}</span>
					<i class="fa-solid fa-up-right-from-square row-span-2 text-sm"></i>
					<span class="menu-item__description self-start text-xs">{restaurant.description}</span>
				</a>
			{/each}
		</nav>
	</section>
{/if}
