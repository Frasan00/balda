export class BaldaError extends Error {
  constructor(message: string) {
    super(message);
    // `errorFactory` reports `code: error.name`, so subclasses must carry their own
    // name; the Error default ("Error") would collapse every built-in code to one value.
    this.name = new.target.name;
  }
}
