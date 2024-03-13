import { mutate } from "../ipc";
import type { Operand } from "../messages/Operand";
import type { RevId } from "../messages/RevId";
import type { AbandonRevisions } from "../messages/AbandonRevisions";
import type { MoveChanges } from "../messages/MoveChanges";
import type { CopyChanges } from "../messages/CopyChanges";

export type RichHint = (string | RevId)[] & { commit?: boolean };
export type Eligibility = { type: "yes", hint: RichHint } | { type: "maybe", hint: string } | { type: "no" };

export default class BinaryMutator {
    #from: Operand;
    #to: Operand;

    constructor(from: Operand, to: Operand) {
        this.#from = from;
        this.#to = to;
    }

    static canDrag(from: Operand): Eligibility {
        // can't change finalised commits
        if ((from.type == "Revision" || from.type == "Change") && from.header.is_immutable) {
            return { type: "maybe", hint: "(revision is immutable)" };
        }

        // removing a parent changes the child
        if (from.type == "Parent" && from.child.is_immutable) {
            return { type: "maybe", hint: "(child is immutable)" };
        } else if (from.type == "Parent" && from.child.parent_ids.length == 1) {
            return { type: "maybe", hint: "(child has only one parent)" };
        }

        // can't change our view of remote branches 
        if (from.type == "Branch" && from.name.type == "RemoteBranch") {
            return { type: "maybe", hint: "(branch is remote)" };
        }

        // can change these listed things (XXX add modes?)
        if (from.type == "Revision") {
            return { type: "yes", hint: ["Rebasing revision ", from.header.change_id] };
        } else if (from.type == "Parent") {
            return { type: "yes", hint: ["Removing parent from revision ", from.child.change_id] };
        } else if (from.type == "Change") {
            return { type: "yes", hint: [`Squashing changes at ${from.path.relative_path}`] };
        } else if (from.type == "Branch") {
            return { type: "yes", hint: [`Moving branch ${from.name.branch_name}`] };
        }

        return { type: "no" };
    }

    canDrop(): Eligibility {
        // generic prohibitions - don't drop undroppables, don't drop on yourself
        if (BinaryMutator.canDrag(this.#from).type != "yes") {
            return { type: "no" };
        } else if (this.#from == this.#to) {
            return { type: "no" };
        }

        if (this.#from.type == "Revision") {
            if (this.#to.type == "Revision") {
                return { type: "yes", hint: ["Rebasing revision ", this.#from.header.change_id, " onto ", this.#to.header.change_id] };
            } else if (this.#to.type == "Parent") {
                if (this.#to.child == this.#from.header) {
                    return { type: "no" };
                } else if (this.#to.child.is_immutable) {
                    return { type: "maybe", hint: "(can't insert before an immutable revision)" };
                } else {
                    return { type: "yes", hint: ["Inserting revision ", this.#from.header.change_id, " before ", this.#to.child.change_id] };
                }
            } else if (this.#to.type == "Merge") {
                if (this.#to.header.change_id.hex == this.#from.header.change_id.hex) {
                    return { type: "no" };
                } else {
                    return { type: "yes", hint: ["Adding parent to revision ", this.#to.header.change_id] };
                }
            } else if (this.#to.type == "Repository") {
                return { type: "yes", hint: Object.assign(["Abandoning commit ", this.#from.header.commit_id], { commit: true }) };
            }
        }

        if (this.#from.type == "Parent") {
            if (this.#to.type == "Repository") {
                return { type: "yes", hint: ["Removing parent from revision ", this.#from.child.change_id] };
            }
        }

        if (this.#from.type == "Change") {
            if (this.#to.type == "Revision") {
                if (this.#to.header.change_id.hex == this.#from.header.change_id.hex) {
                    return { type: "no" };
                } else if (this.#to.header.is_immutable) {
                    return { type: "maybe", hint: "(revision is immutable)" };
                } else {
                    return { type: "yes", hint: [`Squashing changes at ${this.#from.path.relative_path} into `, this.#to.header.change_id] };
                }
            } else if (this.#to.type == "Repository") {
                if (this.#from.header.parent_ids.length == 1) {
                    return { type: "yes", hint: [`Restoring changes at ${this.#from.path.relative_path} from parent `, this.#from.header.parent_ids[0]] };
                } else {
                    //return { type: "maybe", hint: "(revision has multiple parents)" };
                    return { type: "no" };
                }
            }
        }

        if (this.#from.type == "Branch") {
            if (this.#to.type == "Revision") {
                return { type: "yes", hint: [`Moving branch ${this.#from.name.branch_name} to `, this.#to.header.change_id] };
            }
        }

        return { type: "no" };
    }

    doDrop() {
        if (this.#from.type == "Revision") {
            if (this.#to.type == "Revision") {
                console.log("unimplemented: rebase (append)");
            } else if (this.#to.type == "Parent") {
                console.log("unimplemented: rebase (insert)");
            } else if (this.#to.type == "Merge") {
                console.log("unimplemented: rebase (add parent)");
            } else if (this.#to.type == "Repository") {
                // abandon source
                mutate<AbandonRevisions>("abandon_revisions", { commit_ids: [this.#from.header.commit_id] })
            }
        }

        if (this.#from.type == "Parent") {
            if (this.#to.type == "Repository") {
                console.log("unimplemented: rebase (remove parent)");
            }
        }

        if (this.#from.type == "Change") {
            if (this.#to.type == "Revision") {
                // squash path to target
                mutate<MoveChanges>("move_changes", { from_id: this.#from.header.change_id, to_id: this.#to.header.change_id, paths: [this.#from.path] })
            } else if (this.#to.type == "Repository") {
                // restore path from source parent to source
                mutate<CopyChanges>("copy_changes", { from_id: this.#from.header.parent_ids[0], to_id: this.#from.header.change_id, paths: [this.#from.path] });
            }
        }

        if (this.#from.type == "Branch") {
            if (this.#to.type == "Revision") {
                console.log("unimplemented: move branch");
            }
        }

        console.log("error: unknown validated mutation");
    }
}
