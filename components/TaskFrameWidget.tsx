import type React from "react";
import { Mode, type TaskFrame } from "../types";

interface TaskFrameWidgetProps {
	frame: TaskFrame | null;
}

export const TaskFrameWidget: React.FC<TaskFrameWidgetProps> = ({ frame }) => {
	if (!frame) {
		return (
			<div className="p-4 bg-slate-50 rounded-lg border border-slate-200 border-dashed text-center">
				<p className="text-xs text-slate-400">Waiting for user input...</p>
			</div>
		);
	}

	const modeColors = {
		[Mode.TEACH]: "bg-indigo-100 text-indigo-700 border-indigo-200",
		[Mode.GUIDE]: "bg-emerald-100 text-emerald-700 border-emerald-200",
		[Mode.RESCUE]: "bg-amber-100 text-amber-700 border-amber-200",
	};
	const constraintOccurrences = new Map<string, number>();

	return (
		<div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
			<div className="flex items-center justify-between mb-3">
				<h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
					Active Task Frame
				</h3>
				<span
					className={`text-xs px-2 py-1 rounded-full font-medium border ${modeColors[frame.mode]}`}
				>
					{frame.mode} Mode
				</span>
			</div>

			<div className="space-y-3">
				<div>
					<p className="text-[10px] text-slate-400 font-bold uppercase">Goal</p>
					<p className="text-sm text-slate-800 font-medium leading-tight">
						{frame.goal}
					</p>
				</div>

				{frame.constraints.length > 0 && (
					<div>
						<p className="text-[10px] text-slate-400 font-bold uppercase">
							Constraints
						</p>
						<div className="flex flex-wrap gap-1 mt-1">
							{frame.constraints.map((constraint) => {
								const occurrence = constraintOccurrences.get(constraint) ?? 0;
								constraintOccurrences.set(constraint, occurrence + 1);
								return (
									<span
										key={`${constraint}:${occurrence}`}
										className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200"
									>
										{constraint}
									</span>
								);
							})}
						</div>
					</div>
				)}

				{frame.intent && (
					<div>
						<p className="text-[10px] text-slate-400 font-bold uppercase">
							Detected Intent
						</p>
						<p className="text-xs text-slate-500 italic">{frame.intent}</p>
					</div>
				)}
			</div>
		</div>
	);
};
