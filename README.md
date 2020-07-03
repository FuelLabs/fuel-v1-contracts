![Fuel](public/banner.png)

Fuel
===

> Fuel is high-performance optimistic rollup optimized for ERC-20 transfers and swaps, designed for interoperable performance, scale, and efficiency.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Community](https://badges.gitter.im/gitterHQ/gitter.png)](https://gitter.im/fuellabs_/community)

# Features

- A complete layer-2 optimistic rollup implementation
- Efficient (~1536 gas per transaction)
- Supports all ERC-20 standard tokens
- Supports HTLCs for fast cross-chain atomic swaps
- Meta-transactional, pay fees in tokens of your choice
- Deposit tokens from anywhere using simple transfers (no `approve`/`transferFrom` required)
- High on-chain throughput capacity (~480tps @ 10m Block)
- Censorship-resistant (users can always transfer and withdraw)
- Interoperable, any contract or address can use, verify, and control assets on Fuel
- Fast, ~5 minute entry and exits using HTLCs

# Abstract

Fuel is the most efficient optimistic rollup in the world, featuring stateless transactional throughput that can be validated in parallel on consumer hardware whilst delivering an instantaneous meta-transactional experience for end-users.

It's unique UTXO-based design allows for non-custodial exchange of Ethereum ERC20s both within and outside of the Fuel layer-2 network.

Fuel's unique mempool priority aggregator model allows for a fast yet truly censorship resistant experience whilst still having reliable zero-confirmation guarantees of a service provider.

See the detailed [specification](https://docs.fuel.sh) for a more intimate overview of the design decisions behind Fuel.

# Building From Source

## Install Dependencies

Install [Node.js](https://nodejs.org/en/) `>= v10`.

Then run:

```sh
npm install
```

## Build

_Note, the Yul+ compiler has not been optimized yet for contracts of this size, so building might take ~+10 minutes. This will go down to just seconds in future compiler versions._

```sh
npm run build
```

## Run Tests

Run all tests using:

```sh
npm test
```

## Run Benchmarks

Run all benchmarks using:

```sh
npm run benchmark
```
