import * as uuid from "uuid/v4";

export const getNodeIdentifier = () => uuid().replace(/-/g, "");
