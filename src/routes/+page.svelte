<script lang="ts">
	const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];

	const restaurants = [
		{
			name: 'Restaurant 1',
			meals: ['Meal 1', 'Meal 2', 'Meal 3', 'Meal 4', 'Meal 5']
		},
		{
			name: 'Restaurant 2',
			meals: ['Meal 1', 'Meal 2', 'Meal 3', 'Meal 4', 'Meal 5']
		},
		{
			name: 'Restaurant 3',
			meals: ['Meal 1', 'Meal 2', 'Meal 3', 'Meal 4', 'Meal 5']
		}
	];
</script>

<h1>Mittag</h1>

<!-- Idea, do actual row and subgrid, do KW and daily blocks -->

<div class="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_auto] gap-4">
	<div>Restaurant</div>
	<div class="col-span-5">KW X</div>
	<div></div>

	<div>Restaurant 0</div>
	<div class="col-span-5">Meal 0</div>
	<div>Link</div>

	<div>Restaurant</div>
	{#each days as day (day)}
		<div>{day}</div>
	{/each}
	<div></div>

	{#each restaurants as restaurant (restaurant.name)}
		<div>{restaurant.name}</div>
		{#each restaurant.meals as meal (meal)}
			<div>{meal}</div>
		{/each}
		<div>Link</div>
	{/each}
</div>
