import { executeVMCode } from "helpers/executeVMCode";
import { ActionHandler } from "./ActionFactory";

export class ScoringAction extends ActionHandler {
    public async run(data: any, _requestId: string, _languageData: any) {
        const { textOnMatch, scoreExpression = "" } = this.actionOptions;

        // there is no feedback text, so ignore this action
        if (!textOnMatch) {
            return { data, log: [], code: 0, score: 0 };
        }

        // add the feedback to the data
        data.feedback = data.feedback || [];
        data.feedback.push(textOnMatch);

        //compute grade
        const result = await executeVMCode({
            code: `return ${scoreExpression}`,
            sandbox: { score: data.score },
        });

        // return the updated data
        return { ...result, data };
    }
}
