// Random number sources. Both expose the same interface:
//   nextU32() -> uniform 32-bit unsigned integer
//   int(n)    -> uniform integer in [0, n), exactly unbiased
//   pick(weights, total) -> index chosen with probability weights[i] / total
//
// CryptoRng drives the live game. SeededRng (xoshiro128**) drives the
// simulator and tests so every run is reproducible from its seed.

const TWO_32 = 4294967296;

function intFrom(rng, n) {
  // Rejection sampling: discard the top (2^32 mod n) values so every
  // result in [0, n) has exactly the same number of preimages.
  const limit = TWO_32 - (TWO_32 % n);
  let x;
  do {
    x = rng.nextU32();
  } while (x >= limit);
  return x % n;
}

function pickFrom(rng, weights, total) {
  let r = intFrom(rng, total);
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

function splitmix32(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    return (t ^ (t >>> 15)) >>> 0;
  };
}

export class SeededRng {
  constructor(seed = 1) {
    const next = splitmix32(seed);
    this.s0 = next();
    this.s1 = next();
    this.s2 = next();
    this.s3 = next();
  }

  nextU32() {
    const s1 = this.s1;
    const x = Math.imul(s1, 5);
    const result = Math.imul((x << 7) | (x >>> 25), 9) >>> 0;
    const t = s1 << 9;
    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;
    this.s2 ^= t;
    this.s3 = (this.s3 << 11) | (this.s3 >>> 21);
    return result;
  }

  int(n) {
    return intFrom(this, n);
  }

  pick(weights, total) {
    return pickFrom(this, weights, total);
  }

  save(into = []) {
    into[0] = this.s0;
    into[1] = this.s1;
    into[2] = this.s2;
    into[3] = this.s3;
    return into;
  }

  restore(st) {
    [this.s0, this.s1, this.s2, this.s3] = st;
  }
}

export class CryptoRng {
  constructor(cryptoImpl = globalThis.crypto) {
    if (!cryptoImpl?.getRandomValues) throw new Error('crypto.getRandomValues is not available');
    this.crypto = cryptoImpl;
    this.buf = new Uint32Array(256);
    this.pos = this.buf.length;
  }

  nextU32() {
    if (this.pos >= this.buf.length) {
      this.crypto.getRandomValues(this.buf);
      this.pos = 0;
    }
    return this.buf[this.pos++];
  }

  int(n) {
    return intFrom(this, n);
  }

  pick(weights, total) {
    return pickFrom(this, weights, total);
  }
}
