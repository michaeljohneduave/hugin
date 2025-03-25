<script setup>
import { Mic as MicIcon, Square as SquareIcon } from 'lucide-vue-next'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  isDarkMode: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['start', 'stop'])

// Reactive state
const visualCanvas = ref(null)
const isActive = ref(false)
const recordingTime = ref(0)
let recordingInterval = null

// Audio context and analyzer
let audioContext = null
let analyser = null
let dataArray = null
let animationId = null
let microphone = null
let mediaRecorder = null
let audioChunks = []

// Canvas context and properties
let canvasCtx = null
let canvasWidth = 0
let canvasHeight = 0

// Visualization properties
const lineWidth = 1.5  // Width of each vertical line
const lineSpacing = 2  // Space between lines
let audioHistory = []  // Store previous audio data

// Initialize canvas and audio
onMounted(() => {
  // Set up canvas
  const canvas = visualCanvas.value
  canvasCtx = canvas.getContext('2d')

  // Set canvas dimensions
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)

  // Draw initial state
  drawInitialState()
})

// Clean up on component unmount
onBeforeUnmount(() => {
  stopAudio()
  window.removeEventListener('resize', resizeCanvas)
  if (recordingInterval) {
    clearInterval(recordingInterval)
  }
})

// Watch isActive to emit events
watch(isActive, (newValue) => {
  if (newValue) {
    emit('start')
  } else {
    emit('stop')
  }
})

// Resize canvas to match container
function resizeCanvas() {
  const canvas = visualCanvas.value
  canvasWidth = canvas.offsetWidth
  canvasHeight = canvas.offsetHeight
  canvas.width = canvasWidth
  canvas.height = canvasHeight

  // Redraw after resize
  if (isActive.value && audioHistory.length > 0) {
    drawVisualization()
  } else {
    drawInitialState()
  }
}

// Toggle audio recording/playback
async function toggleAudio() {
  if (isActive.value) {
    stopAudio()
  } else {
    await startAudio()
  }
}

// Start audio recording and visualization
async function startAudio() {
  try {
    // Initialize audio context if needed
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)()
      analyser = audioContext.createAnalyser()
      analyser.fftSize = 64 // Small for clear visualization
      analyser.smoothingTimeConstant = 0.5
      const bufferLength = analyser.frequencyBinCount
      dataArray = new Uint8Array(bufferLength)
    }

    // Reset history and chunks
    audioHistory = []
    audioChunks = []

    // Get microphone access
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    microphone = audioContext.createMediaStreamSource(stream)
    microphone.connect(analyser)

    // Set up media recorder
    mediaRecorder = new MediaRecorder(stream)
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data)
    }

    // Start recording
    mediaRecorder.start()
    isActive.value = true
    recordingTime.value = 0
    recordingInterval = setInterval(() => {
      recordingTime.value++
    }, 1000)

    // Start visualization
    updateVisualization()
  } catch (error) {
    console.error('Error accessing microphone:', error)
  }
}

// Stop audio recording and visualization
function stopAudio() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()

    for (const track of mediaRecorder.stream.getTracks()) {
      track.stop();
    }
    // mediaRecorder.stream.getTracks().forEach(track => track.stop())
  }

  if (microphone) {
    microphone.disconnect()
    microphone = null
  }

  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }

  if (recordingInterval) {
    clearInterval(recordingInterval)
    recordingInterval = null
  }

  isActive.value = false
  drawInitialState()

  // Create audio blob from chunks
  if (audioChunks.length > 0) {
    const audioBlob = new Blob(audioChunks, { type: 'audio/mpeg' })
    const audioUrl = URL.createObjectURL(audioBlob)
    emit('stop', audioUrl)
  }
}

// Format time in MM:SS
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Update visualization
function updateVisualization() {
  if (!isActive.value) return

  // Get frequency data
  analyser.getByteFrequencyData(dataArray)

  // Calculate the average of all frequencies to get a single value
  let sum = 0
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i]
  }
  const average = sum / dataArray.length

  // Add this value to history (normalized to 0-1)
  audioHistory.unshift(average / 255)

  // Limit history length based on canvas width
  const maxHistoryLength = Math.floor(canvasWidth / (lineWidth + lineSpacing))
  if (audioHistory.length > maxHistoryLength) {
    audioHistory.length = maxHistoryLength
  }

  // Draw the visualization
  drawVisualization()

  // Continue animation
  animationId = requestAnimationFrame(updateVisualization)
}

// Draw the visualization
function drawVisualization() {
  // Clear canvas
  canvasCtx.clearRect(0, 0, canvasWidth, canvasHeight)

  // Draw background
  drawBackground()

  // For each point in history, draw a vertical line
  for (let i = 0; i < audioHistory.length; i++) {
    const x = i * (lineWidth + lineSpacing)

    // Calculate height based on audio value (0-1)
    const value = audioHistory[i]
    const lineHeight = value * canvasHeight * 0.8

    // Center the line vertically
    const y = (canvasHeight - lineHeight) / 2

    // Draw the line
    canvasCtx.fillStyle = '#10b981' // emerald-500
    canvasCtx.fillRect(x, y, lineWidth, lineHeight)
  }
}

// Draw background
function drawBackground() {
  // Create gradient background
  const gradient = canvasCtx.createLinearGradient(0, 0, 0, canvasHeight)
  gradient.addColorStop(0, '#111827') // gray-900
  gradient.addColorStop(1, '#1f2937') // gray-800
  canvasCtx.fillStyle = gradient
  canvasCtx.fillRect(0, 0, canvasWidth, canvasHeight)

  // Draw center line
  canvasCtx.strokeStyle = 'rgba(75, 85, 99, 0.3)' // gray-600 with transparency
  canvasCtx.lineWidth = 1
  canvasCtx.beginPath()
  canvasCtx.moveTo(0, canvasHeight / 2)
  canvasCtx.lineTo(canvasWidth, canvasHeight / 2)
  canvasCtx.stroke()
}

// Draw initial state
function drawInitialState() {
  // Clear canvas
  canvasCtx.clearRect(0, 0, canvasWidth, canvasHeight)

  // Draw background
  drawBackground()

  // Draw placeholder lines
  const lineCount = Math.floor(canvasWidth / (lineWidth + lineSpacing))

  for (let i = 0; i < lineCount; i++) {
    const x = i * (lineWidth + lineSpacing)

    // Create a gentle sine wave pattern
    const value = 0.1 + 0.1 * Math.sin(i * 0.2)
    const lineHeight = value * canvasHeight

    // Center the line vertically
    const y = (canvasHeight - lineHeight) / 2

    // Draw the line
    canvasCtx.fillStyle = 'rgba(16, 185, 129, 0.3)' // emerald-500 with transparency
    canvasCtx.fillRect(x, y, lineWidth, lineHeight)
  }
}
</script>

<template>
  <div class="flex items-center space-x-2 w-full">
    <!-- Audio visualization -->
    <div class="flex-1 h-12 bg-gray-900 rounded-lg shadow-md overflow-hidden relative">
      <canvas ref="visualCanvas" class="w-full h-full"></canvas>
    </div>

    <!-- Recording time -->
    <div v-if="isActive" class="text-sm font-medium text-gray-700 dark:text-gray-300">
      {{ formatTime(recordingTime) }}
    </div>

    <!-- Play/Record button -->
    <button @click="toggleAudio"
      class="p-2 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 focus:outline-none transition-colors">
      <SquareIcon v-if="isActive" class="h-5 w-5" />
      <MicIcon v-else class="h-5 w-5" />
    </button>
  </div>
</template>

<style scoped>
/* Add any additional styles here */
</style>
