export interface TreeSizeOption {
  value: string;
  leaves: number;
  treeDepth: number;
  canopyDepth: number;
  concurrencyBuffer: number;
  treeCost: number;
  costPerCNFT: number;
}

export const treeSizeOptions: TreeSizeOption[] = [
  {
    value: "16384",
    leaves: 16_384,
    treeDepth: 14,
    canopyDepth: 8,
    concurrencyBuffer: 64,
    treeCost: 0.3358,
    costPerCNFT: 0.0000255,
  },
  {
    value: "65536",
    leaves: 65_536,
    treeDepth: 16,
    canopyDepth: 10,
    concurrencyBuffer: 64,
    treeCost: 0.7069,
    costPerCNFT: 0.00001579,
  },
  {
    value: "262144",
    leaves: 262_144,
    treeDepth: 18,
    canopyDepth: 12,
    concurrencyBuffer: 64,
    treeCost: 2.1042,
    costPerCNFT: 0.00001303,
  },
  {
    value: "1048576",
    leaves: 1_048_576,
    treeDepth: 20,
    canopyDepth: 13,
    concurrencyBuffer: 1024,
    treeCost: 8.5012,
    costPerCNFT: 0.00001311,
  },
  {
    value: "16777216",
    leaves: 16_777_216,
    treeDepth: 24,
    canopyDepth: 15,
    concurrencyBuffer: 2048,
    treeCost: 26.1201,
    costPerCNFT: 0.00000656,
  },
  {
    value: "67108864",
    leaves: 67_108_864,
    treeDepth: 26,
    canopyDepth: 17,
    concurrencyBuffer: 2048,
    treeCost: 70.8213,
    costPerCNFT: 0.00000606,
  },
  {
    value: "1073741824",
    leaves: 1_073_741_824,
    treeDepth: 30,
    canopyDepth: 17,
    concurrencyBuffer: 2048,
    treeCost: 72.6468,
    costPerCNFT: 0.00000507,
  },
];
