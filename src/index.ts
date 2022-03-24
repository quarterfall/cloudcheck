import express = require("express");
import "dotenv/config";
import { runCode } from "runCode";
import { runCommand, runScript } from "./runScript";
import fs = require("fs");
import bodyParser = require("body-parser");

// whether files should be removed from dist folder
const cleanup = true;

const app: express.Express = express();

function generateRequestId(length = 24): string {
    const chars = "abcdefghijklmnopqrstuvwxyz";
    let str = "";
    for (let i = 0; i < length; i += 1) {
        str += chars[Math.floor(Math.random() * chars.length)];
    }
    return str;
}

async function createPlayground(options: {
    gitUrl: string;
    gitBranch: string;
    gitPrivateKey?: string;
    path: string;
    requestId: string;
    log: string[];
}) {
    const {
        gitUrl,
        gitBranch = "master",
        gitPrivateKey,
        path,
        requestId,
        log,
    } = options;

    if (!gitUrl) {
        console.log(`[${requestId}] Making local path copy...`);
        // we're dealing with a local path
        const localPath = `static/${path}`;
        if (!fs.existsSync(localPath)) {
            throw new Error(`No local path ${path} found.`);
        }
        // copy the local folder to the playground
        fs.mkdirSync(`${requestId}/${path}`, { recursive: true });
        await runCommand(`cp -r ${localPath}/. ${requestId}/${path}`);

        // done!
        return;
    }

    console.log(`[${requestId}] Retrieving git repository...`);
    let command = `git clone -b ${gitBranch} --depth=1 ${gitUrl} ${requestId}`;
    if (gitPrivateKey) {
        // add missing LF if needed
        let keyData = gitPrivateKey;
        if (!/[\r\n]$/.test(keyData)) {
            keyData += "\n";
        }
        // create a file containing the private key
        const keyFilename = `./${requestId}_id_rsa`;
        fs.writeFileSync(keyFilename, keyData, { mode: 0o600 });
        // add the private key to the git command
        command = `GIT_SSH_COMMAND='ssh -i ${keyFilename}' ${command}`;
    }
    await runCommand(command);

    // run the install script
    if (fs.existsSync(`./${requestId}/${path}/install.sh`)) {
        // run the install script
        console.log(`[${requestId}] Running install script...`);
        await runScript({
            script: `./install.sh`,
            cwd: `./${requestId}/${path}`,
            log,
        });
    } else {
        // there is no install script present
        log.push("No install script was run.");
    }
}

const cloudCheck = async (req: express.Request, res: express.Response) => {
    // verify that there is a request body and that it contains the required data
    if (!req.body) {
        res.status(400).send("Missing request body.");
        return;
    }

    const { gitUrl, gitBranch, gitPrivateKey, data } = req.body;
    const path = (req.body.path || ".").replace(/^\/+|\/+$/g, ""); // set default path and remove leading and trailing slashes

    // generate a unique request id
    const requestId = generateRequestId();
    const startTime = Date.now();
    console.log(`Cloud check request id: ${requestId}.`);

    const log: string[] = data.log || [];

    try {
        // prepare the cloud check playground
        await createPlayground({
            gitUrl,
            gitBranch,
            gitPrivateKey,
            path,
            requestId,
            log,
        });

        // run the cloud check script
        let code;

        if (fs.existsSync(`./${requestId}/${path}/run.sh`)) {
            // write the qf object to a file in the directory
            fs.writeFileSync(
                `./${requestId}/${path}/qf.json`,
                JSON.stringify(data || {})
            );

            // run the cloud check script, with the data in the qf object as environment variables
            console.log(
                `[${requestId}] Running cloud check script at path ${path}...`
            );
            code = await runScript({
                script: "./run.sh",
                cwd: `./${requestId}/${path}`,
                log,
                env: Object.assign({}, data || {}, process.env),
            });
        } else {
            // there is no run script present
            throw new Error("Unable to run Cloud check script.");
        }

        let resultData = {};

        if (fs.existsSync(`./${requestId}/${path}/qf.json`)) {
            // read the updated quarterfall object
            const quarterfallUpdated = fs.readFileSync(
                `./${requestId}/${path}/qf.json`
            );
            try {
                resultData = JSON.parse(quarterfallUpdated.toString());
            } catch (error) {
                console.log(error);
            }
        }

        // cleanup
        if (cleanup) {
            await runCommand(`rm -rf ${requestId}*`);
        }
        // send back the data
        const diff = Date.now() - startTime;
        console.log(
            `Completed cloud compile request: ${requestId} [${diff}ms].`
        );
        res.send({
            data: resultData,
            log: log.map((entry) => entry.trim()),
            code,
        });
    } catch (error) {
        console.log(error);
        log.push(error.message);

        // cleanup
        if (cleanup) {
            await runCommand(`rm -rf ${requestId}*`);
        }

        res.send({
            data,
            log: log.map((entry) => entry.trim()),
            code: 1,
        });
    }
};

const ioTest = async (req: express.Request, res: express.Response) => {
    // verify that there is a request body and that it contains the required data
    if (!req.body) {
        res.status(400).send("Missing request body.");
        return;
    }
    const { data } = req.body;
    let path = (req.body.path || ".").replace(/^\/+|\/+$/g, "");

    // generate a unique request id
    const requestId = generateRequestId();
    const startTime = Date.now();
    console.log(`Cloud check request id: ${requestId}.`);
    const log: string[] = data.log || [];
    // copy the local folder to the playground
    const filePath = `${requestId}/${path}`;
    fs.mkdirSync(filePath, { recursive: true });

    let outputs = [];
    try {
        for (const i of data.inputs) {
            // write input to file
            let fileInput = i.input
                .split(",")
                .map((item: string) => item.trim())
                .join("\n");
            fs.writeFileSync(`./${filePath}/inputs.txt`, fileInput);

            // run code and push output to qf object
            const { stdout } = await runCode({
                data,
                filePath,
                language: path,
                args: [`< ./${filePath}/inputs.txt`],
            });
            outputs.push(stdout.replace(/(\r\n|\n|\r)/gm, ""));
            // remove input file
            await runCommand(`rm ./${filePath}/inputs.txt`);
        }
        data.outputs = outputs;
        // cleanup
        if (cleanup) {
            await runCommand(`rm -rf ${requestId}*`);
        }
        // send back the data
        const diff = Date.now() - startTime;
        console.log(
            `Completed cloud compile request: ${requestId} [${diff}ms].`
        );
        res.send({
            data,
            log: log.map((entry) => entry.trim()),
            code: 0,
        });
    } catch (error) {
        console.log(error);
        log.push(error.message);

        // cleanup
        if (cleanup) {
            await runCommand(`rm -rf ${requestId}*`);
        }

        res.send({
            data,
            log: log.map((entry) => entry.trim()),
            code: 1,
        });
    }
};

(async function bootstrap() {
    // parse body of requests as JSON
    app.use(bodyParser.json());

    app.get("/", (req, res) => res.send("CloudCheck server is running."));

    // route definition
    app.post("/", cloudCheck);
    app.post("/ioTest", ioTest);

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
