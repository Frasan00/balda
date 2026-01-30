/**
 * A fast JSON stringify function compiled from a schema.
 * This function serializes data to JSON much faster than JSON.stringify()
 * when the data structure is known in advance.
 */
export type FastJsonStringifyFunction = (data: any) => string;

/**
 * The serializer function that can be either a compiled fast-json-stringify
 * or null if no schema was provided (fallback to standard JSON.stringify).
 */
export type SerializerFunction = FastJsonStringifyFunction | null;
