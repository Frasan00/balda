import type { GraphQLSchema } from "graphql";
import type { createSchema, createYoga } from "graphql-yoga";
import type {
  GraphQLContext,
  GraphQLOptions,
  GraphQLResolverMap,
  GraphQLResolvers,
  GraphQLResolverType,
  GraphQLTypeDef,
} from "src/graphql/graphql_types";

export type { GraphQLContext };

export class GraphQL {
  private schemaOptions: Parameters<typeof createSchema>[0];
  private yogaOptions: Parameters<typeof createYoga>[0];
  isEnabled: boolean;

  constructor(options?: GraphQLOptions) {
    const config = this.initializeConfiguration(options);
    this.schemaOptions = config.schemaOptions;
    this.yogaOptions = config.yogaOptions;
    this.isEnabled = config.isEnabled;
  }

  getSchema(createSchemaFn: typeof createSchema): GraphQLSchema {
    return createSchemaFn(this.schemaOptions);
  }

  getYogaOptions(): Parameters<typeof createYoga>[0] {
    return this.yogaOptions;
  }

  /**
   * Add a type definition to the schema
   */
  addTypeDef(typeDef: GraphQLTypeDef): void {
    const isFunction = typeof typeDef === "function";
    if (isFunction) {
      this.addTypeDef(typeDef());
      return;
    }

    const isArray = Array.isArray(typeDef);
    if (isArray) {
      this.addTypeDefArray(typeDef);
      return;
    }

    this.ensureTypeDefsArray();
    (this.schemaOptions.typeDefs as unknown[]).push(typeDef);
  }

  /**
   * Add a resolver to the schema
   * @param type - The resolver type (Query, Mutation, Subscription, or a custom type name)
   * @param resolvers - An object mapping field names to resolver functions, or a full resolver object
   */
  addResolver(type: GraphQLResolverType, resolvers: GraphQLResolverMap): void;
  addResolver(resolver: GraphQLResolvers): void;
  addResolver(type: string, resolvers: GraphQLResolverMap): void;
  addResolver(
    typeOrResolver: GraphQLResolverType | GraphQLResolvers | string,
    resolvers?: GraphQLResolverMap,
  ): void {
    const isStringType = typeof typeOrResolver === "string" && resolvers;
    if (isStringType) {
      this.addResolverByType(typeOrResolver, resolvers);
      return;
    }

    this.addFullResolver(typeOrResolver as GraphQLResolvers);
  }

  private initializeConfiguration(options?: GraphQLOptions) {
    const hasNoOptions = !options;
    if (hasNoOptions) {
      return this.createDisabledConfiguration();
    }
    return this.createEnabledConfiguration(options);
  }

  private createDisabledConfiguration() {
    return {
      schemaOptions: {
        typeDefs: ``,
        resolvers: {},
      },
      yogaOptions: {},
      isEnabled: false,
    };
  }

  private createEnabledConfiguration(options: GraphQLOptions) {
    return {
      schemaOptions: this.resolveSchemaOptions(options.schema),
      yogaOptions: this.resolveYogaOptions(options.yogaOptions),
      isEnabled: true,
    };
  }

  private resolveSchemaOptions(
    schema: GraphQLOptions["schema"],
  ): Parameters<typeof createSchema>[0] {
    const hasSchema = schema !== undefined;
    if (hasSchema) {
      return schema;
    }
    return {
      typeDefs: ``,
      resolvers: {},
    };
  }

  private resolveYogaOptions(
    yogaOptions: GraphQLOptions["yogaOptions"],
  ): Parameters<typeof createYoga>[0] {
    const hasYogaOptions = yogaOptions !== undefined;
    if (hasYogaOptions) {
      return yogaOptions;
    }
    return {};
  }

  private addResolverByType(type: string, resolvers: GraphQLResolverMap): void {
    this.ensureResolversInitialized();

    const isArrayResolvers = Array.isArray(this.schemaOptions.resolvers);
    if (isArrayResolvers) {
      (this.schemaOptions.resolvers as unknown[]).push({ [type]: resolvers });
      return;
    }

    this.mergeResolverIntoObject(type, resolvers);
  }

  private ensureResolversInitialized(): void {
    const hasNoResolvers = !this.schemaOptions.resolvers;
    if (hasNoResolvers) {
      this.schemaOptions.resolvers = {};
    }
  }

  private mergeResolverIntoObject(
    type: string,
    resolvers: GraphQLResolverMap,
  ): void {
    const resolversObj = this.schemaOptions.resolvers as Record<
      string,
      unknown
    >;
    const existingTypeResolver = resolversObj[type];
    const isObjectResolver =
      existingTypeResolver && typeof existingTypeResolver === "object";

    if (isObjectResolver) {
      resolversObj[type] = {
        ...(existingTypeResolver as Record<string, unknown>),
        ...resolvers,
      };
      return;
    }

    resolversObj[type] = resolvers;
  }

  private addFullResolver(resolver: GraphQLResolvers): void {
    this.ensureResolversInitialized();

    const isArray = Array.isArray(resolver);
    if (isArray) {
      this.addResolverArray(resolver);
      return;
    }

    const isObject = typeof resolver === "object" && resolver !== null;
    if (isObject) {
      this.addResolverObject(resolver);
      return;
    }

    this.schemaOptions.resolvers = resolver;
  }

  private addResolverArray(resolver: GraphQLResolvers[]): void {
    const currentIsArray = Array.isArray(this.schemaOptions.resolvers);
    if (currentIsArray) {
      this.schemaOptions.resolvers = [
        ...(this.schemaOptions.resolvers as unknown[]),
        ...resolver,
      ] as GraphQLResolvers;
      return;
    }

    this.schemaOptions.resolvers = [
      this.schemaOptions.resolvers,
      ...resolver,
    ] as GraphQLResolvers;
  }

  private addResolverObject(resolver: GraphQLResolvers): void {
    const currentIsArray = Array.isArray(this.schemaOptions.resolvers);
    if (currentIsArray) {
      this.schemaOptions.resolvers = [
        ...(this.schemaOptions.resolvers as unknown[]),
        resolver,
      ] as GraphQLResolvers;
      return;
    }

    this.schemaOptions.resolvers = {
      ...(this.schemaOptions.resolvers as Record<string, unknown>),
      ...(resolver as Record<string, unknown>),
    } as GraphQLResolvers;
  }

  private addTypeDefArray(typeDefs: GraphQLTypeDef[]): void {
    for (const def of typeDefs) {
      this.addTypeDef(def);
    }
  }

  private ensureTypeDefsArray(): void {
    const isAlreadyArray = Array.isArray(this.schemaOptions.typeDefs);
    if (isAlreadyArray) {
      return;
    }

    const hasExistingTypeDefs = this.schemaOptions.typeDefs !== undefined;
    if (hasExistingTypeDefs) {
      this.schemaOptions.typeDefs = [
        this.schemaOptions.typeDefs,
      ] as GraphQLTypeDef;
      return;
    }

    this.schemaOptions.typeDefs = [] as unknown as GraphQLTypeDef;
  }
}
