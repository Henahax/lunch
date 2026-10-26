import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: { description: 'The database connection string.' },
	CRON_SECRET: {
		description: 'The bearer token required to trigger scheduled imports.',
		schema: (value) => value
	}
});
