<script lang="ts">
	import { onMount } from 'svelte';
	import type { Restaurant, RestaurantDay } from '#lib/types.js';

	interface Props {
		restaurant: Restaurant;
		days: RestaurantDay[];
		todayDate: string;
		isStale: boolean;
		isOpen: boolean;
		withoutPrices: (value: string) => string;
		matchingFavorites: (value: string) => string[];
	}

	let { restaurant, days, todayDate, isStale, isOpen, withoutPrices, matchingFavorites }: Props =
		$props();
	const dailyMenus = $derived(restaurant.menus.filter((menu) => menu.menuType === 'daily'));
	const hasCurrentDay = $derived(!isStale && days.some((day) => day.date === todayDate));
	let dailyCarousel = $state<HTMLDivElement | null>(null);
	let canScrollBackward = $state(false);
	let canScrollForward = $state(false);

	function updateScrollButtons() {
		if (!dailyCarousel) return;
		const maxScrollLeft = dailyCarousel.scrollWidth - dailyCarousel.clientWidth;
		canScrollBackward = dailyCarousel.scrollLeft > 1;
		canScrollForward = maxScrollLeft - dailyCarousel.scrollLeft > 1;
	}

	function scrollToToday() {
		if (!dailyCarousel) return;
		const today = dailyCarousel.querySelector<HTMLElement>('.menu-day--today');
		if (!today) return;

		const containerRect = dailyCarousel.getBoundingClientRect();
		const todayRect = today.getBoundingClientRect();
		const centeredScrollLeft =
			dailyCarousel.scrollLeft +
			todayRect.left -
			containerRect.left -
			(dailyCarousel.clientWidth - today.clientWidth) / 2;
		const maxScrollLeft = dailyCarousel.scrollWidth - dailyCarousel.clientWidth;
		dailyCarousel.scrollLeft = Math.max(0, Math.min(centeredScrollLeft, maxScrollLeft));
		updateScrollButtons();
	}

	function scrollDays(direction: -1 | 1) {
		if (!dailyCarousel) return;
		dailyCarousel.scrollBy({
			left: direction * dailyCarousel.clientWidth * 0.9,
			behavior: 'smooth'
		});
	}

	onMount(() => {
		if (!dailyCarousel) return;
		const observer = new ResizeObserver(updateScrollButtons);
		observer.observe(dailyCarousel);
		updateScrollButtons();
		return () => observer.disconnect();
	});

	$effect(() => {
		if (isOpen && hasCurrentDay && dailyCarousel) {
			requestAnimationFrame(scrollToToday);
		}
	});
</script>

{#if dailyMenus.length > 0}
	<section class="grid gap-1">
		<div class="flex items-center gap-2 px-1">
			<h4 class="menu-section-title text-lg font-semibold">Tagesgerichte</h4>
			{#if isStale}<span class="stale-menu-age">Vorwoche</span>{/if}
		</div>
		<div class="relative min-w-0">
			<div
				bind:this={dailyCarousel}
				id="daily-menu-carousel-{restaurant.slug}"
				role="region"
				aria-label="Tagesgerichte nach Wochentag"
				onscroll={updateScrollButtons}
				class="daily-menu-carousel grid min-w-0 snap-x snap-mandatory auto-cols-[90%] grid-flow-col gap-1.5 overflow-x-auto overscroll-x-contain sm:snap-none sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-2 sm:overflow-visible lg:grid-cols-5"
			>
				{#each days as day (day.date)}
					<div
						class="menu-card menu-day flex min-w-0 snap-center flex-col gap-4 rounded-lg px-3 py-1.5 sm:snap-none"
						class:menu-day--today={!isStale && day.date === todayDate}
						class:opacity-60={day.date !== todayDate}
					>
						<h5
							class="menu-day__title font-semibold capitalize"
							aria-current={!isStale && day.date === todayDate ? 'date' : undefined}
						>
							{day.name}
							<span class="font-normal" class:stale-menu-date={isStale}>{day.label}</span>
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
			<div
				class="pointer-events-none absolute -inset-x-2 top-1/2 z-10 h-9 -translate-y-1/2 sm:hidden"
			>
				<button
					type="button"
					onclick={() => scrollDays(-1)}
					disabled={!canScrollBackward}
					class="carousel-chevron pointer-events-auto absolute top-0 left-0 inline-flex size-9 items-center justify-center"
					class:carousel-chevron--hidden={!canScrollBackward}
					aria-label="Vorheriger Tag"
					aria-controls="daily-menu-carousel-{restaurant.slug}"
					title="Vorheriger Tag"
				>
					<i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
				</button>
				<button
					type="button"
					onclick={() => scrollDays(1)}
					disabled={!canScrollForward}
					class="carousel-chevron pointer-events-auto absolute top-0 right-0 inline-flex size-9 items-center justify-center"
					class:carousel-chevron--hidden={!canScrollForward}
					aria-label="Nächster Tag"
					aria-controls="daily-menu-carousel-{restaurant.slug}"
					title="Nächster Tag"
				>
					<i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
				</button>
			</div>
		</div>
	</section>
{/if}
