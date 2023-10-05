import { ModServer } from "./modserver";
import { State } from "./state";
import { createWss } from "./websocket";

const state = new State;
new ModServer(state);
createWss(state);
