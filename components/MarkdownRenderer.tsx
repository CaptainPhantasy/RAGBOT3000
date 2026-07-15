import type React from "react";
import type { ReactNode } from "react";

interface RenderableLine {
	key: string;
	line: string;
}

const makeRenderableLines = (content: string): RenderableLine[] => {
	const occurrences = new Map<string, number>();
	return content.split("\n").map((line) => {
		const occurrence = occurrences.get(line) ?? 0;
		occurrences.set(line, occurrence + 1);
		return { key: `${line}:${occurrence}`, line };
	});
};

const renderBold = (line: string): ReactNode[] => {
	let offset = 0;
	return line.split("**").map((part, position) => {
		const key = `${offset}:${part}`;
		offset += part.length + 2;
		return position % 2 === 1 ? (
			<strong key={key} className="font-semibold text-slate-800">
				{part}
			</strong>
		) : (
			part
		);
	});
};

// In a real app, use 'react-markdown' or 'markdown-to-jsx'
// This is a simplified renderer for the demo to avoid heavy dependencies in the generated code
export const MarkdownRenderer: React.FC<{ content: string }> = ({
	content,
}) => {
	const lines = makeRenderableLines(content);

	return (
		<div className="space-y-2 text-sm leading-relaxed">
			{lines.map(({ key, line }) => {
				if (line.startsWith("# "))
					return (
						<h1
							key={key}
							className="text-xl font-bold mt-4 mb-2 text-slate-800"
						>
							{line.replace("# ", "")}
						</h1>
					);
				if (line.startsWith("## "))
					return (
						<h2
							key={key}
							className="text-lg font-semibold mt-3 mb-1 text-slate-700"
						>
							{line.replace("## ", "")}
						</h2>
					);
				if (line.startsWith("* ") || line.startsWith("- "))
					return (
						<p key={key} className="ml-4 text-slate-600">
							<span aria-hidden="true">• </span>
							{line.replace(/^[*-] /, "")}
						</p>
					);
				if (/^\d+\. /.test(line))
					return (
						<p key={key} className="ml-4 text-slate-600">
							{line}
						</p>
					);
				if (line.trim() === "")
					return <div key={key} className="h-2" aria-hidden="true" />;

				// Bold handling (simple)
				const parts = line.split("**");
				if (parts.length > 1) {
					return (
						<p key={key} className="text-slate-600">
							{renderBold(line)}
						</p>
					);
				}

				return (
					<p key={key} className="text-slate-600">
						{line}
					</p>
				);
			})}
		</div>
	);
};
