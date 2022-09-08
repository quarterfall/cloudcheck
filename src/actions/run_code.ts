import { runCommand } from "helpers/runCommand";
import { PipelineStepExtraOptions } from "index";
import fs = require("fs");
import location = require("path");

interface RunCodeOptions {
    code: string;
    filePath: string;
    pipedInput?: string;
}

export async function run_code(
    data: any,
    requestId: string,
    options: PipelineStepExtraOptions
): Promise<{ resultData: any; resultLog?: string[]; resultCode: number }> {
    const { language, log } = options;
    const code = (data.code || data.embeddedAnswer || data.answer) as string;

    if (!language || !code) {
        log.push(
            "No programming language or code has been sent in the request body."
        );
        return { resultData: data, resultLog: log, resultCode: 1 };
    }

    const filePath = `./${requestId}/run_code/${language}`;
    fs.mkdirSync(filePath, { recursive: true });

    const outputDict = {
        python: runPython,
        java: runJava,
        c: runCpp,
        cpp: runCpp,
        csharp: runCsharp,
        javascript: runJavascript,
        r: runR,
        go: runGo,
    };

    let outputs = [];
    for (const i of data.inputs) {
        // write input to file
        fs.writeFileSync(`${filePath}/inputs.txt`, i.input);
        // run code and push output to qf object
        const pipedInput = `< ${filePath}/inputs.txt`;

        const { stdout } = await outputDict[language]({
            code,
            filePath,
            pipedInput,
        });
        outputs.push(stdout.replace(/\n+$/, ""));
        // remove input file
        await runCommand(`rm ${filePath}/inputs.txt`);
    }
    data.outputs = outputs;
    return { resultData: data, resultLog: log, resultCode: 0 };
}

async function runPython(options: RunCodeOptions) {
    const { code, filePath, pipedInput } = options;
    console.log(pipedInput);
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

async function runCsharp({ code, filePath }: RunCodeOptions) {
    const path = `${filePath}/Program.cs`;
    if (!fs.existsSync(path)) {
        await runCommand(
            `cp -r ./static/run_code/csharp/csharp.csproj ${filePath}`
        );
        fs.writeFileSync(path, code);
        await runCommand(`cd ${filePath} && dotnet build --nologo`);
    }
    return runCommand(`cd ${filePath} && dotnet run --nologo < ./inputs.txt`);
}

async function runJavascript({ code, filePath, pipedInput }: RunCodeOptions) {
    const path = `${filePath}/code.js`;
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, code);
    }
    return runCommand(`node ${path} ${pipedInput}`);
}

async function runR({ code, filePath, pipedInput }: RunCodeOptions) {
    const path = `${filePath}/code.r`;
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, code);
    }
    return runCommand(`#!/usr/bin/env Rscript ${path} ${pipedInput}`);
}

async function runGo({ code, filePath, pipedInput }: RunCodeOptions) {
    const path = `${filePath}/code.go`;
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, code);
    }
    return runCommand(`go run ${path} ${pipedInput}`);
}
