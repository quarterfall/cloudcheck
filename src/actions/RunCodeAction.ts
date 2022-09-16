import {
    CloudcheckActionResponse,
    ExitCode,
    supportedLanguagesIOTesting,
} from "@quarterfall/core";

import { runCode } from "helpers/runCode";
import { runJavascript } from "helpers/runJavascript";

import { log } from "helpers/logger";
import { ActionHandler } from "./ActionFactory";
import Handlebars = require("handlebars");

export class RunCodeAction extends ActionHandler {
    public async run(
        data: any,
        requestId: string,
        languageData: any
    ): Promise<CloudcheckActionResponse> {
        const {
            answerEmbedding = "{{answer}}",
            language,
            hideFeedback,
            ioTests = [],
        } = this.actionOptions;

        if (supportedLanguagesIOTesting.indexOf(language) < 0) {
            log.error(
                `Aborting run code action because programming language "${language}" is not supported. Action: ${JSON.stringify(
                    this.actionOptions
                )}. Data: ${JSON.stringify(data)}.`
            );
            return { data, log: [], code: ExitCode.NoError };
        }

        // create the embedded answer
        const replaceFunc = Handlebars.compile(answerEmbedding, {
            noEscape: true,
        });
        data.embeddedAnswer = replaceFunc(data);

        data.ioTests = ioTests;
        data.inputs = ioTests.map((test) => {
            return { input: test.input || "" };
        });
        data.successfulTestCount = 0;
        data.failedTestCount = 0;

        //Run

        const { resultData, resultCode, resultLog } = await runCode(
            data,
            requestId,
            this.actionOptions
        );

        // generate io test feedback if needed
        if (!hideFeedback) {
            // make sure feedback is initialized
            resultData.feedback = resultData.feedback || [];
            resultData.feedback.push(
                `## ${languageData.testResultTitle || "Test result:"}`
            );
            for (const test of ioTests) {
                const description = test.description || test.name;
                // update here
                if (resultCode !== 0) {
                    resultData.feedback.push(
                        `:x: ${
                            languageData.testErrorMessage ||
                            "There was an error while running the tests"
                        }`
                    );
                    break;
                }

                const strSeparator = new Array(test.name.length + 1).join("=");
                resultLog.push(
                    `${strSeparator}\n${test.name}\n${strSeparator}`
                );
                if (test.input) {
                    resultLog.push(`*** Program input: ***\n ${test.input}`);
                }
                resultLog.push(
                    `*** Expected output: *** \n${test.output.replace(
                        /\n+$/,
                        ""
                    )}`
                );
                const { result: ioTestResult } = await runJavascript({
                    code: test.comparisonCode || "",
                    sandbox: {
                        desiredOutput: test.output || "",
                        computedOutput:
                            resultData.outputs[ioTests.indexOf(test)],
                    },
                });
                resultLog.push(
                    `*** Actual output: *** \n${
                        resultData.outputs[ioTests.indexOf(test)]
                    }`
                );
                resultLog.push(
                    `*** TEST ${ioTestResult ? "SUCCESSFUL" : "FAILED"} ***\n`
                );

                if (ioTestResult) {
                    resultData.feedback.push(
                        `:white_check_mark: ${description} **(${
                            languageData.testResultSuccess || "successful"
                        })**`
                    );
                    resultData[test.name] = true;
                    resultData.successfulTestCount += 1;
                } else {
                    resultData.feedback.push(
                        `:x: ${description} **(${
                            languageData.testResultFail || "failed"
                        })**`
                    );
                    resultData[test.name] = false;
                    resultData.failedTestCount += 1;
                }
            }
        }

        // return the feedback
        return { data: resultData, log: resultLog, code: resultCode };
    }
}
