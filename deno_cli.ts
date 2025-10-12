const command = new Deno.Command("node", {
  args: ["lib/cli.js", ...Deno.args],
  stdout: "piped",
  stderr: "piped",
});

const { code, stdout, stderr } = await command.output();

console.log("Exit code:", code);

const stderrText = new TextDecoder().decode(stderr);
if (stderrText) {
  console.error("stderr:", stderrText);
}

const stdoutText = new TextDecoder().decode(stdout);
if (stdoutText) {
  console.log("stdout:", stdoutText);
} else {
  console.log("No output from command");
}

export {};
