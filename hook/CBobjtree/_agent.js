(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Agent = void 0;
class Agent {
    constructor() {
        this.moduleBase = Process.enumerateModules()[0].base;
        this.cachedObjCResolver = null;
        this.cachedModuleResovler = null;
        this.objc_msgSend = null;
        this.stackDepth = 0;
        this.installedHooks = 0;
        this.pendingEvents = [];
        this.flushTimer = null;
        this.flush = () => {
            if (this.flushTimer != null) {
                clearTimeout(this.flushTimer);
                this.flushTimer = null;
            }
            if (this.pendingEvents.length == 0) {
                return;
            }
            send({
                type: 'events:add',
                message: this.pendingEvents
            });
            this.pendingEvents = [];
        };
    }
    init(spec, stackDepth) {
        this.stackDepth = stackDepth;
        try {
            this.start(spec);
            send({
                type: 'agent:finished_hooking',
                message: {
                    hooks: this.installedHooks,
                    depth: this.stackDepth
                }
            });
        }
        catch (e) {
            send({
                type: 'agent:error',
                message: e
            });
        }
    }
    start(spec) {
        this.objc_msgSend = Module.findGlobalExportByName('objc_msgSend');
        if (this.objc_msgSend == null) {
            throw new Error("Could not find objc_msgSend");
        }
        for (const [key, value] of spec) {
            switch (key) {
                case 'objc_method': {
                    this.installObjCHook(value);
                    break;
                }
                case 'function': {
                    this.installFunctionHook(value);
                    break;
                }
                case 'function_offset': {
                    this.installFunctionOffsetHook(value);
                    break;
                }
            }
        }
    }
    installObjCHook(pattern) {
        for (const m of this.getObjCResolver().enumerateMatches(pattern)) {
            this.installHook(m.address, m.name);
        }
    }
    getObjCResolver() {
        let resolver = this.cachedObjCResolver;
        if (resolver == null) {
            try {
                resolver = new ApiResolver('objc');
            }
            catch (e) {
                throw new Error("Objective-C runtime is not available");
            }
            this.cachedObjCResolver = resolver;
        }
        return resolver;
    }
    installFunctionHook(pattern) {
        const q = parseModuleFunctionPattern(pattern);
        for (const m of this.getModuleResolver().enumerateMatches(`exports:${q.module}!${q.function}`)) {
            this.installHook(m.address, m.name);
        }
    }
    getModuleResolver() {
        let resolver = this.cachedModuleResovler;
        if (resolver == null) {
            resolver = new ApiResolver('module');
            this.cachedModuleResovler = resolver;
        }
        return resolver;
    }
    installFunctionOffsetHook(offset) {
        const funcAbsoluteAddr = this.moduleBase.add(offset);
        this.installHook(funcAbsoluteAddr, `function at address ${funcAbsoluteAddr}`);
    }
    installHook(pointer, funcDescription) {
        const objc_msgSend = this.objc_msgSend;
        const agent = this;
        Interceptor.attach(pointer, {
            onEnter: function (args) {
                const originThreadId = this.threadId;
                //console.log("\n" + funcDescription);
                agent.emit([0, funcDescription]);
                this.hook = Interceptor.attach(objc_msgSend, {
                    onEnter: function (args) {
                        if (this.threadId == originThreadId) {
                            agent.objcOnEnter(this, args);
                        }
                    }
                });
            }, onLeave: function (retval) {
                agent.emit([-1, '---------------------------------']); // Use depth -1 to mark the exiting of a function
                this.hook.detach();
            }
        });
        this.installedHooks++;
        send({
            type: 'agent:hook_installed',
            message: {
                target: funcDescription
            }
        });
    }
    objcOnEnter(ctx, args) {
        if (ctx.depth > this.stackDepth) {
            return;
        }
        const id = args[0];
        const selector = args[1].readCString();
        let cls;
        let typeQualifier;
        if (ObjC.api.object_isClass(id)) {
            typeQualifier = '+';
            cls = id;
        }
        else {
            typeQualifier = '-';
            cls = ObjC.api.object_getClass(id);
        }
        let clsName = ObjC.api.class_getName(cls).readCString();
        //console.log('|  '.repeat(ctx.depth) + `${typeQualifier}[${clsName} ${selector}]`);
        let objcMessage = `${typeQualifier}[${clsName} ${selector}]`;
        this.emit([ctx.depth, objcMessage]);
    }
    // Credits for the following 3 funcs: https://github.com/frida/frida-tools/blob/master/agents/tracer/agent.ts
    emit(event) {
        this.pendingEvents.push(event);
        if (this.flushTimer == null) {
            this.flushTimer = setTimeout(this.flush, 50);
        }
    }
}
exports.Agent = Agent;
function parseModuleFunctionPattern(pattern) {
    const tokens = pattern.split("!", 2);
    let m, f;
    if (tokens.length === 1) {
        m = "*";
        f = tokens[0];
    }
    else {
        m = (tokens[0] === "") ? "*" : tokens[0];
        f = (tokens[1] === "") ? "*" : tokens[1];
    }
    return {
        module: m,
        function: f
    };
}

},{}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const agent_1 = require("./agent");
const agent = new agent_1.Agent();
rpc.exports = {
    init: agent.init.bind(agent)
};

},{"./agent":1}]},{},[2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvYWdlbnQudHMiLCJzcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7QUNXQSxNQUFhLEtBQUs7SUFBbEI7UUFDWSxlQUFVLEdBQUcsT0FBTyxDQUFDLGdCQUFnQixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1FBQ2hELHVCQUFrQixHQUF1QixJQUFJLENBQUM7UUFDOUMseUJBQW9CLEdBQXVCLElBQUksQ0FBQTtRQUMvQyxpQkFBWSxHQUF5QixJQUFJLENBQUM7UUFDMUMsZUFBVSxHQUFXLENBQUMsQ0FBQztRQUN2QixtQkFBYyxHQUFHLENBQUMsQ0FBQztRQUNuQixrQkFBYSxHQUFpQixFQUFFLENBQUM7UUFDakMsZUFBVSxHQUFRLElBQUksQ0FBQztRQXlKdkIsVUFBSyxHQUFHLEdBQUcsRUFBRTtZQUNqQixJQUFJLElBQUksQ0FBQyxVQUFVLElBQUksSUFBSSxFQUFFO2dCQUN6QixZQUFZLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUM5QixJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQzthQUMxQjtZQUVELElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO2dCQUNoQyxPQUFPO2FBQ1Y7WUFFRCxJQUFJLENBQUM7Z0JBQ0QsSUFBSSxFQUFFLFlBQVk7Z0JBQ2xCLE9BQU8sRUFBRSxJQUFJLENBQUMsYUFBYTthQUM5QixDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsYUFBYSxHQUFHLEVBQUUsQ0FBQztRQUM1QixDQUFDLENBQUM7SUFDTixDQUFDO0lBeEtHLElBQUksQ0FBQyxJQUFjLEVBQUUsVUFBa0I7UUFDbkMsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7UUFFN0IsSUFBSTtZQUNBLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDakIsSUFB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
