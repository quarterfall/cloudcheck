import { ExitCode, ProgrammingLanguage } from "@quarterfall/core";
import { runCommand } from "helpers/runCommand";
import { runJavascript } from "helpers/runJavascript";
import { PipelineStepExtraOptions } from "index";
import fs = require("fs");
import location = require("path");

export interface RunCodeOptions {
    code: string;
    filePath?: string;
    pipedInput?: string;
}

export async function runCode(
    data: any,
    requestId: string,
    options: PipelineStepExtraOptions
): Promise<{ resultData: any; resultLog?: string[]; resultCode: number }> {
    const {
        language,
        log = [],
        expression,
        external,
        inputs = [{ input: "" }],
    } = options;
    const code = options.code || data.embeddedAnswer || data.answer;

    if (!code) {
        log.push(
            "No programming language or code has been sent in the request body."
        );
        return {
            resultData: data,
            resultLog: log,
            resultCode: ExitCode.UserError,
        };
    }

    const filePath = `./${requestId}/run_code/${language}`;
    fs.mkdirSync(filePath, { recursive: true });

    let outputs = [];

    for (const i of inputs) {
        if (language === ProgrammingLanguage.javascript) {
            const sandbox = {
                ...options?.sandbox,
                input: () => i.input,
            };
            const result = await runJavascript({
                code,
                filePath,
                sandbox,
                external,
                expression,
            });
            outputs.push(result.result.replace(/\n+$/, ""));
        } else {
            const codeRunners = {
                python: runPython,
                java: runJava,
                c: runCpp,
                cpp: runCpp,
                csharp: runCsharp,
                r: runR,
                go: runGo,
            };

            // write input to file
            fs.writeFileSync(`${filePath}/inputs.txt`, i.input);
            // run code and push output to qf object
            const pipedInput = `< ${filePath}/inputs.txt`;

            let { stdout } = await codeRunners[language]({
                code,
                filePath,
                pipedInput,
            });

            // in R, the standard output print the line number so we need to delete that
            if (language === ProgrammingLanguage.r) {
                stdout = stdout.replace(/\[.*]\s/i, "");
            }

            outputs.push(stdout.replace(/\n+$/, ""));
            // remove input file
            await runCommand(`rm ${filePath}/inputs.txt`);
        }
    }
    data.outputs = outputs;
    return { resultData: data, resultLog: log, resultCode: 0 };
}

async function runPython(options: RunCodeOptions) {
    const { code, filePath, pipedInput } = options;
    const path = `${filePath}/code.py`;
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, code);
    }
    return runCommand(`python3 ${path} ${pipedInput}`);
}

async function runJava(options: RunCodeOptions) {
    const { code, filePath, pipedInput } = options;
    const path = `${filePath}/Code.java`;
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, code);
        await runCommand(`javac ${path}`);
    }
    // Java runner requires a main classname
    let mainClassName = "";
    const files = fs.readdirSync(filePath);
    for (let i in files) {
        if (location.extname(files[i]) === ".class") {
            mainClassName = files[i].replace(".class", "");
            break;
        }
    }
    return runCommand(`java -cp ${filePath} ${mainClassName} ${pipedInput}`);
}

async function runCpp({ code, filePath, pipedInput }: RunCodeOptions) {
    const path = `${filePath}/code.cpp`;
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, code);
        await runCommand(`g++ -o ${filePath}/runCode ${path}`);
    }
    return runCommand(`${filePath}/runCode ${pipedInput}`);
}

async function runCsharp({ code, filePath, pipedInput }: RunCodeOptions) {
    const path = `${filePath}/Program.cs`;
    pipedInput = pipedInput.replace(filePath, ".");
    if (!fs.existsSync(path)) {
        await runCommand(
            `cp -r ./static/run_code/csharp/csharp.csproj ${filePath}`
        );
        fs.writeFileSync(path, code);
        await runCommand(`cd ${filePath} && dotnet build --nologo`);
    }
    return runCommand(`cd ${filePath} && dotnet run --nologo ${pipedInput}`);
}

async function runR({ code, filePath, pipedInput }: RunCodeOptions) {
    const path = `${filePath}/code.r`;
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, code);
    }
    return runCommand(`Rscript ${path} ${pipedInput}`);
}

async function runGo({ code, filePath, pipedInput }: RunCodeOptions) {
    const path = `${filePath}/code.go`;
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, code);
    }
    return runCommand(`go run ${path} ${pipedInput}`);
}
