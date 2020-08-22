"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.randG2 = exports.randG1 = exports.randFs = exports.randFr = exports.newG2 = exports.newG1 = exports.compressSignature = exports.compressPubkey = exports.aggreagate = exports.sign = exports.newKeyPair = exports.g2ToHex = exports.g2ToBN = exports.g2ToCompressed = exports.g1ToHex = exports.g1ToBN = exports.g1ToCompressed = exports.signOfG2 = exports.signOfG1 = exports.g2 = exports.g1 = exports.mclToHex = exports.bn = exports.bnToHex = exports.mapToPoint = exports.hashToPoint = exports.init = exports.ZERO = exports.FIELD_ORDER = void 0;
const mcl = require("mcl-wasm");
const web3_1 = __importDefault(require("web3"));
exports.FIELD_ORDER = web3_1.default.utils.toBN("0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47");
exports.ZERO = web3_1.default.utils.toBN("0x00");
async function init() {
    await mcl.init(mcl.BN_SNARK1);
    mcl.setMapToMode(1);
}
exports.init = init;
function hashToPoint(data) {
    const e0 = web3_1.default.utils.toBN(web3_1.default.utils.soliditySha3(data));
    let e1 = new mcl.Fp();
    e1.setStr(e0.mod(exports.FIELD_ORDER).toString());
    return e1.mapToG1();
}
exports.hashToPoint = hashToPoint;
function mapToPoint(eHex) {
    const e0 = web3_1.default.utils.toBN(eHex);
    let e1 = new mcl.Fp();
    e1.setStr(e0.mod(exports.FIELD_ORDER).toString());
    return e1.mapToG1();
}
exports.mapToPoint = mapToPoint;
function bnToHex(n) {
    return "0x" + web3_1.default.utils.padLeft(n.toString(16), 64);
}
exports.bnToHex = bnToHex;
function bn(n) {
    if (n.length > 2 && n.slice(0, 2) == "0x") {
        return web3_1.default.utils.toBN(n);
    }
    return web3_1.default.utils.toBN("0x" + n);
}
exports.bn = bn;
function mclToHex(p, prefix = true) {
    const arr = p.serialize();
    let s = "";
    for (let i = arr.length - 1; i >= 0; i--) {
        s += ("0" + arr[i].toString(16)).slice(-2);
    }
    return prefix ? "0x" + s : s;
}
exports.mclToHex = mclToHex;
function g1() {
    const g1 = new mcl.G1();
    g1.setStr("1 0x01 0x02", 16);
    return g1;
}
exports.g1 = g1;
function g2() {
    const g2 = new mcl.G2();
    g2.setStr("1 0x1800deef121f1e76426a00665e5c4479674322d4f75edadd46debd5cd992f6ed 0x198e9393920d483a7260bfb731fb5d25f1aa493335a9e71297e485b7aef312c2 0x12c85ea5db8c6deb4aab71808dcb408fe3d1e7690c43d37b4ce6cc0166fa7daa 0x090689d0585ff075ec9e99ad690c3395bc4b313370b38ef355acdadcd122975b");
    return g2;
}
exports.g2 = g2;
function signOfG1(p) {
    const y = bn(mclToHex(p.getY()));
    return y.isOdd();
}
exports.signOfG1 = signOfG1;
function signOfG2(p) {
    p.normalize();
    const y = mclToHex(p.getY(), false);
    return bn(y.slice(64)).isOdd();
}
exports.signOfG2 = signOfG2;
function g1ToCompressed(p) {
    p.normalize();
    if (signOfG1(p)) {
        const x = bn(mclToHex(p.getX()));
        const masked = x.or(bn("8000000000000000000000000000000000000000000000000000000000000000"));
        return bnToHex(masked);
    }
    else {
        return mclToHex(p.getX());
    }
}
exports.g1ToCompressed = g1ToCompressed;
function g1ToBN(p) {
    p.normalize();
    const x = bn(mclToHex(p.getX()));
    const y = bn(mclToHex(p.getY()));
    return [x, y];
}
exports.g1ToBN = g1ToBN;
function g1ToHex(p) {
    p.normalize();
    const x = mclToHex(p.getX());
    const y = mclToHex(p.getY());
    return [x, y];
}
exports.g1ToHex = g1ToHex;
function g2ToCompressed(p) {
    p.normalize();
    const x = mclToHex(p.getX(), false);
    if (signOfG2(p)) {
        const masked = bn(x.slice(64)).or(bn("8000000000000000000000000000000000000000000000000000000000000000"));
        // return masked.toString(16, 64) + x.slice(0, 64);
        return [bnToHex(masked), "0x" + x.slice(0, 64)];
    }
    else {
        // return '0x' + x.slice(64) + x.slice(0, 64);
        return ["0x" + x.slice(64), "0x" + x.slice(0, 64)];
    }
}
exports.g2ToCompressed = g2ToCompressed;
function g2ToBN(p) {
    const x = mclToHex(p.getX(), false);
    const y = mclToHex(p.getY(), false);
    return [
        bn(x.slice(64)),
        bn(x.slice(0, 64)),
        bn(y.slice(64)),
        bn(y.slice(0, 64))
    ];
}
exports.g2ToBN = g2ToBN;
function g2ToHex(p) {
    p.normalize();
    const x = mclToHex(p.getX(), false);
    const y = mclToHex(p.getY(), false);
    return [
        "0x" + x.slice(64),
        "0x" + x.slice(0, 64),
        "0x" + y.slice(64),
        "0x" + y.slice(0, 64)
    ];
}
exports.g2ToHex = g2ToHex;
function newKeyPair() {
    const secret = randFr();
    const pubkey = mcl.mul(g2(), secret);
    pubkey.normalize();
    return { pubkey, secret };
}
exports.newKeyPair = newKeyPair;
function sign(message, secret) {
    const M = hashToPoint(message);
    const signature = mcl.mul(M, secret);
    signature.normalize();
    return { signature, M };
}
exports.sign = sign;
function aggreagate(acc, other) {
    const _acc = mcl.add(acc, other);
    _acc.normalize();
    return _acc;
}
exports.aggreagate = aggreagate;
function compressPubkey(p) {
    return g2ToCompressed(p);
}
exports.compressPubkey = compressPubkey;
function compressSignature(p) {
    return g1ToCompressed(p);
}
exports.compressSignature = compressSignature;
function newG1() {
    return new mcl.G1();
}
exports.newG1 = newG1;
function newG2() {
    return new mcl.G2();
}
exports.newG2 = newG2;
function randFr() {
    const r = web3_1.default.utils.randomHex(12);
    let fr = new mcl.Fr();
    fr.setHashOf(r);
    return fr;
}
exports.randFr = randFr;
function randFs() {
    const r = bn(web3_1.default.utils.randomHex(32));
    return r.umod(exports.FIELD_ORDER);
}
exports.randFs = randFs;
function randG1() {
    const p = mcl.mul(g1(), randFr());
    p.normalize();
    return p;
}
exports.randG1 = randG1;
function randG2() {
    const p = mcl.mul(g2(), randFr());
    p.normalize();
    return p;
}
exports.randG2 = randG2;
//# sourceMappingURL=mcl.js.map