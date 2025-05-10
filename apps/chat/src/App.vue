<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { funnel } from "remeda";
import { onMounted, onUnmounted, ref, watch } from "vue";
import NotificationContainer from "./components/NotificationContainer.vue";
import { useNotification } from "./composables/useNotification";

const visualViewport = window.visualViewport;
let debouncedResize: ReturnType<typeof funnel>;
const keyboardVisible = ref(false);
const viewportHieght = window.innerHeight;
const notif = useNotification();
const {
	needRefresh,
	updateServiceWorker,
} = useRegisterSW({
	immediate: true,
	onRegisterError(error) {
		console.error("SW registration error", error);
	},
	onNeedRefresh() {
		console.log("New content available, please refresh.");
	},
})

function updateKeyboardStatus() {
	if (visualViewport) {
		const KEYBOARD_HEIGHT_THRESHOLD_PX = 150;
		const isKeyboardCurrentlyVisible =
			(viewportHieght - visualViewport.height) > KEYBOARD_HEIGHT_THRESHOLD_PX;
		keyboardVisible.value = isKeyboardCurrentlyVisible;
	} else {
		keyboardVisible.value = false;
	}
}

function visualportResize() {
	debouncedResize.call();
}

watch(needRefresh, (newVal) => {
	console.log("needRefresh", newVal);
	if (newVal) {
		notif.info("New version available, click banner to update.", {
			duration: Number.POSITIVE_INFINITY,

			onClick: () => {
				updateServiceWorker(true);
			},
		});
	}
}, { immediate: true });

onMounted(() => {
	debouncedResize = funnel(
		() => {
			updateKeyboardStatus();
		},
		{
			minGapMs: 500,
			triggerAt: "start",
		}
	);

	if (visualViewport) {
		visualViewport.addEventListener("resize", visualportResize);
		updateKeyboardStatus();
	}
});

onUnmounted(() => {
	if (visualViewport) {
		visualViewport.removeEventListener("resize", visualportResize);
	}
});
</script>

<template>
	<div class="h-dvh bg-gray-100 dark:bg-gray-900 flex flex-col" :class="{ 'pb-safe': !keyboardVisible }">
		<router-view></router-view>
		<NotificationContainer />
	</div>
</template>
