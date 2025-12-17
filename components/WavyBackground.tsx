import { useEffect, useRef, useState } from "react"
import { createNoise3D } from "simplex-noise"
import { cn } from "../lib/utils"

export const WavyBackground = ({
  children,
  className,
  containerClassName,
  colors,
  waveWidth,
  backgroundFill,
  blur = 5,
  speed = "fast",
  waveOpacity = 0.8,
  analyser,
  ...props
}: {
  children?: any
  className?: string
  containerClassName?: string
  colors?: string[]
  waveWidth?: number
  backgroundFill?: string
  blur?: number
  speed?: "slow" | "fast"
  waveOpacity?: number
  analyser?: AnalyserNode | null
  [key: string]: any
}) => {
  const noise = createNoise3D()
  let w: number, h: number, nt: number, x: number, ctx: any, canvas: any
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bassLevelRef = useRef<number>(0)
  const midLevelRef = useRef<number>(0)
  const trebleLevelRef = useRef<number>(0)
  const targetBassRef = useRef<number>(0)
  const targetMidRef = useRef<number>(0)
  const targetTrebleRef = useRef<number>(0)
  const offsetRef = useRef<number>(0)
  const animationIdRef = useRef<number>(0)

  const getSpeed = () => {
    switch (speed) {
      case "slow":
        return 0.000414
      case "fast":
        return 0.0069575
      default:
        return 0.00069575
    }
  }

  // Use external analyser for audio levels
  useEffect(() => {
    if (!analyser) return

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    let rafId: number
    
    // Calculate frequency bin indices for voice-appropriate bands
    // Assuming ~44100Hz sample rate: each bin = sampleRate / fftSize ≈ 86Hz
    // Bass: 60-300Hz (voice fundamentals) - bins 1-4
    // Mid: 300-2000Hz (main formants, clarity) - bins 4-23  
    // Treble: 2000-8000Hz (sibilants, presence) - bins 23-93
    const sampleRate = analyser.context?.sampleRate || 44100
    const binWidth = sampleRate / (analyser.fftSize || 512)
    
    const bassStart = Math.floor(60 / binWidth)
    const bassEnd = Math.floor(300 / binWidth)
    const midEnd = Math.floor(2000 / binWidth)
    const trebleEnd = Math.floor(8000 / binWidth)

    const updateAudioLevel = () => {
      analyser.getByteFrequencyData(dataArray)

      // Extract frequency bands with proper voice ranges
      const bassData = dataArray.slice(bassStart, bassEnd)
      const midData = dataArray.slice(bassEnd, midEnd)
      const trebleData = dataArray.slice(midEnd, trebleEnd)

      // Calculate averages with minimum thresholds to reduce noise
      const calcLevel = (data: Uint8Array) => {
        if (data.length === 0) return 0
        const sum = data.reduce((a, b) => a + b, 0)
        const avg = sum / data.length / 255
        return Math.max(0, avg - 0.05) * 1.2 // Noise gate + boost
      }

      targetBassRef.current = calcLevel(bassData) * 1.5   // Boost bass visibility
      targetMidRef.current = calcLevel(midData) * 1.3     // Boost mid
      targetTrebleRef.current = calcLevel(trebleData) * 1.8 // Boost treble (usually quieter)

      rafId = requestAnimationFrame(updateAudioLevel)
    }

    updateAudioLevel()

    return () => {
      cancelAnimationFrame(rafId)
    }
  }, [analyser])

  const waveColors = colors ?? [
    "rgba(220, 38, 38, 0.4)",
    "rgba(34, 211, 238, 0.4)",
    "rgba(168, 85, 247, 0.4)",
  ]

  const drawWave = () => {
    // Smooth interpolation - faster response for more reactive feel
    bassLevelRef.current += (targetBassRef.current - bassLevelRef.current) * 0.25
    midLevelRef.current += (targetMidRef.current - midLevelRef.current) * 0.25
    trebleLevelRef.current += (targetTrebleRef.current - trebleLevelRef.current) * 0.25

    nt += getSpeed()
    offsetRef.current += 2.5

    const waves = [
      { level: bassLevelRef.current, speed: 1.0, yOffset: 0.3, color: waveColors[0], baseAmp: 80 },
      { level: midLevelRef.current, speed: 1.3, yOffset: 0.5, color: waveColors[1], baseAmp: 100 },
      { level: trebleLevelRef.current, speed: 1.7, yOffset: 0.7, color: waveColors[2], baseAmp: 60 },
    ]

    waves.forEach((wave, i) => {
      // More dramatic voice response: base amplitude + level-based boost
      const voiceMultiplier = analyser ? 1 + wave.level * 6 : 1
      const amplitude = wave.baseAmp * voiceMultiplier

      ctx.beginPath()
      ctx.lineWidth = (waveWidth || 50) * (1 + wave.level * 0.5) // Line gets thicker with level
      ctx.strokeStyle = wave.color

      for (x = 0; x < w; x += 5) {
        const y = noise(
          (x + offsetRef.current * wave.speed) / 800, 
          wave.yOffset * i, 
          nt * wave.speed
        ) * amplitude
        ctx.lineTo(x, y + h * 0.5)
      }

      ctx.stroke()
      ctx.closePath()
    })
  }

  useEffect(() => {
    canvas = canvasRef.current
    if (!canvas) return
    ctx = canvas.getContext("2d")
    w = ctx.canvas.width = window.innerWidth
    h = ctx.canvas.height = window.innerHeight
    ctx.filter = `blur(${blur}px)`
    nt = 0
    
    const handleResize = () => {
      if (!ctx) return
      w = ctx.canvas.width = window.innerWidth
      h = ctx.canvas.height = window.innerHeight
      ctx.filter = `blur(${blur}px)`
    }
    
    window.addEventListener('resize', handleResize)
    
    const renderLoop = () => {
      if (!ctx) return
      ctx.fillStyle = backgroundFill || "black"
      ctx.globalAlpha = waveOpacity || 0.3
      ctx.fillRect(0, 0, w, h)
      drawWave()
      animationIdRef.current = requestAnimationFrame(renderLoop)
    }
    
    renderLoop()
    
    return () => {
      cancelAnimationFrame(animationIdRef.current)
      window.removeEventListener('resize', handleResize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blur, backgroundFill, waveOpacity])

  const [isSafari, setIsSafari] = useState(false)
  useEffect(() => {
    setIsSafari(
      typeof window !== "undefined" &&
        navigator.userAgent.includes("Safari") &&
        !navigator.userAgent.includes("Chrome"),
    )
  }, [])

  return (
    <div className={cn("h-screen flex flex-col items-center justify-center", containerClassName)}>
      <canvas
        className="absolute inset-0 z-0"
        ref={canvasRef}
        style={{
          ...(isSafari ? { filter: `blur(${blur}px)` } : {}),
        }}
      ></canvas>
      <div className={cn("relative z-10", className)} {...props}>
        {children}
      </div>
    </div>
  )
}
