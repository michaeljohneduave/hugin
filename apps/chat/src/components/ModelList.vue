<script setup lang="ts">
import type { User } from "@hugin-bot/core/src/types";
import { BotIcon } from "lucide-vue-next";

defineProps<{
  llms: User[];
}>();

</script>

<template>
  <div class="p-4">
    <h2 class="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mb-2">AI Assistants</h2>
    <ul class="space-y-2">
      <li v-for="llm in llms" :key="llm.id" class="flex items-center space-x-2">
        <div class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
          <BotIcon class="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        </div>
        <span class="text-gray-900 dark:text-white">{{ llm.name }}</span>
      </li>
    </ul>
  </div>
</template>