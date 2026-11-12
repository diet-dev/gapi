import {Logger} from "@dietdev/logger";

/** Корневой логгер gapi; модули берут свои области через logger.child(...). */
export const logger = new Logger({prefix: "gapi"});
