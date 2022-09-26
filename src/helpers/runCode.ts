import { ExitCode, ProgrammingLanguage } from "@quarterfall/core";
import { runCommand } from "helpers/runCommand";
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
): Promise<{ data: any; log?: string[]; code: number }> {
    const { language, inputs = [{ input: "" }] } = options;
    const codeSnippet = options.code || data.embeddedAnswer || data.answer;

    let code = ExitCode.NoError;
    let log: string[] = [];

    if (!codeSnippet) {
        log.push(
            "No programming language or code has been sent in the request body."
        );
        return {
            data,
            log,
            code: ExitCode.InternalError,
        };
    }

    const filePath = `./${requestId}/run_code/${language}`;
    fs.mkdirSync(filePath, { recursive: true });

    let outputs = [];

    for (const i of inputs) {
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

        let {
            result,
            log: exitLog,
            code: exitCode,
        }: {
            result: string;
            log: string[];
            code: ExitCode;
        } = await codeRunners[language]({
            code: codeSnippet,
            filePath,
            pipedInput,
        });

        // in R, the standard output print the line number so we need to delete that
        if (language === ProgrammingLanguage.r) {
            result = result?.replace(/\[.*]\s/i, "").replace(/['"]+/g, "");
        }

        code = exitCode;
        log.push(...exitLog);

        outputs.push(result?.replace(/\n+$/, ""));
        // remove input file
        await runCommand(`rm ${filePath}/inputs.txt`);
    }
    data.outputs = outputs;
    return { data, log, code };
}

async function runPython(options: RunCodeOptions) {
    const { code, filePath, pipedInput } = options;
    const path = `${filePath}/code.py`;
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, code);
    }
    return transformDataShape(
        await runCommand(`python3 ${path} ${pipedInput}`)
    );
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
    return transformDataShape(
        await runCommand(`java -cp ${filePath} ${mainClassName} ${pipedInput}`)
    );
}

async function runCpp({ code, filePath, pipedInput }: RunCodeOptions) {
    const path = `${filePath}/code.cpp`;
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, code);
        await runCommand(`g++ -o ${filePath}/runCode ${path}`);
    }
    return transformDataShape(
        await runCommand(`${filePath}/runCode ${pipedInput}`)
    );
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
    return transformDataShape(
        await runCommand(`cd ${filePath} && dotnet run --nologo ${pipedInput}`)
    );
}

async function runR({ code, filePath, pipedInput }: RunCodeOptions) {
    const path = `${filePath}/code.r`;
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, code);
    }
    return transformDataShape(
        await runCommand(`Rscript ${path} ${pipedInput}`)
    );
}

async function runGo({ code, filePath, pipedInput }: RunCodeOptions) {
    const path = `${filePath}/code.go`;
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, code);
    }
    return transformDataShape(await runCommand(`go run ${path} ${pipedInput}`));
}

function transformDataShape({
    stdout,
    stderr,
    exitCode,
}: {
    stdout?: string;
    stderr?: string;
    exitCode?: ExitCode;
}): { result: string; log: string[]; code: ExitCode } {
    let log: string[] = [];
    let code = exitCode || ExitCode.NoError;

    if (stderr) {
        console.log(stderr);
        log.push(stderr.toString());
    }

    return { result: stdout || "", log, code };
}
