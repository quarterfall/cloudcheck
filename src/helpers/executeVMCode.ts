import { ExitCode, replaceQuotes } from "@quarterfall/core";
import { cleanupLog } from "helpers/cleanupLog";
import { NodeVM, VMScript } from "vm2";
import { RunCodeOptions } from "./codeRunners";
import ts = require("typescript");
import lodash = require("lodash");

interface ExecuteVMCodeOptions extends RunCodeOptions {
    sandbox?: any;
    external?: string[];
    expression?: boolean;
}
export async function executeVMCode(options: ExecuteVMCodeOptions) {
    const {
        code,
        sandbox,
        external = ["axios", "date-fns", "color"],
        expression = false,
    } = options;

    // log
    const log: string[] = [];

    // there is no code, so the result is empty
    if (!code) {
        return { result: null, log, code: ExitCode.NoError };
    }

    const functionWrap = expression
        ? `module.exports = async function() { return ${replaceQuotes(code)}; }`
        : `module.exports = async function() {${replaceQuotes(code)}}`;

    // compile the source code
    const script = new VMScript(ts.transpile(functionWrap));

    // run the code in a sandbox environment
    const vm = new NodeVM({
        console: "redirect",
        sandbox,
        require: {
            external,
        },
        timeout: 30 * 1000,
    });

    // catch console logs, warnings and errors
    const processLogData = (logData: any) => {
        try {
            if (lodash.isString(logData)) {
                log.push(logData);
            } else {
                log.push(JSON.stringify(logData));
            }
        } catch (err) {
            // ignore errors
        }
    };
    vm.on("console.log", processLogData);
    vm.on("console.warn", processLogData);
    vm.on("console.error", processLogData);

    try {
        // run the function
        const func = vm.run(script);
        const result = await func();

        // return the analytics result
        return {
            result,
            log: cleanupLog(log),
            code: ExitCode.NoError,
        };
    } catch (error) {
        log.push(error.toString());
        return {
            result: null,
            log: cleanupLog(log),
            code: ExitCode.InternalError,
        };
    }
}
