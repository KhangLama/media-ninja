import { pipeline, env } from "@huggingface/transformers";

// Disable local model search to avoid 404 network requests relative to localhost
env.allowLocalModels = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transcriber: any = null;

interface ProgressData {
  status: string;
  progress?: number;
  file?: string;
}

async function getTranscriber(progressCallback: (data: ProgressData) => void) {
  if (transcriber) return transcriber;

  transcriber = await pipeline(
    "automatic-speech-recognition",
    "onnx-community/whisper-tiny",
    {
      device: "webgpu", // Try WebGPU if available, fallbacks to wasm automatically
      progress_callback: progressCallback,
    }
  );
  return transcriber;
}

self.addEventListener("message", async (event: MessageEvent) => {
  const { audio, language, task } = event.data;

  try {
    const modelTranscriber = await getTranscriber((data: ProgressData) => {
      if (data.status === "progress") {
        self.postMessage({
          status: "loading_progress",
          progress: data.progress,
          file: data.file,
        });
      }
    });

    self.postMessage({ status: "transcribing" });

    // Perform the transcription
    const result = await modelTranscriber(audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      language: language || null,
      task: task || "transcribe",
      return_timestamps: true,
    });

    self.postMessage({
      status: "done",
      result: {
        text: result.text,
        chunks: result.chunks || [],
      },
    });
  } catch (error: unknown) {
    console.error("Worker error:", error);
    self.postMessage({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
