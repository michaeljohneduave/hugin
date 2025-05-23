<script setup lang="ts">
import { useTrpc } from '@/composables/useTrpc';
import { useQuery } from '@tanstack/vue-query';
import { onMounted, onUpdated, ref, toRef, watch } from 'vue';
import { defineEmits, defineProps } from 'vue';

// Define a more flexible interface that can handle the actual structure
interface MessageMetadata {
  responseDetails?: {
    tokenUsage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
      [key: string]: unknown;
    };
    finishReason?: string;
    steps?: number;
    [key: string]: unknown;
  };
  responseSteps?: Array<{
    type?: string;
    content?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown; // For any other properties
}

const props = defineProps<{
  show: boolean;
  messageId: string;
  metadata: MessageMetadata | null;
}>();

const emit = defineEmits<{
  close: [] // Using the modern syntax for defineEmits
}>();

const trpc = useTrpc();
const messageId = toRef(props.messageId);
const showMetadata = toRef(() => props.show);
const { data: metadata } = useQuery({
  queryKey: ["message-metadata", props.messageId],
  queryFn: async () => {
    return await trpc.chats.getMessageContext.query(props.messageId);
  },
  enabled: () => props.show
})

const close = () => {
  emit('close');
};

// Parse step content to identify and highlight Thought, Action, Observation, and Final sections
const parseStepContent = (content: string): Array<{ type?: string; content: string }> => {
  if (!content) return [{ content: '' }];

  const parts: Array<{ type?: string; content: string }> = [];

  // Check if content contains XML tags
  if (content.includes('<thought>') || content.includes('<action>') ||
    content.includes('<observation>') || content.includes('<final>')) {
    // Parse XML format in the order they appear in the content
    // This preserves the sequence of thoughts, actions, observations, and final answer

    // Use a regex to find all XML tags in order
    const xmlTagPattern = /<(thought|action|observation|final)>(.*?)<\/\1>/gs;
    let match: RegExpExecArray | null;

    // Execute the regex pattern and process each match
    match = xmlTagPattern.exec(content);
    while (match !== null) {
      const tagType = match[1]; // 'thought', 'action', 'observation', or 'final'
      const tagContent = match[2].trim();

      // Map the tag type to the display type
      const displayType =
        tagType === 'thought' ? 'Thought' :
          tagType === 'action' ? 'Action' :
            tagType === 'observation' ? 'Observation' :
              'Final Answer';

      parts.push({
        type: displayType,
        content: tagContent
      });

      // Move to the next match
      match = xmlTagPattern.exec(content);
    }

    // If XML tags were found, return the parsed parts
    if (parts.length > 0) {
      return parts;
    }
  }

  // If no XML tags or if XML parsing failed, fall back to traditional format
  return parseTraditionalFormat(content);
};

// Helper function to parse the traditional format (for backward compatibility)
const parseTraditionalFormat = (content: string): Array<{ type?: string; content: string }> => {
  const parts: Array<{ type?: string; content: string }> = [];
  const lines = content.split('\n');

  let currentType: string | undefined = undefined;
  let currentContent: string[] = [];

  for (const line of lines) {
    // Check for section headers
    if (line.startsWith('Thought:')) {
      // Save previous section if exists
      if (currentContent.length > 0) {
        parts.push({
          type: currentType,
          content: currentContent.join('\n')
        });
        currentContent = [];
      }
      currentType = 'Thought';
      currentContent.push(line.substring('Thought:'.length).trim());
    } else if (line.startsWith('Action:')) {
      // Save previous section if exists
      if (currentContent.length > 0) {
        parts.push({
          type: currentType,
          content: currentContent.join('\n')
        });
        currentContent = [];
      }
      currentType = 'Action';
      currentContent.push(line.substring('Action:'.length).trim());
    } else if (line.startsWith('Final Answer:')) {
      // Save previous section if exists
      if (currentContent.length > 0) {
        parts.push({
          type: currentType,
          content: currentContent.join('\n')
        });
        currentContent = [];
      }
      currentType = 'Final Answer';
      currentContent.push(line.substring('Final Answer:'.length).trim());
    } else {
      // Continue with current section
      currentContent.push(line);
    }
  }

  // Add the last section
  if (currentContent.length > 0) {
    parts.push({
      type: currentType,
      content: currentContent.join('\n')
    });
  }

  return parts;
};
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
    <div class="flex items-center justify-center min-h-screen p-4 text-center">
      <!-- Background overlay - transparent to show chat behind -->
      <div class="fixed inset-0 bg-transparent transition-opacity" aria-hidden="true" @click="close"></div>

      <!-- Dialog panel -->
      <div
        class="relative inline-block bg-white dark:bg-gray-800 rounded-lg text-left shadow-xl transform transition-all max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <!-- Close button in the corner -->
        <button @click="close"
          class="sticky top-2 right-2 float-right p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 z-10">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div class="p-2">
          <div class="space-y-4">
            <!-- Response Steps (Prioritized) -->
            <div v-if="metadata?.responseSteps && metadata.responseSteps.length > 0">
              <div class="bg-gray-50 dark:bg-gray-700 rounded-md p-3 text-sm">
                <div v-for="(step, index) in metadata.responseSteps" :key="index"
                  class="mb-4 last:mb-0 border-b border-gray-200 dark:border-gray-600 pb-3 last:border-0 last:pb-0">
                  <div class="text-gray-600 dark:text-gray-400 font-medium mb-1 flex items-center">
                    <span
                      class="px-2 py-0.5 rounded text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">{{
                        index + 1 }}: {{ step.type?.toUpperCase() || 'unknown' }}</span>
                  </div>
                  <div class="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                    <template v-if="step.content && (step.content.includes('Thought:') || step.content.includes('Action:') || step.content.includes('Final Answer:') ||
                      step.content.includes('<thought>') || step.content.includes('<action>') ||
                      step.content.includes('<observation>') || step.content.includes('<final>'))">
                      <div v-for="(part, partIndex) in parseStepContent(step.content || '')" :key="partIndex"
                        class="mb-4 last:mb-0">
                        <div v-if="part.type"
                          class="font-medium mt-3 first:mt-0 inline-block px-2 py-0.5 rounded text-sm" :class="{
                            'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200': part.type === 'Thought',
                            'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200': part.type === 'Action',
                            'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200': part.type === 'Observation',
                            'bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200': part.type === 'Final Answer'
                          }">{{ part.type }}</div>
                        <div :class="{ 'pl-3 mt-1': part.type }">{{ part.content }}</div>
                      </div>
                    </template>
                    <template v-else>
                      {{ step.content || '' }}
                    </template>
                  </div>
                </div>
              </div>
            </div>

            <!-- Metadata Summary -->
            <div v-if="metadata?.responseDetails">
              <div class="bg-gray-50 dark:bg-gray-700 rounded-md p-3 text-sm">
                <div class="grid grid-cols-2 gap-2">
                  <!-- Token Usage -->
                  <template v-if="metadata.responseDetails.tokenUsage">
                    <div
                      class="text-gray-600 dark:text-gray-400 col-span-2 font-medium border-b border-gray-200 dark:border-gray-600 pb-1 mb-1">
                      Token Usage</div>

                    <div class="text-gray-600 dark:text-gray-400">Prompt:</div>
                    <div class="text-gray-900 dark:text-gray-100">{{ metadata.responseDetails.tokenUsage.promptTokens ||
                      0 }}</div>

                    <div class="text-gray-600 dark:text-gray-400">Completion:</div>
                    <div class="text-gray-900 dark:text-gray-100">{{
                      metadata.responseDetails.tokenUsage.completionTokens || 0 }}</div>

                    <div class="text-gray-600 dark:text-gray-400">Total:</div>
                    <div class="text-gray-900 dark:text-gray-100 font-medium">{{
                      metadata.responseDetails.tokenUsage.totalTokens || 0 }}</div>
                  </template>

                  <!-- Other Metadata -->
                  <template v-if="metadata.responseDetails.finishReason || metadata.responseDetails.steps">
                    <div
                      class="text-gray-600 dark:text-gray-400 col-span-2 font-medium border-b border-gray-200 dark:border-gray-600 pb-1 mb-1 mt-2">
                      Other Details</div>

                    <div v-if="metadata.responseDetails.finishReason" class="text-gray-600 dark:text-gray-400">Finish
                      Reason:</div>
                    <div v-if="metadata.responseDetails.finishReason" class="text-gray-900 dark:text-gray-100">{{
                      metadata.responseDetails.finishReason }}</div>

                    <div v-if="metadata.responseDetails.steps" class="text-gray-600 dark:text-gray-400">Steps:</div>
                    <div v-if="metadata.responseDetails.steps" class="text-gray-900 dark:text-gray-100">{{
                      metadata.responseDetails.steps }}</div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
