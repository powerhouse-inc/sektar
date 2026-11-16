// The pieces this package ships: what each is called and where the node build
// emits its module. A piece's version is this package's.
import type { PackagePiece } from "@powerhousedao/pieces-framework";

export const pieces: PackagePiece[] = [
  {
    name: "@powerhousedao/sektar-pdf-piece",
    entry: "dist/node/pieces/sektar-pdf/index.mjs",
  },
  {
    name: "@powerhousedao/distyra-piece",
    entry: "dist/node/pieces/distyra/index.mjs",
  },
  {
    name: "@powerhousedao/docture-piece",
    entry: "dist/node/pieces/docture/index.mjs",
  },
];

export default pieces;
