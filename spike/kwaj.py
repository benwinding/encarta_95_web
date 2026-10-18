import struct, sys

KWAJ_COMP_NONE, KWAJ_COMP_XOR, KWAJ_COMP_SZDD, KWAJ_COMP_LZH, KWAJ_COMP_MSZIP = 0,1,2,3,4

class Stop(Exception): pass

class Bits:
    def __init__(self, data):
        self.data = data; self.pos = 0
        self.bit_buffer = 0; self.bits_left = 0; self.input_end = 0
    def _byte(self):
        if self.pos < len(self.data):
            b = self.data[self.pos]; self.pos += 1; return b
        if self.input_end: self.input_end += 8
        else: self.input_end = 8
        return 0
    def read_bits(self, n):
        while self.bits_left < n:
            self.bit_buffer = ((self.bit_buffer << 8) | self._byte()) & 0xFFFFFFFF
            self.bits_left += 8
        self.bits_left -= n
        return (self.bit_buffer >> self.bits_left) & ((1 << n) - 1)
    def check(self):
        if self.input_end and self.bits_left < self.input_end:
            raise Stop()
    def read_bits_safe(self, n):
        v = self.read_bits(n); self.check(); return v

def build_table(lens):
    maxlen = max(lens) if lens else 0
    count = [0] * (maxlen + 2)
    for l in lens:
        if l: count[l] += 1
    code = 0; nxt = [0] * (maxlen + 2)
    for bits in range(1, maxlen + 1):
        code = (code + count[bits - 1]) << 1
        nxt[bits] = code
    dec = {}
    for sym, l in enumerate(lens):
        if l:
            dec[(l, nxt[l])] = sym; nxt[l] += 1
    return dec, maxlen

def read_huff(b, tbl):
    dec, maxlen = tbl
    code = 0
    for l in range(1, maxlen + 1):
        code = (code << 1) | b.read_bits(1)
        s = dec.get((l, code))
        if s is not None: return s
    raise ValueError("bad huffman code")

def read_lens(b, type_, numsyms, safe):
    lens = [0] * numsyms
    if type_ == 0:
        c = {16:4,32:5,64:6,256:8}.get(numsyms, 0)
        for i in range(numsyms): lens[i] = c
    elif type_ == 1:
        c = safe(4); lens[0] = c
        for i in range(1, numsyms):
            sel = safe(1)
            if sel == 0: lens[i] = c
            else:
                sel = safe(1)
                if sel == 0: c += 1; lens[i] = c
                else: c = safe(4); lens[i] = c
    elif type_ == 2:
        c = safe(4); lens[0] = c
        for i in range(1, numsyms):
            sel = safe(2)
            if sel == 3: c = safe(4)
            else: c = c + sel - 1
            lens[i] = c
    elif type_ == 3:
        for i in range(numsyms): lens[i] = safe(4)
    return lens

def lzh_decompress(data):
    b = Bits(data)
    types = [b.read_bits_safe(4) for _ in range(6)]
    tables = []
    for idx, (n, t) in enumerate([(16,types[0]),(16,types[1]),(32,types[2]),(64,types[3]),(256,types[4])]):
        lens = read_lens(b, t, n, b.read_bits_safe)
        tables.append(build_table(lens))
    ML1, ML2, LITLEN, OFFSET, LITERAL = tables
    window = bytearray([0x20] * 4096)
    out = bytearray(); pos = 0; lit_run = 0
    try:
        while not b.input_end:
            if lit_run: sym = read_huff(b, ML2); b.check()
            else: sym = read_huff(b, ML1); b.check()
            if sym > 0:
                length = sym + 2; lit_run = 0
                j = read_huff(b, OFFSET); b.check()
                offset = j << 6
                j = b.read_bits_safe(6)
                offset |= j
                while length > 0:
                    window[pos] = window[(pos + 4096 - offset) & 4095]
                    out.append(window[pos]); pos = (pos + 1) & 4095; length -= 1
            else:
                length = read_huff(b, LITLEN) + 1; b.check()
                lit_run = 0 if length == 32 else 1
                while length > 0:
                    j = read_huff(b, LITERAL); b.check()
                    window[pos] = j; out.append(j); pos = (pos + 1) & 4095; length -= 1
    except Stop:
        pass
    return bytes(out)

def kwaj_decompress(data):
    assert data[:4] == b"KWAJ", data[:4]
    assert struct.unpack('<I', data[4:8])[0] == 0xD127F088
    comp = struct.unpack('<H', data[8:10])[0]
    data_off = struct.unpack('<H', data[10:12])[0]
    flags = struct.unpack('<H', data[12:14])[0]
    p = 14
    outlen = None
    if flags & 0x0001:  # HASLENGTH
        outlen = struct.unpack('<I', data[p:p+4])[0]; p += 4
    # unknown/filename/extratext flags are not present in these files
    payload = data[data_off:]
    if comp in (KWAJ_COMP_NONE,):
        out = payload
    elif comp == KWAJ_COMP_XOR:
        out = bytes(x ^ 0xFF for x in payload)
    elif comp == KWAJ_COMP_LZH:
        out = lzh_decompress(payload)
    else:
        raise ValueError("unsupported comp type %d" % comp)
    if outlen is not None and len(out) != outlen:
        out = out[:outlen]
    return out

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    out = kwaj_decompress(open(src, 'rb').read())
    open(dst, 'wb').write(out)
    print(f"{src} -> {dst} ({len(out)} bytes) magic={out[:2]!r}")
