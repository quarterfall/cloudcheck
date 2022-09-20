import { CloudcheckActionResponse } from "@quarterfall/core";
import { runJavascript } from "helpers/runJavascript";
import { ActionHandler } from "./ActionFactory";

export class QFAction extends ActionHandler {
    public async run(
        data: any,
        requestId: string,
        languageData: any
    ): Promise<CloudcheckActionResponse> {
        const { code } = this.actionOptions;

        const result = await runJavascript({
            code,
            sandbox: {
                qf: data,
            },
        });

        return { ...result, data };
    }
}
