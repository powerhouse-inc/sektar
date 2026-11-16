import { BaseSubgraph, type SubgraphArgs } from "@powerhousedao/reactor-api";
import { conversionGatewaySchema } from "../../conversions/host/gateway.js";
import {
  conversionRuntime,
  type SubgraphHalf,
} from "../../conversions/host/runtime.js";

/**
 * Sektar's document conversion service on this switchboard. Setting it up
 * mounts the `/conversion` HTTP routes on the package's route scope and the
 * `conversion` gateway that workflow steps query as their run user; the
 * service itself starts once the conversion processor has attached too.
 */
export class ConversionSubgraph extends BaseSubgraph {
  name = "conversion";
  typeDefs = conversionGatewaySchema;
  resolvers = conversionRuntime().gatewayResolvers();
  readonly #half: SubgraphHalf;

  constructor(args: SubgraphArgs) {
    super(args);
    this.#half = {
      http: args.http,
      authorizationService: args.authorizationService,
      reactorClient: this.reactorClient,
      relationalDb: args.relationalDb,
      graphqlManager: args.graphqlManager,
    };
  }

  override async onSetup(): Promise<void> {
    conversionRuntime().attachSubgraph(this.#half);
    await Promise.resolve();
  }

  override async onDisconnect(): Promise<void> {
    await conversionRuntime().detachSubgraph(this.#half);
  }
}
