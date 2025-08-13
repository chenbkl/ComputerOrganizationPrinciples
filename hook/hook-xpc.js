function waitForModule(name, callback) {
    const base = Module.findBaseAddress(name);
    if (base) {
        console.log(`[+] ${name} loaded @ ${base}`);
        callback();
    } else {
        console.log(`[!] Waiting for ${name} to load...`);
        const interval = setInterval(() => {
            const b = Module.findBaseAddress(name);
            if (b) {
                clearInterval(interval);
                console.log(`[+] ${name} loaded @ ${b}`);
                callback();
            }
        }, 100);
    }
}

waitForModule("libxpc.dylib", hookXpc);

function hookXpc() {
    const libName = "libxpc.dylib";

    function getExport(name) {
        const addr = Module.findExportByName(libName, name);
        if (!addr) {
            console.error(`[!] Cannot find ${name}`);
        }
        return addr;
    }

    const f_xpc_connection_get_name = new NativeFunction(
        getExport('xpc_connection_get_name'),
        'pointer', ['pointer']
    );

    const f_xpc_get_type = new NativeFunction(
        getExport('xpc_get_type'),
        'pointer', ['pointer']
    );

    const f_xpc_data_get_length = new NativeFunction(
        getExport('xpc_data_get_length'),
        'uint64', ['pointer']
    );

    const f_xpc_data_get_bytes_ptr = new NativeFunction(
        getExport('xpc_data_get_bytes_ptr'),
        'pointer', ['pointer']
    );

    const sendMsgPtr = getExport('xpc_connection_send_message');
    if (sendMsgPtr) {
        Interceptor.attach(sendMsgPtr, {
            onEnter(args) {
                const conn = args[0];
                const msg = args[1];

                const namePtr = f_xpc_connection_get_name(conn);
                const name = namePtr.isNull() ? "(null)" : namePtr.readUtf8String();

                console.log("\n[>] XPC Send");
                console.log("    Connection:", name);

                const type = f_xpc_get_type(msg);
                console.log("    Type ptr:", type);

                try {
                    const len = Number(f_xpc_data_get_length(msg));
                    if (len > 0 && len < 4096) {
                        const bytes = f_xpc_data_get_bytes_ptr(msg);
                        const buf = bytes.readByteArray(len);
                        console.log("    Data (hex):", buf ? hexdump(buf, { ansi: true }) : "(null)");
                    }
                } catch (e) {
                    console.log("    [!] Dump failed:", e);
                }
            }
        });
    }
}
