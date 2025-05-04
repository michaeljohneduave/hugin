<script setup lang="ts">
import type { RoomPayload } from "@hugin-bot/core/src/types";
import { computed } from 'vue';

const props = defineProps<{
  event: RoomPayload;
  index: number;
}>();

// Format relative time similar to Message component
const formatRelativeTime = (timestamp: number) => {
  const now = new Date();
  const date = new Date(timestamp);
  const diff = now.getTime() - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).toLowerCase();
  }

  if (days === 1) {
    return `Yesterday ${date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).toLowerCase()}`;
  }

  if (days <= 7) {
    return `${date.toLocaleDateString([], { weekday: 'short' })} ${date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).toLowerCase()}`;
  }

  return `${date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric'
  })} ${date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).toLowerCase()}`;
};

// Get event message based on event type and data
const getEventMessage = computed(() => {
  const { action, user } = props.event;
  const userName = user?.name || 'Someone';

  switch (action) {
    case 'joinRoom':
      return `${userName} joined the chat`;
    case 'leaveRoom':
      return `${userName} left the chat`;
    default:
      return 'Unknown event';
  }
});
</script>

<template>
  <!-- Event message -->
  <div class="flex flex-col items-center my-2">
    <!-- Event message -->
    <div
      class="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-500 dark:text-gray-400">
      <span>{{ getEventMessage }}</span>
    </div>
  </div>
</template>

<style scoped>
.event-icon {
  font-size: 1.1em;
  line-height: 1;
}
</style>
