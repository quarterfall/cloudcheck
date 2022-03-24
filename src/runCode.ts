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
        case "cpp":
            return runCpp({ code, filePath, args });
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
    if (!fs.existsSync(`${filePath}/Code.java`)) {
        fs.writeFileSync(`${filePath}/Code.java`, code);
        await runCommand(`javac ./${filePath}/Code.java`);
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
    if (!fs.existsSync(`${filePath}/code.cpp`)) {
        fs.writeFileSync(`${filePath}/code.cpp`, code);
        await runCommand(`g++ -o runCode ./${filePath}/code.cpp`);
    }
    return await runCommand(`./${filePath}/runCode ${[...args]}`);
}
