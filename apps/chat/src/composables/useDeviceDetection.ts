import { onMounted, onUnmounted, ref } from "vue";

export function useDeviceDetection() {
	const isMobile = ref(false);

	const checkDevice = () => {
		// Check using a combination of screen width and touch capability
		isMobile.value =
			window.innerWidth <= 768 ||
			("ontouchstart" in window && window.innerWidth < 1024);
	};

	onMounted(() => {
		checkDevice();
		window.addEventListener("resize", checkDevice);
	});

	onUnmounted(() => {
		window.removeEventListener("resize", checkDevice);
	});

	return { isMobile };
}
