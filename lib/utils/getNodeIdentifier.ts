import uuid from "uuid";

export const getNodeIdentifier = () => uuid.v4().replace(/-/g, "");
