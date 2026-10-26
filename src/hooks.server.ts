import { startImportScheduler } from './lib/server/restaurants/scheduler';

export function init() {
	startImportScheduler();
}
