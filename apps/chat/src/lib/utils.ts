export const formatRelativeTime = (timestamp: number) => {
	const now = new Date();
	const date = new Date(timestamp);
	const diff = now.getTime() - timestamp;
	const days = Math.floor(diff / (1000 * 60 * 60 * 24));

	// Within the same day, show time only
	if (days === 0) {
		return date
			.toLocaleTimeString([], {
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
			})
			.toLowerCase();
	}

	// Yesterday or older, show day and time
	if (days === 1) {
		return `Yesterday ${date
			.toLocaleTimeString([], {
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
			})
			.toLowerCase()}`;
	}

	if (days <= 7) {
		return `${date.toLocaleDateString([], { weekday: "short" })} ${date
			.toLocaleTimeString([], {
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
			})
			.toLowerCase()}`;
	}

	// Older than a week, show full date and time
	return `${date.toLocaleDateString([], {
		month: "short",
		day: "numeric",
	})} ${date
		.toLocaleTimeString([], {
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		})
		.toLowerCase()}`;
};
