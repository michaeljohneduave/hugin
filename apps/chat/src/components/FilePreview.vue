<script setup lang="ts">
import { File as FileIcon, X as XIcon } from "lucide-vue-next";

defineProps<{
  fileName: string;
  onRemove: () => void;
}>();
</script>

<template>
  <div class="flex items-center p-2 bg-gray-100 dark:bg-gray-700 rounded">
    <FileIcon class="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
    <span class="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{{ fileName }}</span>
    <button type="button" @click="onRemove" class="p-1 text-gray-500 dark:text-gray-400 hover:text-red-500">
      <XIcon class="h-4 w-4" />
    </button>
  </div>
</template> 