export const deviceRegistryAbi = [
  {
    type: "function",
    name: "registerDevice",
    stateMutability: "nonpayable",
    inputs: [
      { name: "deviceId", type: "bytes32" },
      { name: "controller", type: "address" },
      { name: "keyFingerprint", type: "bytes32" },
      { name: "metadataHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getDevice",
    stateMutability: "view",
    inputs: [{ name: "deviceId", type: "bytes32" }],
    outputs: [{
      name: "record",
      type: "tuple",
      components: [
        { name: "controller", type: "address" },
        { name: "keyFingerprint", type: "bytes32" },
        { name: "metadataHash", type: "bytes32" },
        { name: "registeredAt", type: "uint64" },
        { name: "updatedAt", type: "uint64" },
        { name: "status", type: "uint8" },
      ],
    }],
  },
  {
    type: "function",
    name: "setDeviceStatus",
    stateMutability: "nonpayable",
    inputs: [
      { name: "deviceId", type: "bytes32" },
      { name: "newStatus", type: "uint8" },
    ],
    outputs: [],
  },
];

export const telemetryCommitmentsAbi = [
  {
    type: "function",
    name: "setAuthorizedDeviceSubmitter",
    stateMutability: "nonpayable",
    inputs: [
      { name: "deviceId", type: "bytes32" },
      { name: "submitter", type: "address" },
      { name: "authorized", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "authorizedDeviceSubmitters",
    stateMutability: "view",
    inputs: [
      { name: "deviceId", type: "bytes32" },
      { name: "submitter", type: "address" },
    ],
    outputs: [{ name: "authorized", type: "bool" }],
  },
  {
    type: "function",
    name: "commitBatch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "batchId", type: "bytes32" },
      { name: "deviceId", type: "bytes32" },
      { name: "commitment", type: "bytes32" },
      { name: "schemaHash", type: "bytes32" },
      { name: "startedAt", type: "uint64" },
      { name: "endedAt", type: "uint64" },
      { name: "readingCount", type: "uint32" },
    ],
    outputs: [{ name: "created", type: "bool" }],
  },
  {
    type: "function",
    name: "batchExists",
    stateMutability: "view",
    inputs: [{ name: "batchId", type: "bytes32" }],
    outputs: [{ name: "exists", type: "bool" }],
  },
  {
    type: "function",
    name: "getBatch",
    stateMutability: "view",
    inputs: [{ name: "batchId", type: "bytes32" }],
    outputs: [{
      name: "record",
      type: "tuple",
      components: [
        { name: "deviceId", type: "bytes32" },
        { name: "commitment", type: "bytes32" },
        { name: "schemaHash", type: "bytes32" },
        { name: "submitter", type: "address" },
        { name: "startedAt", type: "uint64" },
        { name: "endedAt", type: "uint64" },
        { name: "committedAt", type: "uint64" },
        { name: "readingCount", type: "uint32" },
      ],
    }],
  },
];
