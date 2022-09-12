import { ExitCode } from "@quarterfall/core";
import { createPlayground } from "helpers/createPlayground";
import { runScript } from "helpers/runScript";
import { PipelineStepExtraOptions } from "index";
import fs = require("fs");

export async function unit_test(
    data: any,
    requestId: string,
    options: PipelineStepExtraOptions
): Promise<{ resultData: any; resultLog?: string[]; resultCode: number }> {
    let { localPath, log, code } = options;

    await createPlayground({
        localPath,
        requestId,
        log,
    });

    if (fs.existsSync(`./${requestId}/${localPath}/run.sh`)) {
        // write the qf object to a file in the directory
        fs.writeFileSync(
            `./${requestId}/${localPath}/qf.json`,
            JSON.stringify(data || {})
        );

        // run git, with the data in the qf object as environment variables
        console.log(
            `[${requestId}] Running unit test run script at path ${localPath}...`
        );

        code = await runScript({
            script: "./run.sh",
            cwd: `./${requestId}/${localPath}`,
            log,
            env: Object.assign({}, data || {}, process.env),
        });
    } else {
        // there is no run script present
        throw new Error("Unable to run unit test.");
    }

    let resultData = {};

    if (fs.existsSync(`./${requestId}/${localPath}/qf.json`)) {
        // read the updated quarterfall object
        const quarterfallUpdated = fs.readFileSync(
            `./${requestId}/${localPath}/qf.json`
        );
        try {
            resultData = JSON.parse(quarterfallUpdated.toString());
        } catch (error) {
            console.log(error);
            code = ExitCode.InternalError;
        }
    }
    return { resultData, resultCode: code, resultLog: log };
}
