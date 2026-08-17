/*
 * NexCord
 * FastPing - Ported from Nightcord
 */

import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import { insertTextIntoChatInputBox } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";

const SNOWFLAKE_RE = /^\d{15,21}$/;

const settings = definePluginSettings({
    trailingSpace: {
        type: OptionType.BOOLEAN,
        description: "Add a space after the mention once inserted",
        default: true,
    },
});

let popoverEl: HTMLDivElement | null = null;
let repositionTarget: Range | null = null;

function removePopover() {
    popoverEl?.remove();
    popoverEl = null;
    repositionTarget = null;
}

function positionPopover(el: HTMLDivElement, range: Range) {
    const rect = range.getBoundingClientRect();
    const top = rect.top - 40;
    const left = rect.left + rect.width / 2;

    el.style.top = `${Math.max(8, top)}px`;
    el.style.left = `${left}px`;
}

function showPopover(id: string, range: Range) {
    removePopover();

    const el = document.createElement("div");
    el.className = "fastping-popover";

    const btn = document.createElement("button");
    btn.className = "fastping-popover-btn";
    btn.type = "button";

    btn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span>Ping ${id}</span>
    `;

    btn.addEventListener("mousedown", e => {
        e.preventDefault();
    });

    btn.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();

        const suffix = settings.store.trailingSpace ? " " : "";
        insertTextIntoChatInputBox(`<@${id}>${suffix}`);

        removePopover();
    });

    el.appendChild(btn);
    document.body.appendChild(el);

    positionPopover(el, range);

    popoverEl = el;
    repositionTarget = range;
}

function isInsideChatInput(node: Node | null): boolean {
    if (!node) return false;

    const el = node instanceof Element ? node : node.parentElement;

    return !!el?.closest('[data-slate-editor="true"]');
}

function onDblClick(e: MouseEvent) {
    if (popoverEl?.contains(e.target as Node)) return;

    requestAnimationFrame(() => {
        const selection = window.getSelection();

        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            removePopover();
            return;
        }

        const text = selection.toString().trim();

        if (
            !isInsideChatInput(selection.anchorNode) ||
            !SNOWFLAKE_RE.test(text)
        ) {
            removePopover();
            return;
        }

        showPopover(text, selection.getRangeAt(0).cloneRange());
    });
}

function onScrollOrResize() {
    if (popoverEl && repositionTarget) {
        positionPopover(popoverEl, repositionTarget);
    }
}

function onDocMouseDown(e: MouseEvent) {
    if (popoverEl && !popoverEl.contains(e.target as Node)) {
        removePopover();
    }
}

function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
        removePopover();
    }
}

export default definePlugin({
    name: "FastPing",
    description: "Double-click a Discord user ID in the chat box to quickly turn it into a mention.",
    authors: [{ name: "NexCord", id: 0n }],
    tags: ["Utility"],
    settings,

    start() {
        document.addEventListener("dblclick", onDblClick, true);
        document.addEventListener("mousedown", onDocMouseDown, true);
        document.addEventListener("keydown", onKeyDown, true);

        window.addEventListener("scroll", onScrollOrResize, true);
        window.addEventListener("resize", onScrollOrResize);
    },

    stop() {
        document.removeEventListener("dblclick", onDblClick, true);
        document.removeEventListener("mousedown", onDocMouseDown, true);
        document.removeEventListener("keydown", onKeyDown, true);

        window.removeEventListener("scroll", onScrollOrResize, true);
        window.removeEventListener("resize", onScrollOrResize);

        removePopover();
    },
});