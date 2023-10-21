import { type Socket, createServer, type Server } from "net";
import { SizeComputer } from "./binary/sizeComputer";
import { BinaryReader } from "./binary";
import { State, ValueType } from "./state";

export enum PacketType {
    Log,
    ParamApply,
    ParamDelete,
    Trigger,
}

const sizes: Record<ValueType, number> = [1, 1, 2, 2, 4, 4, 4, 4, 1, 0, 0];

export class Client {
    private static emptyBuffer = Buffer.alloc(0);
    constructor(public socket: Socket, public server: ModServer) {
        socket.on("data", this.handleRawData.bind(this));
        socket.on("error", error => {
            console.error(error);
        });
    }

    private waitingType: PacketType = 0;
    private waitingBytes = SizeComputer.int32().getSize();
    private waitingBuffer: Buffer = Buffer.alloc(0);
    private waitingForData = false;

    private handleRawData(data: Buffer) {
        while (data.length !== 0) {
            const newBytes = data.subarray(0, this.waitingBytes);
            data = data.subarray(this.waitingBytes);

            this.waitingBytes -= newBytes.byteLength;
            this.waitingBuffer = Buffer.concat([this.waitingBuffer, newBytes]);

            if (this.waitingBytes !== 0)
                return;

            if (!this.waitingForData) {
                const view = new DataView(
                    this.waitingBuffer.buffer.slice(this.waitingBuffer.byteOffset, this.waitingBuffer.byteOffset + this.waitingBuffer.byteLength)
                );
                this.waitingType = view.getUint16(0, true);
                this.waitingBytes = view.getUint16(2, true);
            } else {
                this.server.handleData(this.waitingType, this.waitingBuffer);
                this.waitingBytes = SizeComputer.int32().getSize();
            }

            this.waitingForData = !this.waitingForData;
            this.waitingBuffer = Client.emptyBuffer;
        }
    }
}

export class ModServer {
    private server: Server = createServer(this.onConnection.bind(this));
    private clients: Client[] = [];
    constructor(public state: State) {
        state.on("param", this.handleParam.bind(this));
        state.on("deletedParam", (name) => {
            const buffer = this.prepareBuffer(PacketType.ParamDelete, 0x20);
            new TextEncoder().encodeInto(name, new Uint8Array(buffer, 4, 0x20));
            this.broadcast(buffer);
        });
        state.on("trigger", (name) => {
            const buffer = this.prepareBuffer(PacketType.Trigger, SizeComputer.string(name).int8().getSize());
            new TextEncoder().encodeInto(name, new Uint8Array(buffer, 4));
            this.broadcast(buffer);
        });

        this.server.listen(3085, () => console.log("mod server listening on 3085"))
    }

    handleParam(name: string, type: ValueType, value: any) {
        if (type === ValueType.Trigger) return;
        let size = SizeComputer.int16().string(name).int8()
        if (type == ValueType.String) size = size.string(value).int8().int8();
        else size = size.bytes(sizes[type]);
        const buffer = this.prepareBuffer(PacketType.ParamApply, size.getSize());
        let intoRes = new TextEncoder().encodeInto(name, new Uint8Array(buffer, 6));
        new Uint16Array(buffer, 4, 1)[0] = intoRes.written! + 1;
        const view = new DataView(buffer, 7 + intoRes.written!); // header + string len + nullterm
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
            case ValueType.String: {
                intoRes = new TextEncoder().encodeInto(value, new Uint8Array(buffer, 7 + intoRes.written! + 1));
                view.setUint8(0, intoRes.written! + 1);
                break;
            }
        }
        // console.log("broadcasting state change", this.clients.length, name, type, value);
        this.broadcast(buffer);
    }

    prepareBuffer(type: PacketType, size: number) {
        const buffer = new ArrayBuffer(4 + size);
        const header = new Uint16Array(buffer, 0, 2);
        header[0] = type;
        header[1] = size;
        return buffer;
    }

    broadcast(data: ArrayBuffer) {
        // console.log("out", new Uint8Array(data));
        for (const client of this.clients) {
            client.socket.write(new Uint8Array(data));
        }
    }

    onConnection(socket: Socket) {
        const client = new Client(socket, this);
        console.log("got a client!");
        this.clients.push(client);
        let x = 0;
        // setInterval(() => this.state.setParam("Stateful", ValueType.U32, x++), 2000);
        for (const [name, [type, value]] of Object.entries(this.state.params)) {
            this.handleParam(name, type, value);
        }
        socket.on("close", () => this.clients.splice(this.clients.indexOf(client), 1));
    }

    handleData(type: PacketType, data: Buffer) {
        const reader = BinaryReader.from(data);
        // console.log(type, data);
        switch (type) {
            case PacketType.Log:
                const text = reader.readCString();
                process.stdout.write(text);
                // this.state.pushLog(text);
                break;
        }
    }
}