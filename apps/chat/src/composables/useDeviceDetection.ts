import { onMounted, onUnmounted, ref } from "vue";

export function useDeviceDetection() {
	const isMobile = ref(false);

	const checkDevice = () => {
		isMobile.value = navigator.userAgent.includes("Mobile");
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
