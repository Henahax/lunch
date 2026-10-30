<script lang="ts">
	import type { Restaurant, RestaurantDay } from '#lib/types.js';

	interface Props {
		restaurant: Restaurant;
		days: RestaurantDay[];
		todayDate: string;
		formatDate: (date: string) => string;
		withoutPrices: (value: string) => string;
		matchingFavorites: (value: string) => string[];
		isOpen?: boolean;
		onToggle?: (slug: string, open: boolean) => void;
	}

	let {
		restaurant,
		days,
		todayDate,
		formatDate,
		withoutPrices,
		matchingFavorites,
		isOpen = true,
		onToggle
	}: Props = $props();
	const dailyMenus = $derived(restaurant.menus.filter((menu) => menu.menuType === 'daily'));
	const weeklyMenus = $derived(restaurant.menus.filter((menu) => menu.menuType === 'weekly'));
</script>

<details
	open={isOpen}
	ontoggle={(event) => onToggle?.(restaurant.slug, event.currentTarget.open)}
	class="restaurant-card relative min-w-0 rounded border"
>
	<summary
		class="restaurant-card__summary flex cursor-pointer items-center gap-1 px-2 py-1 pr-12 text-xl font-bold"
	>
		<h3 class="inline">{restaurant.restaurantName}</h3>
	</summary>
	<a
		href={restaurant.restaurantUrl}
		target="_blank"
		rel="external noreferrer"
		aria-label="Restaurantseite von {restaurant.restaurantName} öffnen"
		title="Restaurantseite von {restaurant.restaurantName} öffnen"
		class="ui-button restaurant-card__external-link absolute top-1 right-1 inline-flex size-8 items-center justify-center rounded border text-sm"
	>
		<i class="fa-solid fa-up-right-from-square" aria-hidden="true"></i>
	</a>
	<div class="restaurant-card__content grid gap-4 p-2 pt-0">
		{#if dailyMenus.length > 0}
			<section class="grid gap-2">
				<h4 class="menu-section-title px-1 text-lg font-semibold">Tagesgerichte</h4>
				<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
					{#each days as day (day.date)}
						<div
							class="menu-card menu-day flex flex-col gap-4 rounded-lg px-3 py-2"
							class:menu-day--today={day.date === todayDate}
						>
							<h5
								class="menu-day__title font-semibold capitalize"
								aria-current={day.date === todayDate ? 'date' : undefined}
							>
								{day.name} <span class="font-normal">{day.label}</span>
							</h5>
							{#each dailyMenus.filter((menu) => menu.validFrom === day.date) as menu (menu.id)}
								{#each menu.items as item (item.id)}
									{@const title = withoutPrices(item.name)}
									{@const category = item.category ? withoutPrices(item.category) : null}
									{@const description = withoutPrices(item.description)}
									{@const matches = matchingFavorites(
										`${item.name} ${item.category ?? ''} ${item.description}`
									)}
									<div
										class="menu-item menu-item--daily"
										class:menu-item--favorite={matches.length > 0}
									>
										{#if category}<p class="menu-item__category text-sm font-semibold">
												{category}
											</p>{/if}
										<div class="menu-item__name font-medium">{title}</div>
										{#if matches.length > 0}
											<p class="menu-item__favorite inline-flex items-center gap-1 rounded text-xs">
												<i class="fa-solid fa-heart" aria-hidden="true"></i>
												Lieblingsgericht: {matches.join(', ')}
											</p>
										{/if}
										{#if description}<p class="menu-item__description text-xs">
												{description}
											</p>{/if}
									</div>
								{/each}
							{:else}
								<p class="menu-item__empty text-sm">Kein Tagesgericht angegeben</p>
							{/each}
						</div>
					{/each}
				</div>
			</section>
		{/if}

		{#each weeklyMenus as menu (menu.id)}
			<section class="grid gap-2">
				<div class="flex flex-wrap items-baseline justify-between gap-2 px-1">
					<h4 class="menu-section-title text-lg font-semibold">Wochenangebote</h4>
					<p class="menu-period inline-flex items-center gap-1 self-start text-xs">
						{formatDate(menu.validFrom)} – {formatDate(menu.validUntil)}
					</p>
				</div>
				<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
					{#each menu.items as item (item.id)}
						{@const title = withoutPrices(item.code ? `${item.code} – ${item.name}` : item.name)}
						{@const category = item.category ? withoutPrices(item.category) : null}
						{@const description = withoutPrices(item.description)}
						{@const matches = matchingFavorites(
							`${item.name} ${item.category ?? ''} ${item.description}`
						)}
						<div
							class="menu-card menu-item menu-item--weekly flex flex-col rounded px-3 py-2"
							class:menu-item--favorite={matches.length > 0}
						>
							{#if category}<p class="menu-item__category text-sm font-semibold">{category}</p>{/if}
							<h5 class="menu-item__name font-semibold">{title}</h5>
							{#if matches.length > 0}
								<p class="menu-item__favorite text-xs">
									<i class="fa-solid fa-heart" aria-hidden="true"></i>
									Lieblingsgericht: {matches.join(', ')}
								</p>
							{/if}
							{#if description}<p class="menu-item__description text-xs">{description}</p>{/if}
						</div>
					{/each}
				</div>
			</section>
		{/each}
	</div>
</details>
