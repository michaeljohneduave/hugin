<script setup lang="ts">
import carmyAvatar from "@/assets/carmy-avatar.webp";
import pearlAvatar from "@/assets/pearl.svg";
import { useTrpc } from "@/composables/useTrpc";
import { addMessageToDb, db } from "@/lib/dexie";
import { useUser } from "@clerk/vue";
import type { ChatPayload, Room } from "@hugin-bot/core/src/types";
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ChatHeader from "../components/ChatHeader.vue";
import MessageInput from "../components/MessageInput.vue";
import { useTheme } from "../composables/useTheme";

const botAvatars = {
  carmy: carmyAvatar,
  pearl: pearlAvatar,
};

const assistants = [
  {
    id: 'carmy',
    name: 'Carmy',
    avatar: carmyAvatar,
    description: 'Specialized in cooking and food',
    examples: [
      'Help me plan a dinner menu for 6 people',
      'What\'s a quick recipe for pasta carbonara?',
      'How do I properly season a cast iron pan?',
      "Tell me a joke"
    ]
  },
  {
    id: 'pearl',
    name: 'Pearl',
    avatar: pearlAvatar,
    description: 'Your personal assistant',
    examples: [
      'Help me organize my daily schedule',
      'Write a professional email to my team',
      'Create a study plan for learning a new skill',
      "Tell me a joke"
    ]
  }
];

const router = useRouter();
const { user: clerkUser } = useUser();
const { isDarkMode } = useTheme();
const trpc = useTrpc();
const currentUser = computed(() => ({
  id: clerkUser.value!.id,
  name: clerkUser.value!.fullName!,
  type: "user" as const,
  avatar: clerkUser.value?.imageUrl,
}));

const availableBots = computed(() => assistants.map(assistant => ({
  id: assistant.id,
  name: assistant.name,
  avatar: assistant.avatar,
  type: "llm" as const,
})));


async function initRoom(msg: ChatPayload, roomType: Room["type"]) {
  const tmpRoom: Room = {
    roomId: crypto.randomUUID(),
    type: roomType,
    userId: msg.user.id,
    status: "active",
    user: {
      avatar: msg.user.avatar,
      firstName: msg.user.name,
      lastName: msg.user.name,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const tmpMsg: ChatPayload = {
    messageId: crypto.randomUUID(),
    roomId: tmpRoom.roomId,
    message: msg.message,
    type: msg.type,
    action: msg.action,
    user: msg.user,
    userId: msg.user.id,
    roomType: roomType,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await Promise.all([
    db.rooms.add({
      ...tmpRoom,
      members: [msg.user],
      lastMessageAt: Date.now(),
    }),
    addMessageToDb(tmpMsg),
  ]);

  trpc.chats.initializeRoom
    .mutate({
      type: roomType,
      roomId: tmpRoom.roomId,
      message: tmpMsg,
      agentId: msg.mentions?.[0],
    })
    .then(({ room, message }) => {
      // Update placeholder room and message data with the actual data from server
      db.rooms.where("roomId").equals(tmpRoom.roomId).modify({
        roomId: room.roomId,
        name: room.name,
        type: roomType,
        userId: msg.user.id,
        status: room.status,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
      });

      db.messages.where("messageId").equals(tmpMsg.messageId).modify({
        messageId: message.messageId,
        roomId: message.roomId,
        message: message.message,
        type: message.type,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      });
    });

  return tmpRoom.roomId;
}

const handleSendMessage = async (message: ChatPayload) => {
  // Since we removed assistant selection, we'll start with pearl as default
  const roomId = await initRoom(message, "llm");
  router.push({
    path: `/chat/${roomId}`,
    replace: true,
  });
};

const handleExampleClick = async (example: string, assistantId: string) => {
  const message: ChatPayload = {
    messageId: crypto.randomUUID(),
    action: "message",
    userId: currentUser.value.id,
    message: example,
    roomId: "new",
    createdAt: Date.now(),
    type: "user",
    user: currentUser.value,
    mentions: [assistantId],
    roomType: "llm",
  };

  await handleSendMessage(message);
};
</script>

<template>
  <!-- Header -->
  <ChatHeader title="New Chat" />

  <!-- Main Content -->
  <div class="flex-1 overflow-y-auto p-4">
    <div class="max-w-3xl mx-auto w-full space-y-6">
      <!-- Welcome Message -->
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Start a new chat</h1>
        <p class="text-gray-600 dark:text-gray-400">Get help from our specialized AI assistants</p>
      </div>

      <!-- Assistants Overview - More Compact Layout -->
      <div class="grid gap-4">
        <div v-for="assistant in assistants" :key="assistant.id"
          class="bg-card dark:bg-gray-800 rounded-lg shadow-md border p-4">
          <div class="flex items-center gap-3 mb-3">
            <img :src="assistant.avatar" :alt="assistant.name" class="w-10 h-10 rounded-full object-cover">
            <div>
              <h2 class="font-semibold text-primary dark:text-white">{{ assistant.name }}</h2>
              <p class="text-sm text-gray-600 dark:text-gray-400">{{ assistant.description }}</p>
            </div>
          </div>

          <div class="space-y-2">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button v-for="example in assistant.examples" :key="example"
                @click="handleExampleClick(example, assistant.id)"
                class="text-left p-2 rounded-md text-primary-foreground bg-indigo-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm dark:text-gray-200 truncate">
                "{{ example }}"
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Message Input -->
  <div class="border-t border-border mt-auto">
    <MessageInput :currentUser="currentUser" :currentChatId="'new'" :availableBots="availableBots"
      :isDarkMode="isDarkMode" :roomType="'llm'" @sendMessage="handleSendMessage" />
  </div>
</template>
