export interface LogFields {
  [key: string]: any;
}

export const logger = {
  info(msg: string, fields?: LogFields) {
    console.log(
      JSON.stringify({
        level: "info",
        ts: new Date().toISOString(),
        msg,
        ...fields,
      })
    );
  },
  error(msg: string, err?: any, fields?: LogFields) {
    const errFields: LogFields = {};
    if (err instanceof Error) {
      errFields.error = err.message;
      errFields.stack = err.stack;
    } else if (err !== undefined) {
      errFields.error = String(err);
    }
    console.error(
      JSON.stringify({
        level: "error",
        ts: new Date().toISOString(),
        msg,
        ...errFields,
        ...fields,
      })
    );
  },
  warn(msg: string, fields?: LogFields) {
    console.warn(
      JSON.stringify({
        level: "warn",
        ts: new Date().toISOString(),
        msg,
        ...fields,
      })
    );
  },
};
