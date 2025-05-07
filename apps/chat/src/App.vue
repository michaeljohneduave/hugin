<script setup lang="ts">
import { funnel } from "remeda";
import { onMounted, onUnmounted, ref } from "vue";
import NotificationContainer from "./components/NotificationContainer.vue";
import { useNotification } from "./composables/useNotification";

const visualViewport = window.visualViewport;
let debouncedResize: ReturnType<typeof funnel>;
const keyboardHidden = ref(true);

function handleResize() {
	keyboardHidden.value = !keyboardHidden.value;
}

function visualportResize() {
	debouncedResize.call();
}

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
