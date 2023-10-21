import EventEmitter from "events";
import { existsSync, readFileSync, writeFileSync } from "fs";

export enum ValueType {
    U8,
    I8,
    U16,
    I16,
    U32,
    I32,
    F32,
    F64,
    Boolean,
    String,
    Trigger,
}

type ValueTypeMapping = [type: ValueType.Boolean, value: boolean] | [type: ValueType.String, value: string] | [type: ValueType.Trigger, value: boolean] | [type: ValueType, value: number];

export class State extends EventEmitter {
    private static path = "./params.json";
    public logs: string[] = [];
    public params: Record<string, ValueTypeMapping> = {};

    constructor() {
        super();
        if (existsSync(State.path)) this.params = JSON.parse(readFileSync(State.path, "utf-8"));
        this.on("param", () => writeFileSync(State.path, JSON.stringify(this.params)));
        this.on("trigger", () => writeFileSync(State.path, JSON.stringify(this.params)));
        this.on("deletedParam", () => writeFileSync(State.path, JSON.stringify(this.params)));
    }

    pushLog(log: string) {
        this.logs.push(log);
        this.emit("log", log);
    }

    setParam(name: string, type: ValueType, value: any) {
        this.params[name] = [type, value];
        this.emit("param", name, type, value);
    }

    deleteParam(name: string) {
        delete this.params[name];
        this.emit("deletedParam", name);
    }

    getParam(name: string): ValueTypeMapping {
        return this.params[name];
    }

    trigger(name: string) {
        console.log("got trigger", name);
        this.params[name] = [ValueType.Trigger, false];
        this.emit("trigger", name);
    }
}