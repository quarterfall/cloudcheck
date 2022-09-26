import { executeVMCode } from "helpers/executeVMCode";
import { ActionHandler } from "./ActionFactory";

export class ExecuteVMCodeAction extends ActionHandler {
    public async run(data: any, _requestId: string, _languageData: any) {
        const { code, expression, external } = this.actionOptions;

        const result = await executeVMCode({
            code,
            sandbox: { qf: data },
            expression,
            external,
        });

        // return the feedback
        return { ...result, data };
    }
}
