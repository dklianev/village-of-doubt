import { listen } from "@colyseus/tools";
import appConfig from "./app.config.js";

await listen(appConfig, Number(process.env.GAME_SERVER_PORT ?? process.env.PORT ?? 2567));
