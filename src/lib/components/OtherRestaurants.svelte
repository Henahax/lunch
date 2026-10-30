<script lang="ts">
	import type { OtherRestaurant } from '#lib/types.js';

	interface Props {
		restaurants: OtherRestaurant[];
	}

	let { restaurants }: Props = $props();
</script>

{#if restaurants.length > 0}
	<section class="grid gap-2" aria-labelledby="other-restaurants-title">
		<h2 id="other-restaurants-title" class="px-2 text-2xl">Weitere Restaurants</h2>
		<nav
			class="other-restaurants-grid grid grid-cols-2 gap-0 overflow-hidden rounded-xl border sm:grid-cols-4 lg:grid-cols-5"
		>
			{#each restaurants as restaurant (restaurant.url)}
				<a
					href={restaurant.url}
					target="_blank"
					rel="external noreferrer"
					class="other-restaurants-link border-r border-b p-4"
				>
					<span>{restaurant.name}</span>
					<i class="fa-solid fa-up-right-from-square ml-2 text-sm" aria-hidden="true"></i>
				</a>
			{/each}
		</nav>
	</section>
{/if}
