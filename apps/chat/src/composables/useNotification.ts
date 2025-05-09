import { readonly, ref } from "vue";

export type NotificationType = "success" | "error" | "info" | "warning";

export interface Notification {
	id: string;
	type: NotificationType;
	message: string;
	title?: string;
	duration?: number;
	closeable?: boolean;
	onClick?: () => void;
}

const notifications = ref<Notification[]>([]);

export function useNotification() {
	const show = (notification: Omit<Notification, "id">) => {
		const id = Math.random().toString(36).substring(2, 9);
		const newNotification = {
			id,
			duration: 5000, // Default duration of 5 seconds
			...notification,
		};

		notifications.value.push(newNotification);

		if (newNotification.duration === Number.POSITIVE_INFINITY) {
			return id;
		}

		if (newNotification.duration > 0) {
			setTimeout(() => {
				remove(id);
			}, newNotification.duration);
		}

		return id;
	};

	const remove = (id: string) => {
		const index = notifications.value.findIndex((n) => n.id === id);
		if (index > -1) {
			notifications.value.splice(index, 1);
		}
	};

	const clear = () => {
		notifications.value = [];
	};

	// Convenience methods for different notification types
	const success = (
		message: string,
		options?: Partial<Omit<Notification, "id" | "type" | "message">>
	) => {
		return show({ type: "success", message, ...options });
	};

	const error = (
		message: string,
		options?: Partial<Omit<Notification, "id" | "type" | "message">>
	) => {
		return show({ type: "error", message, ...options });
	};

	const info = (
		message: string,
		options?: Partial<Omit<Notification, "id" | "type" | "message">>
	) => {
		return show({ type: "info", message, ...options });
	};

	const warning = (
		message: string,
		options?: Partial<Omit<Notification, "id" | "type" | "message">>
	) => {
		return show({ type: "warning", message, ...options });
	};

	return {
		notifications: readonly(notifications),
		show,
		remove,
		clear,
		success,
		error,
		info,
		warning,
	};
}
