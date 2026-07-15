import { spawn } from "node:child_process";

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run this script through npm.");

const children = ["dev:server", "dev:web"].map((script) =>
	spawn(process.execPath, [npmCli, "run", script], { stdio: "inherit" }),
);

let stopping = false;
function stop(signal = "SIGTERM") {
	if (stopping) return;
	stopping = true;
	for (const child of children) child.kill(signal);
}

for (const signal of ["SIGINT", "SIGTERM"])
	process.on(signal, () => stop(signal));
for (const child of children) {
	child.on("exit", (code) => {
		stop();
		process.exitCode = code || 0;
	});
}
