import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { self } from '$app/service-worker';

const cacheName = `lunch-${version}`;
const homeUrl = new URL('/', self.location.origin).href;
const offlineUrl = new URL('/offline.html', self.location.origin).href;
const appShell = Array.from(
	new Set([...assets, ...immutable].map((asset) => new URL(asset.path, self.location.origin).href).concat(offlineUrl))
);

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(cacheName).then(async (cache) => {
			await cache.addAll(appShell);
			await self.skipWaiting();
		})
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.filter((key) => key.startsWith('lunch-') && key !== cacheName).map((key) => caches.delete(key))
				)
			)
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (request.method !== 'GET' || url.origin !== self.location.origin) return;

	if (request.mode === 'navigate' && url.pathname === '/') {
		event.respondWith(
			fetch(request)
				.then(async (response) => {
					if (response.ok) {
						const cache = await caches.open(cacheName);
						await cache.put(homeUrl, response.clone());
					}
					return response;
				})
				.catch(async () => {
					const cachedHome = await caches.match(homeUrl);
					if (cachedHome) return cachedHome;

					return (await caches.match(offlineUrl)) ?? Response.error();
				})
		);
		return;
	}

	if (appShell.includes(request.url)) {
		event.respondWith(
			caches.match(request).then((cached) => cached ?? fetch(request))
		);
	}
});
