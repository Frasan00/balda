/**
 * The next function.
 * This is the function that is passed to the handler function.
 * It has a pointer to the next middleware or handler function.
 */
export type NextFunction = () => void | Promise<void>;
