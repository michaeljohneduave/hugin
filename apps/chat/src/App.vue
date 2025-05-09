<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { funnel } from "remeda";
import { onMounted, onUnmounted, ref, watch } from "vue";
import NotificationContainer from "./components/NotificationContainer.vue";
import { useNotification } from "./composables/useNotification";

const visualViewport = window.visualViewport;
let debouncedResize: ReturnType<typeof funnel>;
const keyboardHidden = ref(true);
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

function handleResize() {
	keyboardHidden.value = !keyboardHidden.value;
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
			handleResize();
		},
		{
			minGapMs: 500,
			triggerAt: "start",
		}
	);

	if (visualViewport) {
		visualViewport.addEventListener("resize", visualportResize);
	}
});

onUnmounted(() => {
	if (visualViewport) {
		visualViewport.removeEventListener("resize", visualportResize);
	}
});
</script>

<template>
	<div class="h-dvh bg-gray-100 dark:bg-gray-900 flex flex-col" :class="{ 'p-safe': keyboardHidden }">
		<router-view></router-view>
		<NotificationContainer />
	</div>
</template>
