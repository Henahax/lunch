export type MenuItem = {
	id: string;
	code: string;
	category: string | null;
	name: string;
	description: string;
};

export type RestaurantMenu = {
	id: string;
	menuType: 'daily' | 'weekly';
	validFrom: string;
	validUntil: string;
	items: MenuItem[];
};

export type Restaurant = {
	id: string;
	slug: string;
	restaurantName: string;
	restaurantUrl: string;
	menus: RestaurantMenu[];
};

export type RestaurantImportStatus = {
	sourceSlug: string;
	restaurantName: string;
	sourceUrl: string;
	lastAttemptAt: number;
	lastSuccessAt: number | null;
	lastError: string | null;
	menuCount: number | null;
	itemCount: number | null;
};

export type RestaurantDay = {
	date: string;
	name: string;
	label: string;
};

export type OtherRestaurant = {
	name: string;
	url: string;
};
