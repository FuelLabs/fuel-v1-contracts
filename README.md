![Fuel](public/banner.png)

# Fuel

> Fuel is a stateless "Layer-2" system for ERC20 transfers and swaps designed for interoperable performance, scale and efficiency.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
<a href="https://circleci.com/gh/badges/shields/tree/master"> <img src="https://img.shields.io/circleci/project/github/badges/shields/master" alt="build status"></a>
[![Community](https://badges.gitter.im/gitterHQ/gitter.png)](https://gitter.im/fuellabs/community)

## Features

- A complete layer-2 optimistic rollup implementation
- Efficient (~1536 gas per transaction)
- Supports all ERC20 standard tokens
- Supports HTLC contracts for fast cross-chain atomic swaps
- Meta-transactional, pay fees in tokens of your choice
- Deposit from anywhere using simple transfers (no approve/transferFrom needed)
- High on-chain Throughput Capacity (~480tps)
- Censorship resistant (users can always transfer and withdraw)
- Interoperable, any contract can verify, use, control tokens on Fuel
- Fast 5 minute entry and exits
- Open-source under Apache-2.0

## Abstract

Fuel is the most efficient optimistic rollup in the world, featuring stateless transactional throughput that can be validated in parallel on consumer hardware whilst delivering an instantaneous meta-transactional experience for end-users.

It's unique UTXO-based design allows for non-custodial exchange of Ethereum ERC20s both within and outside of the Fuel layer-2 network.

Fuel's unique mempool priority aggregator model allows for a fast yet truly censorship resistant experience whilst still having reliable zero-confirmation guarantees of a service provider.

See the detailed [specification](https://docs.fuel.sh) for a more intimate overview of the design decisions behind Fuel.

## Install

```
git clone https://github.com/fuellabs/fuel
cd fuel
npm install
```

## Build

Note, the Yul+ compiler has not been optimized yet for contracts of this size, so building might take ~+10 minutes. This will go down to just seconds in future versions.

```
npm run build
```

## Test

Run all tests using:

```
npm test
```
