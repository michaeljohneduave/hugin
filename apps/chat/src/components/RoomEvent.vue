<script setup lang="ts">
import type { ChatPayloadWithUser } from "@/pages/Chat.vue";
import { computed } from 'vue';

type ChatEventType =
  | 'user_joined'
  | 'user_left'
  | 'user_typing'
  | 'room_settings_changed'
  | 'user_role_changed'
  | 'room_name_changed'
  | 'user_muted'
  | 'user_unmuted'
  | 'message_pinned'
  | 'message_unpinned'
  | 'user_reacted';

interface ChatEventData {
  newRole?: 'admin' | 'user';
  newName?: string;
  duration?: string;
  reaction?: string;
  settings?: Record<string, unknown>;
}

const props = defineProps<{
  event: ChatPayloadWithUser & {
    eventType?: ChatEventType;
    eventData?: ChatEventData;
  };
  index: number;
  messages: Array<ChatPayloadWithUser>;
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

// Check if we should show a timestamp separator
const showTimestamp = computed(() => {
  if (props.index === 0) return true;
  const prevMessage = props.messages[props.index - 1];
  const timeDiff = props.event.timestamp - prevMessage.timestamp;
  const minutes = timeDiff / (1000 * 60);

  if (minutes > 120) return true; // Show after 2 hours gap

  const prevDate = new Date(prevMessage.timestamp).toDateString();
  const currentDate = new Date(props.event.timestamp).toDateString();
  if (prevDate !== currentDate) return true;

  return minutes > 15; // Show every 15 minutes
});

// Get event icon based on event type
const getEventIcon = (event: ChatEventType) => {
  switch (event) {
    case 'user_joined':
      return '👋';
    case 'user_left':
      return '🚪';
    case 'user_typing':
      return '✍️';
    case 'room_settings_changed':
      return '⚙️';
    case 'user_role_changed':
      return '👑';
    case 'room_name_changed':
      return '📝';
    case 'user_muted':
      return '🔇';
    case 'user_unmuted':
      return '🔊';
    case 'message_pinned':
      return '📌';
    case 'message_unpinned':
      return '📍';
    case 'user_reacted':
      return '👍';
    default:
      return '💬';
  }
};

// Get event message based on event type and data
const getEventMessage = computed(() => {
  if (!props.event.eventType || !props.event.eventData) return '';

  const { eventType, eventData, user } = props.event;
  const userName = user?.name || 'Someone';

  switch (eventType) {
    case 'user_joined':
      return `${userName} joined the chat`;
    case 'user_left':
      return `${userName} left the chat`;
    case 'user_typing':
      return `${userName} is typing...`;
    case 'room_settings_changed':
      return `${userName} updated room settings`;
    case 'user_role_changed':
      return `${userName} was ${eventData.newRole === 'admin' ? 'promoted to' : 'removed as'} admin`;
    case 'room_name_changed':
      return `${userName} changed the room name to "${eventData.newName}"`;
    case 'user_muted':
      return `${userName} was muted ${eventData.duration ? `for ${eventData.duration}` : ''}`;
    case 'user_unmuted':
      return `${userName} was unmuted`;
    case 'message_pinned':
      return `${userName} pinned a message`;
    case 'message_unpinned':
      return `${userName} unpinned a message`;
    case 'user_reacted':
      return `${userName} reacted with ${eventData.reaction}`;
    default:
      return 'Unknown event';
  }
});
</script>

<template>
  <!-- Event message -->
  <div class="flex flex-col items-center my-2">
    <!-- Timestamp separator -->
    <div v-if="showTimestamp" class="flex justify-center w-full mb-2">
      <div class="px-3 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] text-gray-500 dark:text-gray-400">
        {{ formatRelativeTime(event.timestamp) }}
      </div>
    </div>

    <!-- Event message -->
    <div
      class="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-500 dark:text-gray-400">
      <span class="event-icon" v-if="event.eventType">{{ getEventIcon(event.eventType) }}</span>
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
