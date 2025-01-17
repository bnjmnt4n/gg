<script lang="ts">
    import type { RevHeader } from "../messages/RevHeader";
    import type { CheckoutRevision } from "../messages/CheckoutRevision";
    import type { CreateRevision } from "../messages/CreateRevision";
    import type { Operand } from "../messages/Operand";
    import { currentTarget, revisionSelectEvent } from "../stores.js";
    import { mutate } from "../ipc";
    import IdSpan from "../controls/IdSpan.svelte";
    import BranchObject from "./BranchObject.svelte";
    import Object from "./Object.svelte";
    import Zone from "./Zone.svelte";

    export let header: RevHeader;
    export let child: RevHeader | null = null;
    export let selected: boolean; // same as the imported event, but parent may want to force a value

    let operand: Operand = child ? { type: "Parent", header, child } : { type: "Revision", header };

    function onSelect() {
        revisionSelectEvent.set(header);
    }

    function onEdit() {
        if (header.is_working_copy) {
            return;
        }

        if (header.is_immutable) {
            mutate<CreateRevision>("create_revision", {
                parent_ids: [header.id],
            });
        } else {
            mutate<CheckoutRevision>("checkout_revision", {
                id: header.id,
            });
        }
    }
</script>

<Object
    {operand}
    id="{child ? 'parent' : 'log'}-{header.id.commit.prefix}"
    conflicted={header.has_conflict}
    {selected}
    label={header.description.lines[0]}
    on:click={onSelect}
    on:dblclick={onEdit}
    let:context
    let:hint={dragHint}>
    {#if child}
        <!-- Parents aren't a drop target -->
        <div class="layout">
            <IdSpan
                id={header.id.change}
                pronoun={context ||
                    ($currentTarget?.type == "Merge" &&
                        $currentTarget.header.parent_ids.findIndex((id) => id.hex == header.id.commit.hex) != -1)} />

            <span class="text desc truncate" class:indescribable={!context && header.description.lines[0] == ""}>
                {dragHint ?? (header.description.lines[0] == "" ? "(no description set)" : header.description.lines[0])}
            </span>

            <span class="text email truncate">{header.author.email}</span>

            <span class="refs">
                {#each header.branches.filter((b) => b.type == "LocalBranch" || !b.is_synced || !b.is_tracked) as ref}
                    <div>
                        <BranchObject {header} name={ref} />
                    </div>
                {/each}
            </span>
        </div>
    {:else}
        <Zone {operand} let:target let:hint={dropHint}>
            <div class="layout" class:target>
                <IdSpan id={header.id.change} pronoun={context || target || dropHint != null} />

                <span class="text desc truncate" class:indescribable={!context && header.description.lines[0] == ""}>
                    {dragHint ??
                        dropHint ??
                        (header.description.lines[0] == "" ? "(no description set)" : header.description.lines[0])}
                </span>

                <span class="text email truncate">{header.author.email}</span>

                <span class="refs">
                    {#each header.branches.filter((b) => b.type == "LocalBranch" || !b.is_synced || !b.is_tracked) as ref}
                        <div>
                            <BranchObject {header} name={ref} />
                        </div>
                    {/each}
                </span>
            </div>
        </Zone>
    {/if}
</Object>

<style>
    .layout {
        /* layout summary components along a text line */
        height: 30px;
        display: grid;
        grid-template-areas: ". desc refs";
        grid-template-columns: auto 1fr auto;
        align-items: baseline;
        gap: 6px;

        /* skip past svg lines when used in a graph */
        padding-left: var(--leftpad);
    }

    .layout.target {
        background: var(--ctp-flamingo);
        color: black;
    }

    .layout > :global(span) {
        line-height: 27px;
    }

    .desc {
        grid-area: desc;
    }

    .desc.indescribable {
        color: var(--ctp-subtext0);
    }

    .email {
        display: none;
        grid-area: email;
        color: var(--ctp-surface2);
        text-align: right;
    }

    .refs {
        grid-area: refs;
        align-self: center;
        display: flex;
        justify-content: end;
        color: var(--ctp-text);
    }

    /* multiple elements can have these */
    .truncate {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .text {
        pointer-events: none;
    }

    @media (width >= 1680px) {
        .layout {
            grid-template-areas: ". desc refs email";
            grid-template-columns: auto auto 1fr auto;
            gap: 9px;
        }

        .email {
            display: initial;
        }
    }
</style>
