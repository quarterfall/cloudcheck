import { runCommand } from "runScript";
import fs = require("fs");
import location = require("path");

interface RunCodeOptions {
    data: any;
    filePath: string;
    language: string;
    args?: string[];
}

interface ProgrammingLanguageOptions {
    code: string;
    filePath: string;
    args?: string[];
}

export async function runCode(options: RunCodeOptions) {
    const { data, filePath, language, args } = options;
    const code = data.embeddedAnswer || data.answer;
    switch (language) {
        case "python":
            return runPython({ code, filePath, args });
        case "java":
            return runJava({ code, filePath, args });
        case "c":
        case "cpp":
            return runCpp({ code, filePath, args });
        case "csharp":
            return runCsharp({ code, filePath, args });
        case "javascript":
            return runJavascript({ code, filePath });
        default:
            return null;
    }
}

async function runPython({ code, filePath, args }: ProgrammingLanguageOptions) {
    const path = `./${filePath}/code.py`;
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, code);
    }
    return await runCommand(`python3 ${path} ${[...args]}`);
}

async function runJava({ code, filePath, args }: ProgrammingLanguageOptions) {
    const path = `${filePath}/Code.java`;
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, code);
        await runCommand(`javac ./${path}`);
    }
    let mainClassName = "";
    const files = fs.readdirSync(filePath);
    for (let i in files) {
        if (location.extname(files[i]) === ".class") {
            mainClassName = files[i].replace(".class", "");
            break;
        }
    }
    return await runCommand(
        `java -cp ./${filePath}/ ${mainClassName} ${[...args]}`
    );
}

async function runCpp({ code, filePath, args }: ProgrammingLanguageOptions) {
    const path = `${filePath}/code.cpp`;
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, code);
        await runCommand(`g++ -o ./${filePath}/runCode ./${path}`);
    }
    return await runCommand(`./${filePath}/runCode ${[...args]}`);
}

async function runCsharp({ code, filePath }: ProgrammingLanguageOptions) {
    const path = `./${filePath}/Program.cs`;
    if (!fs.existsSync(path)) {
        await runCommand(
            `cp -r ./static/iotest/csharp/csharp.csproj ${filePath}`
        );
        fs.writeFileSync(path, code);
    }
    return await runCommand(
        `cd ${filePath} && dotnet run --nologo < ./inputs.txt`
    );
}

async function runJavascript({ code, filePath }: ProgrammingLanguageOptions) {
    const path = `./${filePath}/code.js`;
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, code);
    }
    return await runCommand(`node ${path}`);
}
