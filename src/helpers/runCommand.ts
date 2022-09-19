import { exec, ExecOptions } from "child_process";

export async function runCommand(
    command: string,
    options?: ExecOptions
): Promise<{ stdout: string; stderr: string }> {
    options = Object.assign(
        {
            timeout: 90 * 1000, // maximum time the script is allowed to run (default 30 seconds)
        },
        options
    );
    return new Promise((resolve, reject) => {
        exec(command, options, (error, stdout, stderr) => {
            if (error) {
                console.log(error);
                reject(error);
            }
            resolve({ stdout, stderr });
        });
    });
}
