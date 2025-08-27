/**
 * 解析 Objective-C 方法签名 encoding（m.types）
 * 返回 { returnType: {enc, friendly}, args: [{enc, friendly}, ...] }
 * 说明：
 * - 会跳过编码里出现的数字（栈大小、偏移）
 * - 能正确处理指针(^T)、数组([nT])、结构体({name=...})、联合体((...))、block(@?)、SEL(:)、Class(#)
 * - 会保留原始编码 enc，同时给出一个 friendly 名称
 */
export function parseObjCTypes(types: string) {
    let i = 0;

    function skipDigits() {
        while (i < types.length && types[i] >= '0' && types[i] <= '9') i++;
    }

    // 解析一个完整类型 token（含指针、数组、结构体等嵌套）
    function parseOne() {
        skipDigits();
        if (i >= types.length) return null;

        const start = i;
        const c = types[i++];

        switch (c) {
            case 'r': case 'n': case 'N': case 'o': case 'O': case 'R': case 'V':
                // qualifiers，接着再取一个真正的类型
                const t = parseOne();
                if (!t) return { enc: c, friendly: qualifierFriendly(c) };
                return { enc: c + t.enc, friendly: t.friendly + qualifierSuffix(c) };

            case '^': {
                const inner = parseOne();
                const enc = '^' + (inner ? inner.enc : '');
                return { enc, friendly: pointerFriendly(inner) };
            }

            case '@': {
                // block: @?   对象：@
                if (types[i] === '?') { i++; return { enc: '@?', friendly: 'block' }; }
                // 可能包含类名 @"NSString" 这种形式（方法签名里少见）
                // 我们保留为 '@'
                return { enc: '@', friendly: 'object' };
            }

            case '#':
                return { enc: '#', friendly: 'class' };

            case ':':
                return { enc: ':', friendly: 'selector' };

            case 'v':
                return { enc: 'v', friendly: 'void' };

            case 'c': return { enc: 'c', friendly: 'char' };
            case 'C': return { enc: 'C', friendly: 'unsigned char' };
            case 's': return { enc: 's', friendly: 'short' };
            case 'S': return { enc: 'S', friendly: 'unsigned short' };
            case 'i': return { enc: 'i', friendly: 'int' };
            case 'I': return { enc: 'I', friendly: 'unsigned int' };
            case 'l': return { enc: 'l', friendly: 'long' };
            case 'L': return { enc: 'L', friendly: 'unsigned long' };
            case 'q': return { enc: 'q', friendly: 'long long' };
            case 'Q': return { enc: 'Q', friendly: 'unsigned long long' };
            case 'f': return { enc: 'f', friendly: 'float' };
            case 'd': return { enc: 'd', friendly: 'double' };
            case 'B': return { enc: 'B', friendly: 'bool' };
            case 'v': return { enc: 'v', friendly: 'void' };
            case '*': return { enc: '*', friendly: 'char *' }; // C-string

            case '{': { // 结构体 {name=...}
                const end = findMatching(types, start, '{', '}');
                const enc = types.slice(start, end + 1);
                i = end + 1;
                const name = enc.slice(1, enc.indexOf('='));
                return { enc, friendly: name ? `struct ${name}` : 'struct' };
            }

            case '(': { // 联合体
                const end = findMatching(types, start, '(', ')');
                const enc = types.slice(start, end + 1);
                i = end + 1;
                return { enc, friendly: 'union' };
            }

            case '[': { // 数组 [nT]
                const end = findMatching(types, start, '[', ']');
                const enc = types.slice(start, end + 1);
                i = end + 1;
                // 尝试做个友好名
                const m = /^\[(\d+)(.*)\]$/.exec(enc);
                const count = m ? m[1] : '?';
                return { enc, friendly: `array[${count}]` };
            }

            case '?':
                return { enc: '?', friendly: 'unknown' };

            default:
                // 跳过未知/实现细节（包含数字、空格、方言）
                return { enc: c, friendly: `unknown(${c})` };
        }
    }

    function qualifierFriendly(q) {
        // 不单独作为类型名使用
        return q;
    }
    function qualifierSuffix(q) {
        // 可选：返回更直观的后缀
        switch (q) {
            case 'r': return ' (const)';
            case 'n': return ' (in)';
            case 'N': return ' (inout)';
            case 'o': return ' (out)';
            case 'O': return ' (bycopy)';
            case 'R': return ' (byref)';
            case 'V': return ' (oneway)';
            default: return '';
        }
    }

    function pointerFriendly(inner) {
        if (!inner) return 'pointer';
        // 把常见类型映射得更清晰一些
        const map = {
            '@': 'object *',
            ':': 'SEL *',
            'v': 'void *',
            'c': 'char *',
            'C': 'unsigned char *',
            'i': 'int *',
            'I': 'unsigned int *',
            'q': 'long long *',
            'Q': 'unsigned long long *',
            'f': 'float *',
            'd': 'double *',
            '*': 'char **',
            '#': 'Class *',
            '?': 'unknown *',
        };
        if (map[inner.enc]) return map[inner.enc];
        if (inner.enc.startsWith('{')) return 'struct *';
        if (inner.enc.startsWith('^')) return 'pointer *';
        return inner.friendly + ' *';
    }

    function findMatching(s, pos, open, close) {
        let depth = 0;
        for (let k = pos; k < s.length; k++) {
            const ch = s[k];
            if (ch === open) depth++;
            else if (ch === close) {
                depth--;
                if (depth === 0) return k;
            }
        }
        throw new Error(`Unbalanced ${open}${close} in type encoding: ${s.slice(pos)}`);
    }

    // ---- 实际解析：第一个 token 是返回值，后面依次是参数 ----
    const ret = parseOne();
    const args = [];
    while (true) {
        const t = parseOne();
        if (!t) break;
        args.push(t);
    }
    return {
        returnType: ret ? ret : { enc: '', friendly: 'unknown' },
        args, // 注意：这里的 args 包含 self(@) 和 _cmd(:) 两个隐含参数
    };
}