<script lang="ts">
	interface Props {
		dialog?: HTMLDialogElement | null;
		favorites: string[];
		favoriteReminderEnabled: boolean[];
		favoritesStorageWarning: string;
		getFavoritePlaceholder: (index: number) => string;
		onUpdateFavorite: (index: number, value: string) => void;
		onToggleFavoriteReminder: (index: number) => Promise<void>;
		onRemoveFavorite: (index: number) => void;
		onAddFavorite: () => void;
	}

	let {
		dialog = $bindable(null),
		favorites,
		favoriteReminderEnabled,
		favoritesStorageWarning,
		getFavoritePlaceholder,
		onUpdateFavorite,
		onToggleFavoriteReminder,
		onRemoveFavorite,
		onAddFavorite
	}: Props = $props();

	function closeOnBackdrop(event: MouseEvent) {
		if (event.target === event.currentTarget) dialog?.close();
	}
</script>

<dialog
	bind:this={dialog}
	onclick={closeOnBackdrop}
	aria-labelledby="favorites-title"
	class="drawer fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh w-full max-w-md border-0 p-0"
>
	<div class="drawer-panel flex h-full flex-col border-0 sm:border-r">
		<header class="drawer-header flex items-start justify-between gap-4 border-b p-5">
			<div>
				<h2 id="favorites-title" class="text-2xl font-semibold">Lieblingsgerichte</h2>
				<p class="mt-2 text-sm">Treffer werden in den aktuellen Karten markiert.</p>
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
		<div class="grid content-start gap-4 overflow-y-auto p-5">
			{#each favorites as favorite, index (index)}
				<div class="flex items-end gap-2">
					<label class="grid grow gap-1 text-sm font-medium">
						<span>Gericht {index + 1}</span>
						<input
							type="text"
							value={favorite}
							oninput={(event) => onUpdateFavorite(index, event.currentTarget.value)}
							placeholder={getFavoritePlaceholder(index)}
							class="ui-input w-full rounded border px-2 py-3 leading-6 font-normal"
						/>
					</label>
					<button
						type="button"
						onclick={() => onToggleFavoriteReminder(index)}
						aria-label={favoriteReminderEnabled[index]
							? `Erinnerung für Gericht ${index + 1} deaktivieren`
							: `Erinnerung für Gericht ${index + 1} aktivieren`}
						aria-pressed={favoriteReminderEnabled[index]}
						title={favoriteReminderEnabled[index] ? 'Erinnerung aktiv' : 'Erinnerung aktivieren'}
						disabled={!favorite.trim()}
						class="ui-button rounded border px-3 py-3 leading-6 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<i
							class={favoriteReminderEnabled[index] ? 'fa-solid fa-bell' : 'fa-regular fa-bell'}
							aria-hidden="true"
						></i>
					</button>
					<button
						type="button"
						onclick={() => onRemoveFavorite(index)}
						aria-label="Gericht {index + 1} entfernen"
						class="ui-button rounded border px-3 py-3 leading-6"
					>
						<i class="fa-solid fa-trash" aria-hidden="true"></i>
					</button>
				</div>
			{/each}
			<button type="button" onclick={onAddFavorite} class="ui-button w-full rounded border p-2">
				<i class="fa-solid fa-plus mr-2" aria-hidden="true"></i>
				Weiteres Gericht hinzufügen
			</button>
			<p class="text-sm">
				Die Favoriten werden nur in diesem Browser gespeichert. Schreibweisen mit oder ohne Umlaute
				werden beim Abgleich vereinheitlicht. Aktivierte Erinnerungen erscheinen ab 11 Uhr bis 20
				Uhr, wenn diese Seite geöffnet ist. Beim späteren Öffnen werden passende Hinweise noch am
				selben Tag nachgeholt.
			</p>
			{#if favoritesStorageWarning}
				<p class="text-sm" role="status">{favoritesStorageWarning}</p>
			{/if}
		</div>
	</div>
</dialog>
