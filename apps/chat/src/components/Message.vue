<script setup lang="ts">
import type { Bot } from "@/pages/Chat.vue";
import type { ChatPayload, User } from "@hugin-bot/core/src/types";
import DOMPurify from 'isomorphic-dompurify';
import { marked } from 'marked';
import Prism from "prismjs"
import { computed, onMounted, ref } from 'vue';

import '@/lib/prism';

type MessagePart = {
  type: 'text' | 'code';
  content: string;
  language?: string;
};

const props = defineProps<{
  message: ChatPayload;
  index: number;
  currentUser: User;
  messages: Array<ChatPayload>;
  availableBots: Bot[]
}>();

// Add touch handling state
const touchStartX = ref(0);
const touchCurrentX = ref(0);
const isSliding = ref(false);
const slideThreshold = 80; // pixels needed to trigger reply
const isHovered = ref(false);
const isMessageCodeBlock = ref(false);

const emit = defineEmits<{
  replyToMessage: [message: ChatPayload];
}>();



// Format relative time
const formatRelativeTime = (timestamp: number) => {
  const now = new Date();
  const date = new Date(timestamp);
  const diff = now.getTime() - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  // Within the same day, show time only
  if (days === 0) {
    return date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).toLowerCase();
  }

  // Yesterday or older, show day and time
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

  // Older than a week, show full date and time
  return `${date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric'
  })} ${date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).toLowerCase()}`;
};

// Function to parse code blocks in text
const parseCodeBlocks = (text: string): MessagePart[] => {
  // Regex to match code blocks with optional language
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  const parts: MessagePart[] = [];

  // Find all code blocks
  for (const match of text.matchAll(codeBlockRegex)) {
    // Add text before code block
    if (match.index && match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      });
    }

    // Add code block
    const language = match[1] || 'plaintext';
    const code = match[2].trim();
    parts.push({
      type: 'code',
      language,
      content: code
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex)
    });
  }

  return parts;
};

// Function to create code block HTML
const createCodeBlockHtml = (code: string, language: string) => {
  const validLanguage = language && Prism.languages[language] ? language : 'plaintext';
  const highlightedCode = Prism.highlight(
    code,
    Prism.languages[validLanguage],
    validLanguage,
  );

  return `<pre class="code-block" data-language="${validLanguage}">
    <div class="code-block-header">
      <span class="code-block-language">${validLanguage}</span>
      <button class="copy-button" aria-label="Copy code">
        <span class="copy-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></span>
        <span class="check-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>
      </button>
    </div>
    <code class="language-${language}">${highlightedCode}</code>
  </pre>`;
};

// Function to escape HTML in text
const escapeHtml = (text: string) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// Helper function to process HTML and add target="_blank" to links
const addTargetBlankToLinks = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const links = doc.querySelectorAll('a');
  for (const link of links) {
    if (link.href) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    }
  }
  return doc.body.innerHTML;
};

// Add function to handle reply click
const handleReply = () => {
  emit('replyToMessage', props.message);
};

// Touch event handlers
const handleTouchStart = (event: TouchEvent) => {
  touchStartX.value = event.touches[0].clientX;
  isSliding.value = true;
};

const handleTouchMove = (event: TouchEvent) => {
  if (!isSliding.value) return;
  touchCurrentX.value = event.touches[0].clientX;

  // Prevent scrolling if we're sliding horizontally
  const diff = touchCurrentX.value - touchStartX.value;
  if (diff > 10) {
    // event.preventDefault();
  }
};

const handleTouchEnd = () => {
  if (!isSliding.value) return;

  const diff = touchCurrentX.value - touchStartX.value;
  if (diff >= slideThreshold) {
    emit('replyToMessage', props.message);
  }

  // Reset state
  isSliding.value = false;
  touchStartX.value = 0;
  touchCurrentX.value = 0;
};

// Render message content
const renderContent = computed(() => {
  if (!props.message.message) return '';

  // First sanitize the input
  const sanitizedInput = DOMPurify.sanitize(props.message.message);

  // Configure DOMPurify to allow target="_blank" on links
  const purifyConfig = {
    ADD_ATTR: ['target', 'rel']
  };

  // For LLM responses, use markdown rendering
  if (props.message.type === 'llm') {
    // Parse the content into parts (text and code blocks)
    const parts = parseCodeBlocks(sanitizedInput);

    // Convert parts to HTML
    const html = parts.map(part => {
      if (part.type === 'code' && part.language) {
        return createCodeBlockHtml(part.content, part.language);
      }
      // For text parts, render as markdown
      const renderedMarkdown = marked.parse(part.content, {
        breaks: true, // Enable line breaks
        gfm: true, // Enable GitHub Flavored Markdown
      }) as string;
      // Process the rendered markdown to add target="_blank" to links
      return addTargetBlankToLinks(renderedMarkdown);
    }).join('');

    // Final sanitization of the generated HTML with our config
    return DOMPurify.sanitize(html, purifyConfig);
  }

  // For user messages, keep existing behavior but ensure links open in new tab
  const parts = parseCodeBlocks(sanitizedInput);

  if (parts.length === 1 && parts[0].type === 'code') {
    isMessageCodeBlock.value = true;
  }

  const html = parts.map(part => {
    if (part.type === 'code' && part.language) {
      return createCodeBlockHtml(part.content, part.language);
    }
    // Convert newlines to <br> and escape HTML in text
    return escapeHtml(part.content).replace(/\n/g, '<br>');
  }).join('');

  // Final sanitization of the generated HTML with our config
  return DOMPurify.sanitize(html, purifyConfig);
});

// Computed for slide transform
const slideTransform = computed(() => {
  if (!isSliding.value) return '';
  const diff = Math.max(0, Math.min(touchCurrentX.value - touchStartX.value, slideThreshold));
  return `translateX(${diff}px)`;
});

// Find the message being replied to, if any
const repliedMessage = computed(() => {
  if (!props.message.replyToMessageId) return null;
  return props.messages.find(msg => msg.messageId === props.message.replyToMessageId);
});

const isUser = computed(() => {
  return props.message.type === "user" && props.currentUser.id === props.message.userId;
});

// Check if this is the first message in a group from the same sender
const isFirstInGroup = computed(() => {
  if (props.index === 0) return true;
  const prevMessage = props.messages[props.index - 1];

  // Check if there's a timestamp break
  const timeDiff = props.message.createdAt - prevMessage.createdAt;
  const minutes = timeDiff / (1000 * 60);

  // Consider it a new group if:
  // - Different sender
  // - More than 2 hours gap
  // - Different day
  // - More than 15 minutes between messages
  if (prevMessage.userId !== props.message.userId) return true;

  const prevDate = new Date(prevMessage.createdAt).toDateString();
  const currentDate = new Date(props.message.createdAt).toDateString();
  if (prevDate !== currentDate) return true;

  if (minutes > 120) return true; // 2 hour gap
  return minutes > 15; // 15 minute gap
});

// Check if this is the last message in a group from the same sender
const isLastInGroup = computed(() => {
  if (props.index === props.messages.length - 1) return true;
  const nextMessage = props.messages[props.index + 1];

  // Check if there's a timestamp break
  const timeDiff = nextMessage.createdAt - props.message.createdAt;
  const minutes = timeDiff / (1000 * 60);

  // Consider it the end of a group if:
  // - Different sender
  // - More than 2 hours until next message
  // - Different day
  // - More than 15 minutes between messages
  if (nextMessage.userId !== props.message.userId) return true;

  const nextDate = new Date(nextMessage.createdAt).toDateString();
  const currentDate = new Date(props.message.createdAt).toDateString();
  if (nextDate !== currentDate) return true;

  if (minutes > 120) return true; // 2 hour gap
  return minutes > 15; // 15 minute gap
});

// Check if we should show a timestamp separator
const showTimestamp = computed(() => {
  if (props.index === 0) return true;
  const prevMessage = props.messages[props.index - 1];
  const timeDiff = props.message.createdAt - prevMessage.createdAt;

  // Show timestamp if:
  // - More than 15 minutes between messages
  // - First message of the day
  // - First message after a long gap (2 hours)
  const minutes = timeDiff / (1000 * 60);
  if (minutes > 120) return true; // Show after 2 hours gap

  const prevDate = new Date(prevMessage.createdAt).toDateString();
  const currentDate = new Date(props.message.createdAt).toDateString();
  if (prevDate !== currentDate) return true;

  return minutes > 15; // Show every 15 minutes
});

// Add copy functionality
onMounted(() => {
  // Add click handler for copy buttons
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const copyButton = target.closest('.copy-button');

    if (copyButton) {
      const codeBlock = copyButton.closest('.code-block');
      if (codeBlock) {
        const code = codeBlock.querySelector('code');
        if (code) {
          // Copy the code
          navigator.clipboard.writeText(code.textContent || '');

          // Show feedback
          copyButton.classList.add('copied');
          setTimeout(() => {
            copyButton.classList.remove('copied');
          }, 2000);
        }
      }
    }
  });
});

</script>
<template>
  <!-- Message -->
  <div class="flex flex-col" :class="[
    { 'items-end': isUser },
    { 'items-start': !isUser },
    isFirstInGroup ? 'mt-4' : 'mt-0.5',
    isLastInGroup ? 'mb-4' : 'mb-0.5'
  ]" @mouseenter="isHovered = true" @mouseleave="isHovered = false">
    <!-- Timestamp separator -->
    <div v-if="showTimestamp" class="flex justify-center w-full my-2">
      <div class="px-3 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] text-gray-500 dark:text-gray-400">
        {{ formatRelativeTime(message.createdAt) }}
      </div>
    </div>

    <!-- Sender name (only show for first message in group) -->
    <div v-if="isFirstInGroup && !isUser" class="flex items-center mb-1" :class="[
      isUser ? 'mr-2' : 'ml-2'
    ]">
      <span class="text-xs text-gray-500 dark:text-gray-400">
        {{ message.user?.name || message.userId }}
      </span>
    </div>

    <!-- Message bubble row -->
    <div class="flex items-end gap-2 relative" :class="[
      isUser ? 'flex-row-reverse' : 'flex-row',
      isUser ? 'mr-2' : 'ml-2'
    ]" @touchstart="handleTouchStart" @touchmove.passive="handleTouchMove" @touchend="handleTouchEnd"
      @touchcancel="handleTouchEnd">

      <!-- Slide-to-reply indicator -->
      <div class="absolute inset-y-0 left-0 flex items-center pointer-events-none transition-opacity" :class="[
        isSliding ? 'opacity-100' : 'opacity-0',
        touchCurrentX - touchStartX >= slideThreshold ? 'text-primary' : 'text-gray-400'
      ]">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 14 4 9 9 4"></polyline>
          <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
        </svg>
      </div>

      <!-- Avatar space (always present to maintain alignment) -->
      <div v-if="!isUser" class="flex-shrink-0 w-6">
        <!-- Show avatar for last message in group or after timestamp break -->
        <div v-if="isLastInGroup">
          <div class="relative">
            <img :src="message.user?.avatar" alt="" class="w-6 h-6 rounded-full" />
          </div>
        </div>
      </div>

      <!-- Message content with slide transform -->
      <div class="max-w-[70vw] md:max-w-[75vw] rounded-lg transition-transform" :style="{ transform: slideTransform }"
        :class="[
          isUser
            ? 'bg-indigo-600 text-primary-foreground'
            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white',
          (message.imageFiles?.length ?? 0 > 0) || isMessageCodeBlock ? 'p-0' : 'px-2 py-1',
          // Adjust corners based on position in group
          isFirstInGroup ? 'rounded-lg' : '',
          !isFirstInGroup ? 'rounded-lg' : '',
          !isLastInGroup ? (isUser ? 'rounded-br-md' : 'rounded-bl-md') : ''
        ]" :title="new Date(message.createdAt).toLocaleString([], {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          month: 'short',
          day: 'numeric',
          year: new Date(message.createdAt).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        })">
        <!-- Replied message preview -->
        <div v-if="repliedMessage" class="px-2 py-1 mb-1 text-xs border-l-2 rounded bg-gray-100/50 dark:bg-gray-700/50"
          :class="isUser ? 'border-primary-foreground/50' : 'border-primary/50'">
          <div class="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 14 4 9 9 4"></polyline>
              <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
            </svg>
            <span class="font-medium"
              :class="isUser ? 'text-primary-foreground/80' : 'text-primary/80 dark:text-primary-foreground/80'">
              {{ repliedMessage.user?.name ?? repliedMessage.userId }}
            </span>
          </div>
          <div class="truncate mt-0.5"
            :class="isUser ? 'text-primary-foreground/70' : 'text-gray-600 dark:text-gray-300'">
            {{ repliedMessage.message ||
              (repliedMessage.imageFiles?.length ? '📷 Image' :
                repliedMessage.videoFiles?.length ? '🎥 Video' :
                  repliedMessage.audioFiles?.length ? '🔊 Audio' : '') }}
          </div>
        </div>

        <!-- Message text -->
        <div v-if="message.message" class="text break-words max-w-none prose-sm" v-html="renderContent"></div>

        <!-- Image/GIF files -->
        <div v-if="message.imageFiles && message.imageFiles.length > 0" class="space-y-1">
          <div v-for="(image, index) in message.imageFiles" :key="index"
            class="rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700"
            style="min-height: 100px; min-width: 100px;">
            <img :src="image" class="max-w-[300px] max-h-[300px] object-contain rounded-lg w-full h-full"
              loading="eager" />
          </div>
        </div>
      </div>

      <!-- Reply button (hidden on mobile since we use slide) -->
      <button @click.prevent="handleReply" class="p-1 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm
          hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 
          group-hover:opacity-100 transition-opacity duration-200 cursor-pointer
          " :class="[isHovered ? 'opacity-100' : 'opacity-0']">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 14 4 9 9 4"></polyline>
          <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
        </svg>
      </button>
    </div>

    <!-- Replies to this message -->
    <!-- <div v-if="hasReplies" class="ml-8 mt-2 space-y-2 border-l-2 pl-2"
      :class="isUser ? 'border-primary-foreground/20' : 'border-primary/20'">
      <Message v-for="reply in messageReplies" :key="reply.messageId" :message="reply" :index="messages.indexOf(reply)"
        :current-user="currentUser" :messages="messages" :available-bots="availableBots"
        @reply-to-message="emit('replyToMessage', $event)" />
    </div> -->
  </div>
</template>

<style scoped>
/* Add any component-specific styles here */

/* Code block styles */
:deep(.code-block) {
  /* margin: 0.5rem 0;
  padding: 1rem; */
  border-radius: 0.5rem;
  background-color: var(--prism-background, #1e1e1e);
  overflow-x: auto;
  font-family: 'Fira Code', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  border: 1px solid rgba(255, 255, 255, 0.1);
  white-space: pre;
  word-wrap: normal;
  -webkit-overflow-scrolling: touch;
  position: relative;
}

:deep(.code-block code) {
  color: var(--prism-foreground, #d4d4d4);
  background: none;
  padding: 0;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  text-shadow: none;
  -webkit-font-smoothing: auto;
  -moz-osx-font-smoothing: auto;
  display: block;
  min-width: min-content;
  white-space: pre;
  word-wrap: normal;
}

:deep(.code-block-header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

:deep(.code-block-language) {
  font-size: 0.75rem;
  color: #888;
  text-transform: uppercase;
  font-weight: 500;
}

:deep(.dark .code-block-language) {
  color: #aaa;
}

:deep(.copy-button) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #888;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

:deep(.copy-button:hover) {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

:deep(.copy-button .copy-icon),
:deep(.copy-button .check-icon) {
  position: absolute;
  transition: all 0.2s ease;
}

:deep(.copy-button .check-icon) {
  opacity: 0;
  transform: scale(0.8);
}

:deep(.copy-button.copied .copy-icon) {
  opacity: 0;
  transform: scale(0.8);
}

:deep(.copy-button.copied .check-icon) {
  opacity: 1;
  transform: scale(1);
}

/* Dark mode adjustments */
:deep(.dark .code-block) {
  background-color: #1a1a1a;
  border-color: rgba(255, 255, 255, 0.1);
}

/* Scrollbar styling for code blocks */
:deep(.code-block::-webkit-scrollbar) {
  height: 8px;
  width: 8px;
}

:deep(.code-block::-webkit-scrollbar-track) {
  background: #2d2d2d;
  border-radius: 4px;
}

:deep(.code-block::-webkit-scrollbar-thumb) {
  background: #4d4d4d;
  border-radius: 4px;
}

:deep(.code-block::-webkit-scrollbar-thumb:hover) {
  background: #5d5d5d;
}

/* Ensure code block doesn't overflow its container */
:deep(.prose pre) {
  max-width: 100%;
  overflow-x: auto;
}

/* Ensure code block content is properly contained */
:deep(.prose pre code) {
  max-width: none;
  overflow-x: auto;
}

/* Syntax highlighting adjustments */
:deep(.token.comment),
:deep(.token.prolog),
:deep(.token.doctype),
:deep(.token.cdata) {
  color: #6a9955;
  background: none;
}

:deep(.token.punctuation),
:deep(.token.operator),
:deep(.token.entity),
:deep(.token.url),
:deep(.language-css .token.string),
:deep(.style .token.string) {
  color: #d4d4d4;
  background: none;
}

:deep(.token.property),
:deep(.token.tag),
:deep(.token.boolean),
:deep(.token.number),
:deep(.token.constant),
:deep(.token.symbol) {
  color: #b5cea8;
  background: none;
}

:deep(.token.selector),
:deep(.token.string),
:deep(.token.char),
:deep(.token.builtin) {
  color: #ce9178;
  background: none;
}

:deep(.token.keyword),
:deep(.token.control),
:deep(.token.directive),
:deep(.token.unit) {
  color: #569cd6;
  background: none;
}

:deep(.token.function) {
  color: #dcdcaa;
  background: none;
}

:deep(.token.class-name) {
  color: #4ec9b0;
  background: none;
}

:deep(.token.variable) {
  color: #9cdcfe;
  background: none;
}

:deep(.token.important),
:deep(.token.bold),
:deep(.token.italic) {
  color: #c586c0;
  background: none;
}

:deep(.token.atrule),
:deep(.token.attr-value) {
  color: #ce9178;
  background: none;
}

:deep(.token.regex) {
  color: #d16969;
  background: none;
}

:deep(.token.namespace) {
  color: #4ec9b0;
  background: none;
}

:deep(.token.deleted) {
  color: #ce9178;
  background: none;
}

:deep(.token.inserted) {
  color: #b5cea8;
  background: none;
}

:deep(.token.changed) {
  color: #569cd6;
  background: none;
}

/* Ensure no background on any token */
:deep(.token) {
  background: none !important;
  text-shadow: none !important;
  box-shadow: none !important;
}

/* Remove duplicate token styles */
:deep(.token.operator),
:deep(.token.entity),
:deep(.token.url),
:deep(.language-css .token.string),
:deep(.style .token.string),
:deep(.token.variable),
:deep(.token.control),
:deep(.token.directive),
:deep(.token.unit) {
  color: #d4d4d4 !important;
  background: none !important;
  text-shadow: none !important;
  box-shadow: none !important;
}

/* Inline code styling */
:deep(code:not(.code-block code)) {
  padding: 0.2em 0.4em;
  margin: 0;
  font-size: 85%;
  background-color: rgba(175, 184, 193, 0.2);
  border-radius: 6px;
  font-family: 'Fira Code', monospace;
  color: #24292e;
}

:deep(.dark code:not(.code-block code)) {
  background-color: rgba(255, 255, 255, 0.1);
  color: #e1e1e1;
}

/* Add smooth transition for sliding */
.transition-transform {
  transition: transform 0.2s ease-out;
}

/* Ensure the slide-to-reply indicator transitions smoothly */
.transition-opacity {
  transition: opacity 0.2s ease-out;
}
</style>