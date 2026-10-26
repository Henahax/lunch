<script lang="ts">
	import { SvelteDate } from 'svelte/reactivity';

	const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];

	function getCalendarWeek(date: Date): number {
		const d = new SvelteDate(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

		d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));

		const yearStart = new SvelteDate(Date.UTC(d.getUTCFullYear(), 0, 1));

		return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
	}

	const today = new SvelteDate();
</script>

<div class="mx-auto grid max-w-screen-2xl grid-cols-[auto_1fr_1fr_1fr_1fr_1fr] gap-4">
	<section class="col-span-full flex">
		<h1 class="grow text-4xl">Mittag</h1>
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
	<section class="col-span-full grid grid-cols-subgrid">
		<div class="col-span-full text-2xl">Tageskarten</div>
		<div class="col-span-full grid grid-cols-subgrid font-bold">
			<div></div>
			{#each days as day (day)}
				<div>{day}</div>
			{/each}
		</div>
		<div class="col-span-full grid grid-cols-subgrid">
			<!-- foreach Reastaurants -->
			<div class="col-span-full grid grid-cols-subgrid border">
				<div class="col-span-full border p-2 text-lg font-bold">Restaurant 1</div>
				<a
					href="http://example.com"
					title="Open Restaurant Page"
					class="flex items-center justify-center rounded border p-4"
				>
					<i class="fa-solid fa-up-right-from-square"></i>
				</a>
				{#each days as day (day)}
					<div class="flex flex-col gap-4">
						<!-- foreach daily Meals -->
						<div>
							<div>Name</div>
							<div>Description</div>
						</div>
						<div>
							<div>Name</div>
							<div>Description</div>
						</div>
						<div>
							<div>Name</div>
							<div>Description</div>
						</div>
						<!-- foreach daily Meals end -->
					</div>
				{/each}
			</div>
			<!-- foreach Reastaurants end -->
		</div>
	</section>

	<section class="col-span-full grid grid-cols-subgrid">
		<div class="col-span-full text-2xl">Wochenkarten</div>
		<div class="col-span-full grid grid-cols-subgrid">
			<!-- foreach Reastaurants -->
			<div class="col-span-full grid grid-cols-subgrid border">
				<div class="col-span-full border p-2 text-lg font-bold">Restaurant 1</div>
				<a
					href="http://example.com"
					title="Open Restaurant Page"
					class="flex items-center justify-center rounded border p-4"
				>
					<i class="fa-solid fa-up-right-from-square"></i>
				</a>

				<div class="col-span-5 flex gap-4">
					<!-- foreach weekly Meals -->
					<div>
						<div>Name</div>
						<div>Description</div>
					</div>
					<div>
						<div>Name</div>
						<div>Description</div>
					</div>
					<div>
						<div>Name</div>
						<div>Description</div>
					</div>
					<!-- foreach weekly Meals end -->
				</div>
			</div>
			<!-- foreach Reastaurants end -->
		</div>
	</section>
</div>

<style>
	details {
		cursor: pointer;
	}
</style>
