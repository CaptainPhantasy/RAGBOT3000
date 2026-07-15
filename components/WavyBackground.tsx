import { useEffect, useRef, useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { createNoise3D } from "simplex-noise";
import { cn } from "../lib/utils";

const DEFAULT_WAVE_COLORS = [
	"rgba(220, 38, 38, 0.4)",
	"rgba(34, 211, 238, 0.4)",
	"rgba(168, 85, 247, 0.4)",
];

interface WavyBackgroundProps
	extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
	children?: ReactNode;
	containerClassName?: string;
	colors?: string[];
	waveWidth?: number;
	backgroundFill?: string;
	blur?: number;
	speed?: "slow" | "fast";
	waveOpacity?: number;
	analyser?: AnalyserNode | null;
}

const calculateBandLevel = (
	data: Uint8Array,
	start: number,
	end: number,
): number => {
	const boundedStart = Math.max(0, Math.min(start, data.length));
	const boundedEnd = Math.max(boundedStart, Math.min(end, data.length));
	if (boundedStart === boundedEnd) return 0;

	let sum = 0;
	for (let index = boundedStart; index < boundedEnd; index += 1) {
		sum += data[index];
	}
	const average = sum / (boundedEnd - boundedStart) / 255;
	return Math.max(0, average - 0.05) * 1.2;
};

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
}: WavyBackgroundProps) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const bassLevelRef = useRef(0);
	const midLevelRef = useRef(0);
	const trebleLevelRef = useRef(0);
	const targetBassRef = useRef(0);
	const targetMidRef = useRef(0);
	const targetTrebleRef = useRef(0);
	const offsetRef = useRef(0);
	const [isSafari, setIsSafari] = useState(false);

	useEffect(() => {
		if (!analyser) {
			targetBassRef.current = 0;
			targetMidRef.current = 0;
			targetTrebleRef.current = 0;
			return;
		}

		const data = new Uint8Array(analyser.frequencyBinCount);
		const sampleRate = analyser.context?.sampleRate ?? 44_100;
		const binWidth = sampleRate / analyser.fftSize;
		const bassStart = Math.floor(60 / binWidth);
		const bassEnd = Math.floor(300 / binWidth);
		const midEnd = Math.floor(2_000 / binWidth);
		const trebleEnd = Math.floor(8_000 / binWidth);
		let animationId = 0;

		const updateAudioLevels = () => {
			analyser.getByteFrequencyData(data);
			targetBassRef.current =
				calculateBandLevel(data, bassStart, bassEnd) * 1.5;
			targetMidRef.current = calculateBandLevel(data, bassEnd, midEnd) * 1.3;
			targetTrebleRef.current =
				calculateBandLevel(data, midEnd, trebleEnd) * 1.8;
			animationId = requestAnimationFrame(updateAudioLevels);
		};

		updateAudioLevels();
		return () => cancelAnimationFrame(animationId);
	}, [analyser]);

	useEffect(() => {
		const canvas = canvasRef.current;
		const context = canvas?.getContext("2d");
		if (!canvas || !context) return;

		const noise = createNoise3D();
		const waveColors = colors ?? DEFAULT_WAVE_COLORS;
		const timeStep = speed === "slow" ? 0.000414 : 0.0069575;
		let width = 0;
		let height = 0;
		let noiseTime = 0;
		let animationId = 0;

		const resize = () => {
			width = window.innerWidth;
			height = window.innerHeight;
			canvas.width = width;
			canvas.height = height;
			context.filter = `blur(${blur}px)`;
		};

		const drawWave = (
			level: number,
			rate: number,
			yOffset: number,
			color: string,
		) => {
			const voiceMultiplier = analyser ? 1 + level * 4 : 1;
			context.beginPath();
			context.lineWidth = waveWidth ?? 50;
			context.strokeStyle = color;
			for (let x = 0; x < width; x += 5) {
				const y =
					noise(
						(x + offsetRef.current * rate) / 800,
						yOffset,
						noiseTime * rate,
					) *
					100 *
					voiceMultiplier;
				context.lineTo(x, y + height * 0.5);
			}
			context.stroke();
			context.closePath();
		};

		const render = () => {
			bassLevelRef.current +=
				(targetBassRef.current - bassLevelRef.current) * 0.15;
			midLevelRef.current +=
				(targetMidRef.current - midLevelRef.current) * 0.15;
			trebleLevelRef.current +=
				(targetTrebleRef.current - trebleLevelRef.current) * 0.15;
			noiseTime += timeStep;
			offsetRef.current += 2.5;

			context.fillStyle = backgroundFill ?? "black";
			context.globalAlpha = waveOpacity;
			context.fillRect(0, 0, width, height);
			drawWave(
				bassLevelRef.current,
				1,
				0,
				waveColors[0] ?? DEFAULT_WAVE_COLORS[0],
			);
			drawWave(
				midLevelRef.current,
				1.3,
				0.5,
				waveColors[1] ?? DEFAULT_WAVE_COLORS[1],
			);
			drawWave(
				trebleLevelRef.current,
				1.7,
				1.4,
				waveColors[2] ?? DEFAULT_WAVE_COLORS[2],
			);
			animationId = requestAnimationFrame(render);
		};

		resize();
		window.addEventListener("resize", resize);
		render();
		return () => {
			cancelAnimationFrame(animationId);
			window.removeEventListener("resize", resize);
		};
	}, [analyser, backgroundFill, blur, colors, speed, waveOpacity, waveWidth]);

	useEffect(() => {
		setIsSafari(
			navigator.userAgent.includes("Safari") &&
				!navigator.userAgent.includes("Chrome"),
		);
	}, []);

	return (
		<div
			className={cn(
				"h-screen w-full relative overflow-hidden",
				containerClassName,
			)}
		>
			<canvas
				className="absolute inset-0 z-0"
				ref={canvasRef}
				id="canvas"
				style={isSafari ? { filter: `blur(${blur}px)` } : undefined}
			/>
			<div className={cn("absolute inset-0 z-10", className)} {...props}>
				{children}
			</div>
		</div>
	);
};
