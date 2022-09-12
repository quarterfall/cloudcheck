import { ExitCode } from "@quarterfall/core";
import { createPlayground } from "helpers/createPlayground";
import { runScript } from "helpers/runScript";
import { PipelineStepExtraOptions } from "index";
import fs = require("fs");

export async function git(
    data: any,
    requestId: string,
    options: PipelineStepExtraOptions
): Promise<{ resultData: any; resultLog?: string[]; resultCode: number }> {
    let {
        gitUrl,
        gitBranch,
        gitPrivateKey,
        gitCacheCreationDateTime,
        gitPath,
        localPath,
        log,
        code,
    } = options;

    await createPlayground({
        gitUrl,
        gitBranch,
        gitPath,
        gitPrivateKey,
        gitCacheCreationDateTime,
        requestId,
        localPath,
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
            `[${requestId}] Running git script at localPath ${localPath}...`
        );
        code = await runScript({
            script: "./run.sh",
            cwd: `./${requestId}/${localPath}`,
            log,
            env: Object.assign({}, data || {}, process.env),
        });
    } else {
        // there is no run script present
        throw new Error("Unable to run git action.");
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
