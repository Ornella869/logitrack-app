import { pipeline, env } from '@huggingface/transformers'

// G1L-60: análisis acústico 100% en el navegador. El audio nunca sale del dispositivo.
// Modelo: wav2vec2-base fine-tuneado para reconocimiento de emociones de voz (ONNX,
// compatible con Transformers.js). Salida: NEUTRAL, HAPPY, SAD, ANGRY, DISGUST, FEAR.
// "Alertness" (activación vocal) = NEUTRAL + HAPPY.

env.allowLocalModels = false

const MODEL_ID = 'onnx-community/wav2vec2-base-Speech_Emotion_Recognition-ONNX'

let classifierPromise: Promise<any> | null = null

export type ProgressCb = (pct: number) => void

// Carga (y cachea) el modelo. La primera vez descarga ~95MB (versión cuantizada);
// luego queda en cache del navegador.
export function ensureModel(onProgress?: ProgressCb): Promise<any> {
  if (!classifierPromise) {
    classifierPromise = pipeline('audio-classification', MODEL_ID, {
      dtype: 'q8',
      progress_callback: (data: any) => {
        if (data?.status === 'progress' && typeof data.progress === 'number') {
          onProgress?.(Math.round(data.progress))
        }
      },
    }).catch((e) => {
      // Si falla la carga, permitimos reintentar en la próxima llamada.
      console.error('Error cargando el modelo de análisis de voz:', e)
      classifierPromise = null
      throw e
    })
  }
  return classifierPromise
}

export interface AnalisisVoz {
  neu: number
  hap: number
  sad: number
  ang: number
  rms: number          // energía cruda de la onda (0..~0.3 en la práctica)
  nivelVoz: number     // energía de voz normalizada (dBFS → 0..1)
  aptitudEmocional: number // neutral + alegría (0..1), estado "apto"
  alertness: number    // score final del gate = combinación energía + emoción
  emocionDisponible: boolean
}

// Pesos del score final. La energía (RMS) domina por ser robusta e idioma-independiente;
// la emoción ajusta. Si el modelo de emoción no carga, el gate usa solo la energía.
const W_RMS = 0.6
const W_EMO = 0.4

// Rango de nivel de voz en dBFS (escala logarítmica, perceptual). Mapeamos
// [DB_MIN, DB_MAX] → [0, 1]. dBFS típicos: silencio ~-50, voz baja ~-35,
// voz normal ~-22, voz fuerte ~-12. La escala lineal de RMS saturaba enseguida;
// dBFS discrimina mucho mejor entre hablar bajo y hablar con energía.
const DB_MIN = -45
const DB_MAX = -15

// Híbrido: el gate lo decide la energía de voz (RMS, idioma-independiente).
// La emoción se calcula como dato complementario; si el modelo no carga, igual
// se evalúa por RMS (el gate no depende del modelo).
export async function analizarAudio(blob: Blob): Promise<AnalisisVoz> {
  const arrayBuffer = await blob.arrayBuffer()
  // AudioContext a 16kHz: decodeAudioData resamplea automáticamente a esa tasa.
  const AudioCtx: typeof AudioContext =
    window.AudioContext || (window as any).webkitAudioContext
  const audioCtx = new AudioCtx({ sampleRate: 16000 })
  const decoded = await audioCtx.decodeAudioData(arrayBuffer)
  const samples = decoded.getChannelData(0)
  await audioCtx.close()

  // Energía RMS de la onda: sqrt(promedio de cuadrados).
  let sumSq = 0
  for (let i = 0; i < samples.length; i++) sumSq += samples[i] * samples[i]
  const rms = samples.length ? Math.sqrt(sumSq / samples.length) : 0
  // Pasamos a dBFS y mapeamos al rango [DB_MIN, DB_MAX] → [0, 1].
  const dbfs = 20 * Math.log10(rms + 1e-8)
  const nivelVoz = Math.min(1, Math.max(0, (dbfs - DB_MIN) / (DB_MAX - DB_MIN)))

  // Emoción complementaria (best-effort). El modelo devuelve NEUTRAL/HAPPY/SAD/ANGRY/DISGUST/FEAR.
  let neu = 0, hap = 0, sad = 0, ang = 0, emocionDisponible = false
  try {
    const classifier = await ensureModel()
    const output = (await classifier(samples, { top_k: 6 })) as Array<{ label: string; score: number }>
    const map: Record<string, number> = {}
    for (const o of output) map[o.label.toLowerCase()] = o.score
    neu = map['neutral'] ?? 0
    hap = map['happy'] ?? 0
    sad = map['sad'] ?? 0
    ang = map['angry'] ?? 0
    emocionDisponible = true
  } catch {
    // Sin modelo: el gate sigue funcionando por RMS.
  }

  // Aptitud emocional: predominio de voz neutral/positiva (apto para operar).
  const aptitudEmocional = Math.min(1, neu + hap)
  // Score final: energía (dominante) + emoción. Sin modelo, solo energía.
  const alertness = emocionDisponible
    ? W_RMS * nivelVoz + W_EMO * aptitudEmocional
    : nivelVoz

  return { neu, hap, sad, ang, rms, nivelVoz, aptitudEmocional, alertness, emocionDisponible }
}
