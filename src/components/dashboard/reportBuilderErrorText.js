import { normalizeServiceErrorText } from "../../utils/errorText.js";

export function normalizeReportBuilderErrorText(error = null) {
    return normalizeServiceErrorText(error, { serviceLabel: "reporting service" });
}
