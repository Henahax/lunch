<script lang="ts">
	import type { OtherRestaurant } from '#lib/types.js';

	interface Props {
		restaurants: OtherRestaurant[];
		isOpen: boolean;
		onToggle: (open: boolean, userInitiated: boolean) => void;
	}

	let { restaurants, isOpen, onToggle }: Props = $props();
	let userInitiatedToggle = false;
</script>

{#if restaurants.length > 0}
	<details
		open={isOpen}
		ontoggle={(event) => {
			const userInitiated = userInitiatedToggle;
			userInitiatedToggle = false;
			onToggle(event.currentTarget.open, userInitiated);
		}}
		class="restaurant-card relative min-w-0 rounded-lg border"
	>
		<summary
			onclick={() => (userInitiatedToggle = true)}
			class="restaurant-card__summary flex cursor-pointer items-center gap-1 px-2 py-1 text-xl font-bold"
		>
			<h2 id="other-restaurants-title" class="inline">Weitere Restaurants</h2>
		</summary>
		<div class="restaurant-card__content grid gap-2 p-2 pt-0">
			<nav
				aria-labelledby="other-restaurants-title"
				class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,10rem),1fr))] gap-1 overflow-hidden rounded"
			>
				{#each restaurants.toSorted( (a, b) => a.name.localeCompare(b.name) ) as restaurant (restaurant.url)}
					<a
						href={restaurant.url}
						target="_blank"
						rel="external noreferrer"
						class="ui-button grid grid-cols-[1fr_auto] items-center justify-center gap-x-2 rounded-lg border px-2 py-1"
					>
						<span class="self-end text-sm">{restaurant.name}</span>
						<i class="fa-solid fa-up-right-from-square row-span-2 text-xs"></i>
						<span class="menu-item__description self-start text-xs">{restaurant.description}</span>
					</a>
				{/each}
			</nav>
		</div>
	</details>
{/if}
