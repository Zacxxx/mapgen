// Based on example by @jwagner: https://github.com/jwagner/simplex-noise.js
// and Stefan Gustavson's paper "Simplex Noise Demystified" (2005)
// 4D contributions from Ken Perlin's noise course notes

const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
const F3 = 1.0 / 3.0;
const G3 = 1.0 / 6.0;
const F4 = (Math.sqrt(5.0) - 1.0) / 4.0;
const G4 = (5.0 - Math.sqrt(5.0)) / 20.0;

export class SimplexNoise {
  private p: Uint8Array;
  private perm: Uint8Array;
  private permMod12: Uint8Array;

  constructor(randomOrSeed: (() => number) | string | number = Math.random) {
    this.p = new Uint8Array(256);
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);

    let randomFunc: () => number;
    if (typeof randomOrSeed === 'function') {
      randomFunc = randomOrSeed;
    } else {
        let seed = 0;
        if (typeof randomOrSeed === 'string') {
            for (let i = 0; i < randomOrSeed.length; i++) {
                seed = (seed << 5) - seed + randomOrSeed.charCodeAt(i);
                seed |= 0; // Convert to 32bit integer
            }
        } else { // number
            seed = randomOrSeed;
        }
        // Simple LCG for seeded random
        randomFunc = () => {
            seed = (seed * 1664525 + 1013904223) | 0;
            return (seed & 0x7fffffff) / 0x80000000;
        };
    }


    for (let i = 0; i < 256; i++) {
      this.p[i] = i;
    }

    for (let i = 255; i > 0; i--) {
      const r = Math.floor(randomFunc() * (i + 1));
      const t = this.p[i];
      this.p[i] = this.p[r];
      this.p[r] = t;
    }

    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  public noise2D(xin: number, yin: number): number {
    let n0, n1, n2; 
    const s = (xin + yin) * F2; 
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t; 
    const Y0 = j - t;
    const x0 = xin - X0; 
    const y0 = yin - Y0;

    let i1, j1; 
    if (x0 > y0) { i1 = 1; j1 = 0; } 
    else { i1 = 0; j1 = 1; }      

    const x1 = x0 - i1 + G2; 
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2; 
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.permMod12[ii + this.perm[jj]];
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
    const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) n0 = 0.0;
    else {
      t0 *= t0;
      n0 = t0 * t0 * this.grad2D(this.perm[gi0], x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) n1 = 0.0;
    else {
      t1 *= t1;
      n1 = t1 * t1 * this.grad2D(this.perm[gi1], x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) n2 = 0.0;
    else {
      t2 *= t2;
      n2 = t2 * t2 * this.grad2D(this.perm[gi2], x2, y2);
    }
    return 70.0 * (n0 + n1 + n2);
  }

  public noise4D(x: number, y: number, z: number, w: number): number {
    let n0, n1, n2, n3, n4; // Noise contributions from the five corners
    // Skew the (x,y,z,w) space to determine which cell of 24 simplices we're in
    const s = (x + y + z + w) * F4; // Factor for 4D skewing
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const k = Math.floor(z + s);
    const l = Math.floor(w + s);
    const t = (i + j + k + l) * G4; // Factor for 4D unskewing
    const X0 = i - t; // Unskew the cell origin back to (x,y,z,w) space
    const Y0 = j - t;
    const Z0 = k - t;
    const W0 = l - t;
    const x0 = x - X0;  // The x,y,z,w distances from the cell origin
    const y0 = y - Y0;
    const z0 = z - Z0;
    const w0 = w - W0;

    // For the 4D case, the simplex is a 4D shape I won't name.
    // Determine which simplex we are in.
    const c = Array(4).fill(0); // Rank of each coordinate in value
    const rankOrder = [[x0, 0], [y0, 1], [z0, 2], [w0, 3]];
    rankOrder.sort((a, b) => b[0] - a[0]);

    let i1, j1, k1, l1; // The integer offsets for the second simplex corner
    let i2, j2, k2, l2; // The integer offsets for the third simplex corner
    let i3, j3, k3, l3; // The integer offsets for the fourth simplex corner

    // c[0] is the largest coordinate. c[1] is the next largest.
    // The integer offsets for the second corner are 1 on the largest coordinate.
    // The integer offsets for the third corner are 1 on the two largest coordinates.
    // The integer offsets for the fourth corner are 1 on the three largest coordinates.

    i1 = j1 = k1 = l1 = 0;
    i2 = j2 = k2 = l2 = 0;
    i3 = j3 = k3 = l3 = 0;

    const os = [0,0,0,0];
    os[rankOrder[0][1]] = 1; i1 = os[0]; j1 = os[1]; k1 = os[2]; l1 = os[3];
    os[rankOrder[1][1]] = 1; i2 = os[0]; j2 = os[1]; k2 = os[2]; l2 = os[3];
    os[rankOrder[2][1]] = 1; i3 = os[0]; j3 = os[1]; k3 = os[2]; l3 = os[3];

    // simplex P4 has offset (1,1,1,1)
    const x1 = x0 - i1 + G4;
    const y1 = y0 - j1 + G4;
    const z1 = z0 - k1 + G4;
    const w1 = w0 - l1 + G4;

    const x2 = x0 - i2 + 2.0 * G4;
    const y2 = y0 - j2 + 2.0 * G4;
    const z2 = z0 - k2 + 2.0 * G4;
    const w2 = w0 - l2 + 2.0 * G4;

    const x3 = x0 - i3 + 3.0 * G4;
    const y3 = y0 - j3 + 3.0 * G4;
    const z3 = z0 - k3 + 3.0 * G4;
    const w3 = w0 - l3 + 3.0 * G4;
    
    const x4 = x0 - 1.0 + 4.0 * G4;
    const y4 = y0 - 1.0 + 4.0 * G4;
    const z4 = z0 - 1.0 + 4.0 * G4;
    const w4 = w0 - 1.0 + 4.0 * G4;


    // Work out the hashed gradient indices of the five simplex corners
    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;
    const ll = l & 255;

    const gi0 = this.perm[ii + this.perm[jj + this.perm[kk + this.perm[ll]]]];
    const gi1 = this.perm[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1 + this.perm[ll + l1]]]];
    const gi2 = this.perm[ii + i2 + this.perm[jj + j2 + this.perm[kk + k2 + this.perm[ll + l2]]]];
    const gi3 = this.perm[ii + i3 + this.perm[jj + j3 + this.perm[kk + k3 + this.perm[ll + l3]]]];
    const gi4 = this.perm[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1 + this.perm[ll + 1]]]];

    // Calculate the contribution from the five corners
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0 - w0 * w0;
    if (t0 < 0) n0 = 0.0;
    else {
      t0 *= t0;
      n0 = t0 * t0 * this.grad4D(gi0, x0, y0, z0, w0);
    }

    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1 - w1 * w1;
    if (t1 < 0) n1 = 0.0;
    else {
      t1 *= t1;
      n1 = t1 * t1 * this.grad4D(gi1, x1, y1, z1, w1);
    }

    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2 - w2 * w2;
    if (t2 < 0) n2 = 0.0;
    else {
      t2 *= t2;
      n2 = t2 * t2 * this.grad4D(gi2, x2, y2, z2, w2);
    }

    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3 - w3 * w3;
    if (t3 < 0) n3 = 0.0;
    else {
      t3 *= t3;
      n3 = t3 * t3 * this.grad4D(gi3, x3, y3, z3, w3);
    }
    
    let t4 = 0.6 - x4 * x4 - y4 * y4 - z4 * z4 - w4 * w4;
    if (t4 < 0) n4 = 0.0;
    else {
      t4 *= t4;
      n4 = t4 * t4 * this.grad4D(gi4, x4, y4, z4, w4);
    }
    // Sum contributions from each corner to get the final noise value.
    // The result is scaled to stay just inside [-1,1]
    return 27.0 * (n0 + n1 + n2 + n3 + n4); // Approx scaling factor
  }

  private grad2D(hash: number, x: number, y: number): number {
    const g = grad2Table[this.permMod12[hash]]; // Use permMod12 for grad2 also
    return g[0] * x + g[1] * y;
  }
  
  private grad4D(hash: number, x: number, y: number, z: number, w: number): number {
    const h = hash & 31; // Convert to 0-31
    let u = h < 24 ? x : y; // Choose x,y,z,w based on h
    let v = h < 16 ? y : z;
    let p = h < 8  ? z : w;
    // Signs for (u,v,w) based on h
    return ((h&1) !== 0 ? -u : u) + ((h&2) !== 0 ? -v : v) + ((h&4) !== 0 ? -p : p);
  }

}

// prettier-ignore
const grad2Table = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1], // Simplified grad2 table to 8 unique non-zero vectors
  [1, 1], [-1, 1], [1, -1], [-1, -1] // Repeat for permMod12 to index correctly
];
