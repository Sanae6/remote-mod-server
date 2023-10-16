import { WebSocket, WebSocketServer } from "ws";
import { State, ValueType } from "./state";
import { BinaryReader, BinaryWriter } from "./binary";
import { SizeComputer } from "./binary/sizeComputer";

enum BinaryMessageType {
    Logs,
    Params,
    ApplyParam,
    DeleteParam,
    Trigger,
}

const sizes: Record<ValueType, number> = [1, 1, 2, 2, 4, 4, 4, 4, 1, 0, 0];

function encodeValue(type: ValueType, value: any) {
    if (type === ValueType.String) {
        return new TextEncoder().encode(value);
    }
    const buffer = new ArrayBuffer(sizes[type]);
    const view = new DataView(buffer);
    switch (type) {
        case ValueType.Boolean: view.setUint8(0, +value); break;
        case ValueType.U8: view.setUint8(0, value); break;
        case ValueType.I8: view.setInt8(0, value); break;
        case ValueType.U16: view.setUint16(0, value, true); break;
        case ValueType.I16: view.setInt16(0, value, true); break;
        case ValueType.U32: view.setUint32(0, value, true); break;
        case ValueType.I32: view.setInt32(0, value, true); break;
        case ValueType.F32: view.setFloat32(0, value, true); break;
        case ValueType.F64: view.setFloat64(0, value, true); break;
    }
    return buffer;
}

export function createWss(state: State) {
    const wss = new WebSocketServer({
        port: 1984
    });

    let clients: WebSocket[] = [];

    wss.on("connection", (ws) => {
        ws.binaryType = "arraybuffer";
        clients.push(ws);
        ws.on("message", (data: ArrayBuffer) => {
            // console.log(new Uint8Array(data));
            const reader = BinaryReader.from(data);
            switch (reader.readUInt8()) {
                case BinaryMessageType.ApplyParam: {
                    const name = reader.readString(reader.readUInt8());
                    const type: ValueType = reader.readUInt8();
                    switch (type) {
                        case ValueType.U8: state.setParam(name, type, reader.readUInt8()); break;
                        case ValueType.I8: state.setParam(name, type, reader.readSInt8()); break;
                        case ValueType.U16: state.setParam(name, type, reader.readUInt16LE()); break;
                        case ValueType.I16: state.setParam(name, type, reader.readSInt16LE()); break;
                        case ValueType.U32: state.setParam(name, type, reader.readUInt32LE()); break;
                        case ValueType.I32: state.setParam(name, type, reader.readSInt32LE()); break;
                        case ValueType.F32: state.setParam(name, type, reader.readFloat32LE()); break;
                        case ValueType.F64: state.setParam(name, type, reader.readFloat64LE()); break;
                        case ValueType.Boolean: state.setParam(name, type, reader.readBoolean()); break;
                        case ValueType.String: state.setParam(name, type, reader.readString(reader.readUInt8())); break;
                    }
                    break;
                }
                case BinaryMessageType.DeleteParam: {
                    const name = reader.readString(reader.readUInt8());
                    state.deleteParam(name);
                    break;
                }
                case BinaryMessageType.Trigger: {
                    const name = reader.readString(reader.readUInt8());
                    state.trigger(name);
                    break;
                }
            }
        });
        ws.on("error", console.error);
        ws.on("close", () => clients.splice(clients.indexOf(ws), 1));

        {
            const logsBinary = state.logs.map(x => new TextEncoder().encode(x));
            const writer = BinaryWriter.allocate(SizeComputer.int8().int64().bytes(logsBinary.reduce((p, c) => p + c.length + 1, 0)).getSize());
            writer.writeUInt8(BinaryMessageType.Logs);
            writer.writeUInt64LE(BigInt(state.logs.length));
            for (const log of logsBinary) {
                writer.writeUInt8(log.length);
                writer.writeBytes(log);
            }
            broadcast(writer.getBuffer().buffer);
        }
        {
            const paramsBinary: [ArrayBuffer, ValueType, ArrayBuffer][] = Object.entries(state.params).map(([key, [type, value]]) => [new TextEncoder().encode(key), type, encodeValue(type, value)]);
            const writer = BinaryWriter.allocate(SizeComputer.int8().int64().bytes(paramsBinary.reduce((p, c) => p + c[0].byteLength + c[2].byteLength + 3, 0)).getSize());
            writer.writeUInt8(BinaryMessageType.Params);
            writer.writeUInt64LE(BigInt(paramsBinary.length));
            for (const param of paramsBinary) {
                writer.writeUInt8(param[0].byteLength);
                writer.writeBytes(param[0]);
                writer.writeUInt8(param[1]);
                if (param[1] == ValueType.String)
                    writer.writeUInt8(param[2].byteLength);
                writer.writeBytes(param[2]);
            }
            // console.log(new Uint8Array(writer.getBuffer().buffer));
            broadcast(writer.getBuffer().buffer);
        }
    });

    function broadcast(packet: ArrayBuffer) {
        for (const client of clients) {
            client.send(packet);
        }
    }

    state.on("log", log => {
        const writer = BinaryWriter.allocate(SizeComputer.int8().int64().int8().string(log).getSize());
        writer.writeUInt8(BinaryMessageType.Logs);
        writer.writeUInt64LE(1n);

        writer.writeUInt8(SizeComputer.string(log).getSize());
        writer.writeString(log);
        broadcast(writer.getBuffer().buffer);
    });
}
