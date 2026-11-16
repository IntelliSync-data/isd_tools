/**
 * QR Code Engine & Renderer (từ qr-code-studio, dùng trong isd_qr_code)
 * Combines Project Nayuki's QR Code generator with Canvas & SVG renderers,
 * smart logo excavation, and schema formatters (URL, Text, WiFi, vCard, Email, Phone, SMS).
 * 
 * @license Project Nayuki QR Code library (TypeScript/JS) - MIT License
 * @license qrcode.react - ISC License
 */

(function (global) {
  'use strict';

  var k = {};

  // --- Project Nayuki QR Code Generator Core ---
  (function (c) {
    const a = class x {
      constructor(e, r, t, s) {
        if (this.version = e, this.errorCorrectionLevel = r, this.modules = [], this.isFunction = [], e < x.MIN_VERSION || e > x.MAX_VERSION)
          throw new RangeError("Version value out of range");
        if (s < -1 || s > 7)
          throw new RangeError("Mask value out of range");
        this.size = e * 4 + 17;
        let o = [];
        for (let l = 0; l < this.size; l++) o.push(!1);
        for (let l = 0; l < this.size; l++) this.modules.push(o.slice()), this.isFunction.push(o.slice());
        this.drawFunctionPatterns();
        const h = this.addEccAndInterleave(t);
        if (this.drawCodewords(h), s == -1) {
          let l = 1e9;
          for (let p = 0; p < 8; p++) {
            this.applyMask(p), this.drawFormatBits(p);
            const f = this.getPenaltyScore();
            f < l && (s = p, l = f), this.applyMask(p);
          }
        }
        g(0 <= s && s <= 7), this.mask = s, this.applyMask(s), this.drawFormatBits(s), this.isFunction = [];
      }
      static encodeText(e, r) {
        const t = c.QrSegment.makeSegments(e);
        return x.encodeSegments(t, r);
      }
      static encodeBinary(e, r) {
        const t = c.QrSegment.makeBytes(e);
        return x.encodeSegments([t], r);
      }
      static encodeSegments(e, r, t = 1, s = 40, o = -1, h = !0) {
        if (!(x.MIN_VERSION <= t && t <= s && s <= x.MAX_VERSION) || o < -1 || o > 7)
          throw new RangeError("Invalid value");
        let l, p;
        for (l = t; ; l++) {
          const m = x.getNumDataCodewords(l, r) * 8, C = v.getTotalBits(e, l);
          if (C <= m) {
            p = C;
            break;
          }
          if (l >= s) throw new RangeError("Data too long");
        }
        for (const m of [x.Ecc.MEDIUM, x.Ecc.QUARTILE, x.Ecc.HIGH])
          h && p <= x.getNumDataCodewords(l, m) * 8 && (r = m);
        let f = [];
        for (const m of e) {
          i(m.mode.modeBits, 4, f), i(m.numChars, m.mode.numCharCountBits(l), f);
          for (const C of m.getData()) f.push(C);
        }
        g(f.length == p);
        const w = x.getNumDataCodewords(l, r) * 8;
        g(f.length <= w), i(0, Math.min(4, w - f.length), f), i(0, (8 - f.length % 8) % 8, f), g(f.length % 8 == 0);
        for (let m = 236; f.length < w; m ^= 253) i(m, 8, f);
        let y = [];
        for (; y.length * 8 < f.length;) y.push(0);
        return f.forEach((m, C) => y[C >>> 3] |= m << 7 - (C & 7)), new x(l, r, y, o);
      }
      getModule(e, r) {
        return 0 <= e && e < this.size && 0 <= r && r < this.size && this.modules[r][e];
      }
      getModules() {
        return this.modules;
      }
      drawFunctionPatterns() {
        for (let t = 0; t < this.size; t++) this.setFunctionModule(6, t, t % 2 == 0), this.setFunctionModule(t, 6, t % 2 == 0);
        this.drawFinderPattern(3, 3), this.drawFinderPattern(this.size - 4, 3), this.drawFinderPattern(3, this.size - 4);
        const e = this.getAlignmentPatternPositions(), r = e.length;
        for (let t = 0; t < r; t++)
          for (let s = 0; s < r; s++)
            t == 0 && s == 0 || t == 0 && s == r - 1 || t == r - 1 && s == 0 || this.drawAlignmentPattern(e[t], e[s]);
        this.drawFormatBits(0), this.drawVersion();
      }
      drawFormatBits(e) {
        const r = this.errorCorrectionLevel.formatBits << 3 | e;
        let t = r;
        for (let o = 0; o < 10; o++) t = t << 1 ^ (t >>> 9) * 1335;
        const s = (r << 10 | t) ^ 21522;
        g(s >>> 15 == 0);
        for (let o = 0; o <= 5; o++) this.setFunctionModule(8, o, d(s, o));
        this.setFunctionModule(8, 7, d(s, 6)), this.setFunctionModule(8, 8, d(s, 7)), this.setFunctionModule(7, 8, d(s, 8));
        for (let o = 9; o < 15; o++) this.setFunctionModule(14 - o, 8, d(s, o));
        for (let o = 0; o < 8; o++) this.setFunctionModule(this.size - 1 - o, 8, d(s, o));
        for (let o = 8; o < 15; o++) this.setFunctionModule(8, this.size - 15 + o, d(s, o));
        this.setFunctionModule(8, this.size - 8, !0);
      }
      drawVersion() {
        if (this.version < 7) return;
        let e = this.version;
        for (let t = 0; t < 12; t++) e = e << 1 ^ (e >>> 11) * 7973;
        const r = this.version << 12 | e;
        g(r >>> 18 == 0);
        for (let t = 0; t < 18; t++) {
          const s = d(r, t), o = this.size - 11 + t % 3, h = Math.floor(t / 3);
          this.setFunctionModule(o, h, s), this.setFunctionModule(h, o, s);
        }
      }
      drawFinderPattern(e, r) {
        for (let t = -4; t <= 4; t++)
          for (let s = -4; s <= 4; s++) {
            const o = Math.max(Math.abs(s), Math.abs(t)), h = e + s, l = r + t;
            0 <= h && h < this.size && 0 <= l && l < this.size && this.setFunctionModule(h, l, o != 2 && o != 4);
          }
      }
      drawAlignmentPattern(e, r) {
        for (let t = -2; t <= 2; t++)
          for (let s = -2; s <= 2; s++)
            this.setFunctionModule(e + s, r + t, Math.max(Math.abs(s), Math.abs(t)) != 1);
      }
      setFunctionModule(e, r, t) {
        this.modules[r][e] = t, this.isFunction[r][e] = !0;
      }
      addEccAndInterleave(e) {
        const r = this.version, t = this.errorCorrectionLevel;
        if (e.length != x.getNumDataCodewords(r, t)) throw new RangeError("Invalid argument");
        const s = x.NUM_ERROR_CORRECTION_BLOCKS[t.ordinal][r], o = x.ECC_CODEWORDS_PER_BLOCK[t.ordinal][r], h = Math.floor(x.getNumRawDataModules(r) / 8), l = s - h % s, p = Math.floor(h / s);
        let f = [];
        const w = x.reedSolomonComputeDivisor(o);
        for (let m = 0, C = 0; m < s; m++) {
          let M = e.slice(C, C + p - o + (m < l ? 0 : 1));
          C += M.length;
          const j = x.reedSolomonComputeRemainder(M, w);
          m < l && M.push(0), f.push(M.concat(j));
        }
        let y = [];
        for (let m = 0; m < f[0].length; m++)
          f.forEach((C, M) => {
            (m != p - o || M >= l) && y.push(C[m]);
          });
        return g(y.length == h), y;
      }
      drawCodewords(e) {
        if (e.length != Math.floor(x.getNumRawDataModules(this.version) / 8)) throw new RangeError("Invalid argument");
        let r = 0;
        for (let t = this.size - 1; t >= 1; t -= 2) {
          t == 6 && (t = 5);
          for (let s = 0; s < this.size; s++)
            for (let o = 0; o < 2; o++) {
              const h = t - o, p = (t + 1 & 2) == 0 ? this.size - 1 - s : s;
              !this.isFunction[p][h] && r < e.length * 8 && (this.modules[p][h] = d(e[r >>> 3], 7 - (r & 7)), r++);
            }
        }
        g(r == e.length * 8);
      }
      applyMask(e) {
        if (e < 0 || e > 7) throw new RangeError("Mask value out of range");
        for (let r = 0; r < this.size; r++)
          for (let t = 0; t < this.size; t++) {
            let s;
            switch (e) {
              case 0: s = (t + r) % 2 == 0; break;
              case 1: s = r % 2 == 0; break;
              case 2: s = t % 3 == 0; break;
              case 3: s = (t + r) % 3 == 0; break;
              case 4: s = (Math.floor(t / 3) + Math.floor(r / 2)) % 2 == 0; break;
              case 5: s = t * r % 2 + t * r % 3 == 0; break;
              case 6: s = (t * r % 2 + t * r % 3) % 2 == 0; break;
              case 7: s = ((t + r) % 2 + t * r % 3) % 2 == 0; break;
              default: throw new Error("Unreachable");
            }
            !this.isFunction[r][t] && s && (this.modules[r][t] = !this.modules[r][t]);
          }
      }
      getPenaltyScore() {
        let e = 0;
        for (let o = 0; o < this.size; o++) {
          let h = !1, l = 0, p = [0, 0, 0, 0, 0, 0, 0];
          for (let f = 0; f < this.size; f++)
            this.modules[o][f] == h ? (l++, l == 5 ? e += x.PENALTY_N1 : l > 5 && e++) : (this.finderPenaltyAddHistory(l, p), h || (e += this.finderPenaltyCountPatterns(p) * x.PENALTY_N3), h = this.modules[o][f], l = 1);
          e += this.finderPenaltyTerminateAndCount(h, l, p) * x.PENALTY_N3;
        }
        for (let o = 0; o < this.size; o++) {
          let h = !1, l = 0, p = [0, 0, 0, 0, 0, 0, 0];
          for (let f = 0; f < this.size; f++)
            this.modules[f][o] == h ? (l++, l == 5 ? e += x.PENALTY_N1 : l > 5 && e++) : (this.finderPenaltyAddHistory(l, p), h || (e += this.finderPenaltyCountPatterns(p) * x.PENALTY_N3), h = this.modules[f][o], l = 1);
          e += this.finderPenaltyTerminateAndCount(h, l, p) * x.PENALTY_N3;
        }
        for (let o = 0; o < this.size - 1; o++)
          for (let h = 0; h < this.size - 1; h++) {
            const l = this.modules[o][h];
            l == this.modules[o][h + 1] && l == this.modules[o + 1][h] && l == this.modules[o + 1][h + 1] && (e += x.PENALTY_N2);
          }
        let r = 0;
        for (const o of this.modules) r = o.reduce((h, l) => h + (l ? 1 : 0), r);
        const t = this.size * this.size, s = Math.ceil(Math.abs(r * 20 - t * 10) / t) - 1;
        return g(0 <= s && s <= 9), e += s * x.PENALTY_N4, g(0 <= e && e <= 2568888), e;
      }
      getAlignmentPatternPositions() {
        if (this.version == 1) return [];
        const e = Math.floor(this.version / 7) + 2, r = this.version == 32 ? 26 : Math.ceil((this.version * 4 + 4) / (e * 2 - 2)) * 2;
        let t = [6];
        for (let s = this.size - 7; t.length < e; s -= r) t.splice(1, 0, s);
        return t;
      }
      static getNumRawDataModules(e) {
        if (e < x.MIN_VERSION || e > x.MAX_VERSION) throw new RangeError("Version number out of range");
        let r = (16 * e + 128) * e + 64;
        if (e >= 2) {
          const t = Math.floor(e / 7) + 2;
          r -= (25 * t - 10) * t - 55, e >= 7 && (r -= 36);
        }
        return g(208 <= r && r <= 29648), r;
      }
      static getNumDataCodewords(e, r) {
        return Math.floor(x.getNumRawDataModules(e) / 8) - x.ECC_CODEWORDS_PER_BLOCK[r.ordinal][e] * x.NUM_ERROR_CORRECTION_BLOCKS[r.ordinal][e];
      }
      static reedSolomonComputeDivisor(e) {
        if (e < 1 || e > 255) throw new RangeError("Degree out of range");
        let r = [];
        for (let s = 0; s < e - 1; s++) r.push(0);
        r.push(1);
        let t = 1;
        for (let s = 0; s < e; s++) {
          for (let o = 0; o < r.length; o++) r[o] = x.reedSolomonMultiply(r[o], t), o + 1 < r.length && (r[o] ^= r[o + 1]);
          t = x.reedSolomonMultiply(t, 2);
        }
        return r;
      }
      static reedSolomonComputeRemainder(e, r) {
        let t = r.map(s => 0);
        for (const s of e) {
          const o = s ^ t.shift();
          t.push(0), r.forEach((h, l) => t[l] ^= x.reedSolomonMultiply(h, o));
        }
        return t;
      }
      static reedSolomonMultiply(e, r) {
        if (e >>> 8 || r >>> 8) throw new RangeError("Byte out of range");
        let t = 0;
        for (let s = 7; s >= 0; s--) t = t << 1 ^ (t >>> 7) * 285, t ^= (r >>> s & 1) * e;
        return g(t >>> 8 == 0), t;
      }
      finderPenaltyCountPatterns(e) {
        const r = e[1];
        g(r <= this.size * 3);
        const t = r > 0 && e[2] == r && e[3] == r * 3 && e[4] == r && e[5] == r;
        return (t && e[0] >= r * 4 && e[6] >= r ? 1 : 0) + (t && e[6] >= r * 4 && e[0] >= r ? 1 : 0);
      }
      finderPenaltyTerminateAndCount(e, r, t) {
        return e && (this.finderPenaltyAddHistory(r, t), r = 0), r += this.size, this.finderPenaltyAddHistory(r, t), this.finderPenaltyCountPatterns(t);
      }
      finderPenaltyAddHistory(e, r) {
        r[0] == 0 && (e += this.size), r.pop(), r.unshift(e);
      }
    };

    a.MIN_VERSION = 1;
    a.MAX_VERSION = 40;
    a.PENALTY_N1 = 3;
    a.PENALTY_N2 = 3;
    a.PENALTY_N3 = 40;
    a.PENALTY_N4 = 10;
    a.ECC_CODEWORDS_PER_BLOCK = [
      [-1,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
      [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
      [-1,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
      [-1,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30]
    ];
    a.NUM_ERROR_CORRECTION_BLOCKS = [
      [-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
      [-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
      [-1,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
      [-1,1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81]
    ];
    c.QrCode = a;

    function i(b, e, r) {
      if (e < 0 || e > 31 || b >>> e) throw new RangeError("Value out of range");
      for (let t = e - 1; t >= 0; t--) r.push(b >>> t & 1);
    }
    function d(b, e) {
      return (b >>> e & 1) != 0;
    }
    function g(b) {
      if (!b) throw new Error("Assertion error");
    }

    const u = class N {
      constructor(e, r, t) {
        if (this.mode = e, this.numChars = r, this.bitData = t, r < 0) throw new RangeError("Invalid argument");
        this.bitData = t.slice();
      }
      static makeBytes(e) {
        let r = [];
        for (const t of e) i(t, 8, r);
        return new N(N.Mode.BYTE, e.length, r);
      }
      static makeNumeric(e) {
        if (!N.isNumeric(e)) throw new RangeError("String contains non-numeric characters");
        let r = [];
        for (let t = 0; t < e.length;) {
          const s = Math.min(e.length - t, 3);
          i(parseInt(e.substring(t, t + s), 10), s * 3 + 1, r), t += s;
        }
        return new N(N.Mode.NUMERIC, e.length, r);
      }
      static makeAlphanumeric(e) {
        if (!N.isAlphanumeric(e)) throw new RangeError("String contains unencodable characters in alphanumeric mode");
        let r = [], t;
        for (t = 0; t + 2 <= e.length; t += 2) {
          let s = N.ALPHANUMERIC_CHARSET.indexOf(e.charAt(t)) * 45;
          s += N.ALPHANUMERIC_CHARSET.indexOf(e.charAt(t + 1)), i(s, 11, r);
        }
        return t < e.length && i(N.ALPHANUMERIC_CHARSET.indexOf(e.charAt(t)), 6, r), new N(N.Mode.ALPHANUMERIC, e.length, r);
      }
      static makeSegments(e) {
        return e == "" ? [] : N.isNumeric(e) ? [N.makeNumeric(e)] : N.isAlphanumeric(e) ? [N.makeAlphanumeric(e)] : [N.makeBytes(N.toUtf8ByteArray(e))];
      }
      static isNumeric(e) {
        return N.NUMERIC_REGEX.test(e);
      }
      static isAlphanumeric(e) {
        return N.ALPHANUMERIC_REGEX.test(e);
      }
      getData() {
        return this.bitData.slice();
      }
      static getTotalBits(e, r) {
        let t = 0;
        for (const s of e) {
          const o = s.mode.numCharCountBits(r);
          if (s.numChars >= 1 << o) return 1 / 0;
          t += 4 + o + s.bitData.length;
        }
        return t;
      }
      static toUtf8ByteArray(e) {
        e = encodeURI(e);
        let r = [];
        for (let t = 0; t < e.length; t++)
          e.charAt(t) != "%" ? r.push(e.charCodeAt(t)) : (r.push(parseInt(e.substring(t + 1, t + 3), 16)), t += 2);
        return r;
      }
    };
    u.NUMERIC_REGEX = /^[0-9]*$/;
    u.ALPHANUMERIC_REGEX = /^[A-Z0-9 $%*+.\/:-]*$/;
    u.ALPHANUMERIC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
    let v = u;
    c.QrSegment = u;
  })(k);

  (function (c) {
    (function (a) {
      const i = class {
        constructor(g, u) {
          this.ordinal = g, this.formatBits = u;
        }
      };
      i.LOW = new i(0, 1);
      i.MEDIUM = new i(1, 0);
      i.QUARTILE = new i(2, 3);
      i.HIGH = new i(3, 2);
      a.Ecc = i;
    })(c.QrCode || (c.QrCode = {}));
  })(k);

  (function (c) {
    (function (a) {
      const i = class {
        constructor(g, u) {
          this.modeBits = g, this.numBitsCharCount = u;
        }
        numCharCountBits(g) {
          return this.numBitsCharCount[Math.floor((g + 7) / 17)];
        }
      };
      i.NUMERIC = new i(1, [10, 12, 14]);
      i.ALPHANUMERIC = new i(2, [9, 11, 13]);
      i.BYTE = new i(4, [8, 16, 16]);
      i.KANJI = new i(8, [8, 10, 12]);
      i.ECI = new i(7, [0, 0, 0]);
      a.Mode = i;
    })(c.QrSegment || (c.QrSegment = {}));
  })(k);

  // --- Path builder with horizontal span merging ---
  function buildSvgPath(cells, margin = 0) {
    const ops = [];
    cells.forEach(function (row, rIdx) {
      let spanStart = null;
      row.forEach(function (isDark, cIdx) {
        if (!isDark && spanStart !== null) {
          ops.push(`M${spanStart + margin} ${rIdx + margin}h${cIdx - spanStart}v1H${spanStart + margin}z`);
          spanStart = null;
          return;
        }
        if (cIdx === row.length - 1) {
          if (!isDark) return;
          if (spanStart === null) {
            ops.push(`M${cIdx + margin},${rIdx + margin} h1v1H${cIdx + margin}z`);
          } else {
            ops.push(`M${spanStart + margin},${rIdx + margin} h${cIdx + 1 - spanStart}v1H${spanStart + margin}z`);
          }
          return;
        }
        if (isDark && spanStart === null) {
          spanStart = cIdx;
        }
      });
    });
    return ops.join("");
  }

  // --- Excavate modules for center logo ---
  function excavateModules(cells, area) {
    return cells.map((row, r) => {
      if (r < area.y || r >= area.y + area.h) return row.slice();
      return row.map((val, c) => (c < area.x || c >= area.x + area.w ? val : false));
    });
  }

  // --- Calculate logo placement ---
  function calculateLogoBounds(moduleCount, margin, logoRatio = 0.22) {
    const totalSize = moduleCount + margin * 2;
    const logoModuleSize = Math.max(3, Math.round(totalSize * logoRatio));
    const startPos = Math.floor((totalSize - logoModuleSize) / 2);
    return {
      x: startPos,
      y: startPos,
      w: logoModuleSize,
      h: logoModuleSize
    };
  }

  const ECC_MAP = {
    L: k.QrCode.Ecc.LOW,
    M: k.QrCode.Ecc.MEDIUM,
    Q: k.QrCode.Ecc.QUARTILE,
    H: k.QrCode.Ecc.HIGH
  };

  /**
   * Main Generator Class
   */
  const QREngine = {
    ECC: ECC_MAP,

    generateData(text, eccLevel = 'Q') {
      const ecc = ECC_MAP[eccLevel] || ECC_MAP.Q;
      const qr = k.QrCode.encodeText(text, ecc);
      return {
        size: qr.size,
        modules: qr.getModules(),
        version: qr.version,
        errorCorrection: eccLevel
      };
    },

    /**
     * Render SVG String
     */
    renderSVG(options) {
      const {
        text = '',
        eccLevel = 'Q',
        fgColor = '#000000',
        bgColor = '#ffffff',
        margin = 2,
        size = 300,
        logoSrc = null,
        logoRatio = 0.22,
        title = 'QR Code'
      } = options;

      const data = this.generateData(text, eccLevel);
      let cells = data.modules;
      const numModules = cells.length;
      const totalCells = numModules + margin * 2;
      let logoMarkup = '';

      if (logoSrc) {
        const logoBounds = calculateLogoBounds(numModules, margin, logoRatio);
        // Excavate area in module coordinates
        const excavateArea = {
          x: logoBounds.x - margin,
          y: logoBounds.y - margin,
          w: logoBounds.w,
          h: logoBounds.h
        };
        cells = excavateModules(cells, excavateArea);

        logoMarkup = `
          <rect x="${logoBounds.x}" y="${logoBounds.y}" width="${logoBounds.w}" height="${logoBounds.h}" fill="${bgColor}" rx="0.5" />
          <image href="${logoSrc}" x="${logoBounds.x + 0.3}" y="${logoBounds.y + 0.3}" width="${logoBounds.w - 0.6}" height="${logoBounds.h - 0.6}" preserveAspectRatio="xMidYMid meet" />
        `;
      }

      const pathData = buildSvgPath(cells, margin);

      return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${totalCells} ${totalCells}" width="${size}" height="${size}" role="img" aria-label="${title}">
  <title>${title}</title>
  <rect width="${totalCells}" height="${totalCells}" fill="${bgColor}" />
  <path fill="${fgColor}" d="${pathData}" shape-rendering="crispEdges" />
  ${logoMarkup}
</svg>`;
    },

    /**
     * Render to HTML5 Canvas
     */
    renderCanvas(canvas, options) {
      const {
        text = '',
        eccLevel = 'Q',
        fgColor = '#000000',
        bgColor = '#ffffff',
        margin = 2,
        size = 512,
        logoImage = null,
        logoRatio = 0.22
      } = options;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const data = this.generateData(text, eccLevel);
      let cells = data.modules;
      const numModules = cells.length;
      const totalCells = numModules + margin * 2;

      let logoBounds = null;
      if (logoImage && logoImage.complete && logoImage.naturalWidth !== 0) {
        logoBounds = calculateLogoBounds(numModules, margin, logoRatio);
        const excavateArea = {
          x: logoBounds.x - margin,
          y: logoBounds.y - margin,
          w: logoBounds.w,
          h: logoBounds.h
        };
        cells = excavateModules(cells, excavateArea);
      }

      // Configure high-DPI canvas
      canvas.width = size;
      canvas.height = size;
      ctx.clearRect(0, 0, size, size);

      // Background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, size, size);

      // Scale to cell units
      const cellSize = size / totalCells;

      // Draw dark modules
      ctx.fillStyle = fgColor;
      for (let r = 0; r < numModules; r++) {
        for (let c = 0; c < numModules; c++) {
          if (cells[r][c]) {
            const x = Math.round((c + margin) * cellSize);
            const y = Math.round((r + margin) * cellSize);
            const w = Math.ceil(cellSize);
            const h = Math.ceil(cellSize);
            ctx.fillRect(x, y, w, h);
          }
        }
      }

      // Draw logo if present
      if (logoBounds && logoImage) {
        const lx = logoBounds.x * cellSize;
        const ly = logoBounds.y * cellSize;
        const lw = logoBounds.w * cellSize;
        const lh = logoBounds.h * cellSize;

        // Clean logo background
        ctx.fillStyle = bgColor;
        ctx.fillRect(lx, ly, lw, lh);

        // Draw centered logo with padding
        const pad = cellSize * 0.4;
        ctx.drawImage(logoImage, lx + pad, ly + pad, lw - pad * 2, lh - pad * 2);
      }
    },

    /**
     * Payload Formatter Helpers
     */
    formatters: {
      url(val) {
        let trimmed = (val || '').trim();
        if (!trimmed) return '';
        if (!/^https?:\/\//i.test(trimmed)) {
          trimmed = 'https://' + trimmed;
        }
        return trimmed;
      },

      text(val) {
        return (val || '').trim();
      },

      wifi({ ssid, password, authType = 'WPA', hidden = false }) {
        const esc = s => (s || '').replace(/([\\;,:"])/g, '\\$1');
        return `WIFI:T:${authType};S:${esc(ssid)};P:${esc(password)};H:${hidden ? 'true' : 'false'};;`;
      },

      vcard(info) {
        const lines = [
          'BEGIN:VCARD',
          'VERSION:3.0',
          `N:${info.lastName || ''};${info.firstName || ''};;;`,
          `FN:${[info.firstName, info.lastName].filter(Boolean).join(' ')}`
        ];
        if (info.organization) lines.push(`ORG:${info.organization}`);
        if (info.title) lines.push(`TITLE:${info.title}`);
        if (info.phone) lines.push(`TEL;TYPE=CELL,VOICE:${info.phone}`);
        if (info.email) lines.push(`EMAIL;TYPE=PREF,INTERNET:${info.email}`);
        if (info.url) lines.push(`URL:${info.url}`);
        if (info.address) lines.push(`ADR;TYPE=WORK:;;${info.address};;;;`);
        if (info.note) lines.push(`NOTE:${info.note}`);
        lines.push('END:VCARD');
        return lines.join('\n');
      },

      email({ email, subject, body }) {
        let res = `mailto:${encodeURIComponent(email || '')}`;
        const params = [];
        if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
        if (body) params.push(`body=${encodeURIComponent(body)}`);
        if (params.length) res += '?' + params.join('&');
        return res;
      },

      phone(number) {
        return `tel:${(number || '').replace(/\s+/g, '')}`;
      },

      sms({ phone, message }) {
        return `smsto:${(phone || '').replace(/\s+/g, '')}:${message || ''}`;
      }
    }
  };

  // Universal export: globalThis for browser & Node, plus module.exports if CJS
  globalThis.QREngine = QREngine;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = QREngine;
  }
  if (typeof exports !== 'undefined') {
    Object.assign(exports, QREngine);
    exports.default = QREngine;
  }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis));
