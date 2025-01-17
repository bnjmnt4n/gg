// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { RefName } from "./RefName";
import type { RevHeader } from "./RevHeader";
import type { TreePath } from "./TreePath";

export type Operand = { "type": "Repository" } | { "type": "Revision", header: RevHeader, } | { "type": "Merge", header: RevHeader, } | { "type": "Parent", header: RevHeader, child: RevHeader, } | { "type": "Change", header: RevHeader, path: TreePath, } | { "type": "Branch", header: RevHeader, name: RefName, };