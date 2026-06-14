// Mic capture with the browser's audio "cleanup" disabled. Noise suppression
// is trained to delete exactly the quiet, non-speech-like vocalizations we
// want to catch, so it must stay off. Echo cancellation is unnecessary
// because audio attempt firing is paused while the app speaks (gating).
export async function getMicStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      noiseSuppression: false,
      echoCancellation: false,
      autoGainControl: false, // try true only if his sounds are very faint
      channelCount: 1,
      sampleRate: 16000,
    },
  })
}

export async function getCameraStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
  })
}
