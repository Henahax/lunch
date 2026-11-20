<script lang="ts">
	import type { RestaurantImportStatus } from '#lib/types.js';

	interface Props {
		dialog?: HTMLDialogElement | null;
		statuses: RestaurantImportStatus[];
		currentMenuSlugs: string[];
		formatDateTime: (timestamp: number) => string;
		isStale: (timestamp: number) => boolean;
	}

	let {
		dialog = $bindable(null),
		statuses,
		currentMenuSlugs,
		formatDateTime,
		isStale
	}: Props = $props();

	function closeOnBackdrop(event: MouseEvent) {
		if (event.target === event.currentTarget) dialog?.close();
	}
</script>

<dialog
	bind:this={dialog}
	onclick={closeOnBackdrop}
	aria-labelledby="info-title"
	class="drawer fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh w-full max-w-md border-0 p-0"
>
	<div class="drawer-panel flex h-full flex-col border-0 sm:border-r">
		<header class="drawer-header flex items-start justify-between gap-4 border-b p-5">
			<div>
				<h2 id="info-title" class="text-2xl font-semibold">Informationen</h2>
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
		<div class="grid content-start gap-6 overflow-y-auto p-5">
			<section class="grid gap-3" aria-labelledby="app-help-title">
				<h3 id="app-help-title" class="text-lg font-semibold">So funktioniert die Seite</h3>
				<ul class="list-disc space-y-2 pl-5">
					<li>Tages- und Wochenangebote ansehen, Links zu Originalseiten.</li>
					<li>Lieblingsgerichte markieren und erinnern lassen.</li>
					<li>Restaurants einblenden und sortieren.</li>
					<li>Wünsche und Feedback gerne an Tobias richten.</li>
				</ul>
			</section>

			<section class="grid gap-2" aria-labelledby="import-status-title">
				<h3 id="import-status-title" class="text-sm font-semibold">Importstatus</h3>
				{#each statuses as status (status.sourceSlug)}
					<p class="text-xs opacity-60">
						<span class="font-medium">{status.restaurantName}:</span>
						{#if status.lastError}
							Import fehlgeschlagen; {#if currentMenuSlugs.includes(status.sourceSlug)}letzter Stand{:else}keine
								Karte{/if}.
							{#if status.lastSuccessAt}Zuletzt erfolgreich: {formatDateTime(
									status.lastSuccessAt
								)}.{/if}
						{:else if status.lastSuccessAt}
							{#if isStale(status.lastSuccessAt)}
								Möglicherweise veraltet; zuletzt:
							{:else}
								Aktualisiert:
							{/if}
							{formatDateTime(status.lastSuccessAt)}.
						{:else}
							Noch kein erfolgreicher Import.
						{/if}
					</p>
				{:else}
					<p class="text-xs">Noch keine Importstatus vorhanden.</p>
				{/each}
			</section>
		</div>
	</div>
</dialog>
