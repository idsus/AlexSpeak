import * as speechCommands from '@tensorflow-models/speech-commands'
import '@tensorflow/tfjs'

type BaseRecognizer = ReturnType<typeof speechCommands.create>
type TransferRecognizer = ReturnType<BaseRecognizer['createTransfer']>

const MODEL_NAME = 'alexspeak-personal'
const TARGET_LABEL = 'target'
const BACKGROUND_LABEL = '_background_noise_'
const EXAMPLES_KEY = 'alexspeak.personalSpeech.examples'
const MIN_EXAMPLES_PER_LABEL = 3
const TRAIN_EPOCHS = 20
const AUTO_RETRAIN_EVERY_SAMPLES = 2
const AUTO_RETRAIN_COOLDOWN_MS = 6500
const MAX_EXAMPLES_PER_LABEL = 64

export interface PersonalizedSpeechStatus {
  ready: boolean
  listening: boolean
  trained: boolean
  targetExamples: number
  backgroundExamples: number
  targetScore: number
  backgroundScore: number
  threshold: number
  collecting: boolean
  autoTraining: boolean
  autoTargetExamples: number
  autoBackgroundExamples: number
  samplesSinceTrain: number
  reason: string
}

export interface PersonalizedSpeechOptions {
  threshold: number
  onAttempt: () => void
  onStatus?: (status: PersonalizedSpeechStatus) => void
}

// Local copy of the BROWSER_FFT base model (fetched by tools/fetch_models.mjs)
// so the recording/personalization works fully offline. Falls back to tfjs's
// default online base model only if the local files are missing.
const LOCAL_BASE_MODEL = '/models/speech-commands/model.json'
const LOCAL_BASE_METADATA = '/models/speech-commands/metadata.json'

async function createBaseRecognizer(): Promise<BaseRecognizer> {
  try {
    const head = await fetch(LOCAL_BASE_MODEL, { method: 'HEAD' })
    if (head.ok) {
      // speech-commands rejects root-relative paths for the metadata URL — it
      // requires an absolute http(s) URL. Resolve against the page origin.
      const origin = window.location.origin
      return speechCommands.create(
        'BROWSER_FFT',
        undefined,
        new URL(LOCAL_BASE_MODEL, origin).href,
        new URL(LOCAL_BASE_METADATA, origin).href,
      )
    }
  } catch {
    // No local model bundled — fall through to the online default.
  }
  return speechCommands.create('BROWSER_FFT')
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export class PersonalizedSpeechModel {
  private base: BaseRecognizer | null = null
  private transfer: TransferRecognizer | null = null
  private listening = false
  private desiredListening = false
  private trained = false
  private busy = false
  private collecting = false
  private autoTraining = false
  private targetScore = 0
  private backgroundScore = 0
  private autoTargetExamples = 0
  private autoBackgroundExamples = 0
  private samplesSinceTrain = 0
  private lastTrainAt = 0

  private constructor(private options: PersonalizedSpeechOptions) {}

  static async create(options: PersonalizedSpeechOptions): Promise<PersonalizedSpeechModel> {
    const model = new PersonalizedSpeechModel(options)
    await model.init()
    return model
  }

  async collectTargetExample(): Promise<PersonalizedSpeechStatus> {
    return this.collectExample(TARGET_LABEL, 'target example collected')
  }

  async collectBackgroundExample(): Promise<PersonalizedSpeechStatus> {
    return this.collectExample(BACKGROUND_LABEL, 'background example collected')
  }

  async autoCollectTargetExample(): Promise<PersonalizedSpeechStatus> {
    return this.collectExample(TARGET_LABEL, 'auto Alex sample collected', true)
  }

  async autoCollectBackgroundExample(): Promise<PersonalizedSpeechStatus> {
    return this.collectExample(BACKGROUND_LABEL, 'auto background sample collected', true)
  }

  async train(): Promise<PersonalizedSpeechStatus> {
    if (this.busy) return this.emit('personal model busy')
    const counts = this.countExamples()
    if (
      counts.targetExamples < MIN_EXAMPLES_PER_LABEL ||
      counts.backgroundExamples < MIN_EXAMPLES_PER_LABEL
    ) {
      return this.emit('need at least 3 target and 3 background examples')
    }
    this.busy = true
    try {
      return await this.trainNow('personal model trained')
    } finally {
      this.busy = false
    }
  }

  async start(): Promise<void> {
    this.desiredListening = true
    if (!this.trained) {
      this.emit('personal model waiting for training')
      return
    }
    if (this.listening || this.busy) return
    await this.startActualListening()
  }

  private async startActualListening(): Promise<void> {
    const transfer = this.readyTransfer()
    if (this.listening || !this.trained) return
    this.listening = true
    try {
      await transfer.listen(
        async (result) => {
          const labels = transfer.wordLabels()
          const targetIndex = labels.indexOf(TARGET_LABEL)
          const backgroundIndex = labels.indexOf(BACKGROUND_LABEL)
          const scores = Array.from(result.scores as ArrayLike<number>)
          this.targetScore = Math.round((scores[targetIndex] ?? 0) * 100)
          this.backgroundScore = Math.round((scores[backgroundIndex] ?? 0) * 100)
          this.emit(
            this.targetScore >= this.options.threshold
              ? 'personal target matched'
              : 'personal model listening',
          )
          if (this.targetScore >= this.options.threshold) this.options.onAttempt()
        },
        {
          includeSpectrogram: false,
          invokeCallbackOnNoiseAndUnknown: true,
          overlapFactor: 0.5,
          probabilityThreshold: Math.max(0.01, this.options.threshold / 100),
        },
      )
    } catch (error) {
      this.listening = false
      throw error
    }
    // stop() can be called while listen() is still acquiring the mic — at that
    // point isListening() is false, so the stop is a no-op. Honor the intent
    // now that listening has actually begun, or the recognizer runs untracked.
    if (!this.desiredListening) await this.stopActualListening()
  }

  stop(): void {
    this.desiredListening = false
    void this.stopActualListening()
    this.emit('personal model paused')
  }

  setThreshold(threshold: number): void {
    this.options.threshold = threshold
    this.emit('personal threshold updated')
  }

  status(): PersonalizedSpeechStatus {
    return this.makeStatus('personal model ready')
  }

  private async init(): Promise<void> {
    this.base = await createBaseRecognizer()
    await this.base.ensureModelLoaded()
    this.transfer = this.base.createTransfer(MODEL_NAME)
    this.loadPersistedExamples()
    const counts = this.countExamples()
    const trainable =
      counts.targetExamples >= MIN_EXAMPLES_PER_LABEL &&
      counts.backgroundExamples >= MIN_EXAMPLES_PER_LABEL
    if (trainable) {
      // Train saved examples in the BACKGROUND so create() resolves promptly.
      // On-device training can exceed the session startup timeout; blocking
      // here would make withTimeout reject and orphan the whole model while it
      // keeps training. start() reports "waiting for training" until it lands.
      this.busy = true
      void this.trainNow('saved examples trained')
        .catch((error) => console.warn('Initial personal model training failed:', error))
        .finally(() => {
          this.busy = false
        })
    } else {
      this.emit('collect personal examples')
    }
  }

  private readyTransfer(): TransferRecognizer {
    if (!this.transfer) throw new Error('Personalized speech model is not ready')
    return this.transfer
  }

  private countExamples(): { targetExamples: number; backgroundExamples: number } {
    // speech-commands throws ("No examples have been collected ... yet") rather
    // than returning zeros before the first example exists — the normal
    // first-run state. Treat that as an empty bank so init() doesn't fail and
    // report the whole personal model as "unavailable".
    let counts: Record<string, number> | undefined
    try {
      counts = this.transfer?.countExamples() as Record<string, number> | undefined
    } catch {
      counts = undefined
    }
    return {
      targetExamples: counts?.[TARGET_LABEL] ?? 0,
      backgroundExamples: counts?.[BACKGROUND_LABEL] ?? 0,
    }
  }

  private loadPersistedExamples(): void {
    const raw = localStorage.getItem(EXAMPLES_KEY)
    if (!raw || !this.transfer) return
    try {
      this.transfer.loadExamples(base64ToArrayBuffer(raw), true)
    } catch {
      localStorage.removeItem(EXAMPLES_KEY)
    }
  }

  private persistExamples(): void {
    if (!this.transfer) return
    localStorage.setItem(EXAMPLES_KEY, arrayBufferToBase64(this.transfer.serializeExamples()))
  }

  private async collectExample(
    label: typeof TARGET_LABEL | typeof BACKGROUND_LABEL,
    reason: string,
    auto = false,
  ): Promise<PersonalizedSpeechStatus> {
    const transfer = this.readyTransfer()
    const counts = this.countExamples()
    const countForLabel = label === TARGET_LABEL ? counts.targetExamples : counts.backgroundExamples
    if (countForLabel >= MAX_EXAMPLES_PER_LABEL) {
      return this.emit(label === TARGET_LABEL ? 'Alex sample bank full' : 'background sample bank full')
    }
    if (this.busy) return this.emit('personal model busy')

    this.busy = true
    this.collecting = true
    const restartListening = this.desiredListening
    await this.stopActualListening()
    try {
      await transfer.collectExample(label)
      this.persistExamples()
      this.trained = false
      this.samplesSinceTrain += 1
      if (auto && label === TARGET_LABEL) this.autoTargetExamples += 1
      if (auto && label === BACKGROUND_LABEL) this.autoBackgroundExamples += 1
    } finally {
      this.collecting = false
      this.busy = false
    }

    if (auto) return this.maybeAutoTrain(reason)
    if (restartListening && this.trained) await this.start()
    return this.emit(reason)
  }

  private async maybeAutoTrain(reason: string): Promise<PersonalizedSpeechStatus> {
    const counts = this.countExamples()
    const trainable =
      counts.targetExamples >= MIN_EXAMPLES_PER_LABEL &&
      counts.backgroundExamples >= MIN_EXAMPLES_PER_LABEL
    if (!trainable) return this.emit(`${reason}; need more balanced samples`)

    const now = performance.now()
    const shouldTrain =
      !this.trained ||
      (this.samplesSinceTrain >= AUTO_RETRAIN_EVERY_SAMPLES &&
        now - this.lastTrainAt >= AUTO_RETRAIN_COOLDOWN_MS)
    if (!shouldTrain) {
      if (this.desiredListening && this.trained && !this.listening) {
        await this.startActualListening()
      }
      return this.emit(`${reason}; queued for next train`)
    }

    this.busy = true
    try {
      return await this.trainNow('auto-trained personal model')
    } finally {
      this.busy = false
    }
  }

  private async trainNow(reason: string): Promise<PersonalizedSpeechStatus> {
    const transfer = this.readyTransfer()
    await this.stopActualListening()
    this.autoTraining = true
    this.emit('training personal model')
    try {
      await transfer.train({ epochs: TRAIN_EPOCHS })
      this.trained = true
      this.samplesSinceTrain = 0
      this.lastTrainAt = performance.now()
    } finally {
      this.autoTraining = false
    }
    // Resume listening based on live intent (start() may have been called
    // while we were training in the background).
    if (this.desiredListening) await this.startActualListening()
    return this.emit(reason)
  }

  private async stopActualListening(): Promise<void> {
    this.listening = false
    if (this.transfer?.isListening()) {
      this.transfer.stopListening()
    }
  }

  private makeStatus(reason: string): PersonalizedSpeechStatus {
    const counts = this.countExamples()
    return {
      ready: Boolean(this.transfer),
      listening: this.listening,
      trained: this.trained,
      targetExamples: counts.targetExamples,
      backgroundExamples: counts.backgroundExamples,
      targetScore: this.targetScore,
      backgroundScore: this.backgroundScore,
      threshold: this.options.threshold,
      collecting: this.collecting,
      autoTraining: this.autoTraining,
      autoTargetExamples: this.autoTargetExamples,
      autoBackgroundExamples: this.autoBackgroundExamples,
      samplesSinceTrain: this.samplesSinceTrain,
      reason,
    }
  }

  private emit(reason: string): PersonalizedSpeechStatus {
    const status = this.makeStatus(reason)
    this.options.onStatus?.(status)
    return status
  }
}
