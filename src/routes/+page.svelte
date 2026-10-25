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

<!-- Idea, do actual row and subgrid-->

<div class="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr] gap-4">
	<div>Restaurant</div>
	<div class="col-span-5">KW X</div>

	<div>Restaurant 0</div>
	<div class="col-span-5">Meal 0</div>

	<div>Restaurant</div>
	{#each days as day}
		<div>{day}</div>
	{/each}

	{#each restaurants as restaurant}
		<div>{restaurant.name}</div>
		{#each restaurant.meals as meal}
			<div>{meal}</div>
		{/each}
	{/each}
</div>
