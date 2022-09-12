import express = require("express");
import {
    CloudcheckRequestBody,
    ExitCode,
    generateId,
    PipelineStepOptions,
} from "@quarterfall/core";
import { git } from "actions/git";
import { run_code } from "actions/run_code";
import { unit_test } from "actions/unit_test";
import "dotenv/config";
import { runCommand } from "./helpers/runCommand";
import bodyParser = require("body-parser");

// whether files should be removed from dist folder
const cleanup = true;
let gitCacheCreationDateTime = Date.now();

const app: express.Express = express();

export interface PipelineStepExtraOptions extends PipelineStepOptions {
    log?: string[];
    code?: number;
    localPath?: string;
    gitCacheCreationDateTime?: number;
}

const cloudcheck = async (req: express.Request, res: express.Response) => {
    if (!req.body) {
        res.status(400).send("Missing request body.");
        return;
    }
    let { data, pipeline }: CloudcheckRequestBody = req.body;

    if (!data || !pipeline) {
        res.status(400).send("Missing request body.");
        return;
    }

    // generate a unique request id
    const requestId = generateId({
        length: 24,
        allowed: ["lowercaseLetters", "numbers"],
    });

    const startTime = Date.now();
    console.log(`Cloud check request id: ${requestId}.`);

    let log: string[] = data.log || [];
    let code: number = ExitCode.NoError;

    const runActionDict = {
        run_code,
        unit_test,
        git,
    };

    for (const pipelineStep of pipeline) {
        try {
            const localPath = `/${pipelineStep.action}/${pipelineStep.options.language}`;

            const { resultData, resultLog, resultCode } = await runActionDict[
                pipelineStep.action
            ](data, requestId, {
                ...pipelineStep.options,
                log,
                localPath,
                gitCacheCreationDateTime,
            });

            // Update the qf object, log and exit code
            data = resultData;
            log = resultLog;
            code = resultCode;
        } catch (error) {
            console.log(error);
            log.push(error.message);
            code = ExitCode.InternalError;
        } finally {
            // cleanup
            if (cleanup) {
                await runCommand(`rm -rf ${requestId}*`);
            }
            // send back the data
            const diff = Date.now() - startTime;
            console.log(
                `Completed cloud compile request: ${requestId} [${diff}ms].`
            );
            const statusCode = code === 0 ? 200 : 400;
            res.status(statusCode).send({
                data,
                log: log.map((entry) => entry.trim()),
                code,
            });
        }
    }
};

(async function bootstrap() {
    // parse body of requests as JSON
    app.use(bodyParser.json());

    app.get("/", (_req, res) => res.send("Cloud check server is running."));

    // route definition
    app.post("/", cloudcheck);

    // start the server
    const port = Number(process.env.PORT) || 2700;
    const server = app.listen(port, () => {
        console.log("Cloud check server listening on port", port);
    });

    // graceful shutdown of http server
    const gracefulShutdown = () => {
        server.close(() => {
            console.log("Cloud check server server closed.");
        });
    };

    process.on("SIGINT", gracefulShutdown);
    process.on("SIGTERM", gracefulShutdown);
})();
